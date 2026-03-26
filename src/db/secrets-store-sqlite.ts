import { mkdir } from "node:fs/promises";

import { asc, notInArray, type InferSelectModel } from "drizzle-orm";

import type { SecretBackend, SymphonyLogger } from "@symphony/shared";

import { isEnabled } from "../core/feature-flags.js";
import { decryptText, deriveKey, encryptText, type SecretsEnvelope } from "../secrets/crypto.js";
import { SecretsStore, type SecretsStoreOptions } from "../secrets/store.js";
import { openDatabaseConnection, type SqliteConnection } from "./connection.js";
import { secrets } from "./schema.js";

export const SQLITE_SECRET_READS_FLAG = "SQLITE_SECRET_READS";

type SecretSnapshot = Record<string, string>;
type SecretRow = InferSelectModel<typeof secrets>;

function toSnapshot(cache: Map<string, string>): SecretSnapshot {
  return Object.fromEntries(cache);
}

function applySnapshot(cache: Map<string, string>, snapshot: SecretSnapshot): void {
  cache.clear();
  for (const [key, value] of Object.entries(snapshot)) {
    cache.set(key, value);
  }
}

function toEnvelope(row: SecretRow): SecretsEnvelope {
  return {
    version: row.version,
    algorithm: row.algorithm,
    iv: row.iv,
    authTag: row.authTag,
    ciphertext: row.ciphertext,
  };
}

export interface LifecycleSecretBackend extends SecretBackend {
  start(): Promise<void>;
  startDeferred(): Promise<void>;
  initializeWithKey(masterKey: string): Promise<void>;
  snapshot(): SecretSnapshot;
  replaceAll(snapshot: SecretSnapshot): Promise<void>;
}

export class SecretsStoreSqlite implements LifecycleSecretBackend {
  private readonly cache = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private encryptionKey: Buffer | null = null;
  private connection: SqliteConnection | null = null;

  constructor(
    private readonly baseDir: string,
    private readonly logger: SymphonyLogger,
    private readonly options?: SecretsStoreOptions & { dbPath?: string | null },
  ) {}

  async start(): Promise<void> {
    await this.startDeferred();
    const masterKey = this.options?.masterKey ?? process.env.MASTER_KEY ?? "";
    if (!masterKey) {
      throw new Error("MASTER_KEY is required to initialize SecretsStore");
    }
    this.encryptionKey = deriveKey(masterKey);
    if (this.readRows().length === 0) {
      await this.replaceAll({});
      return;
    }
    this.loadSnapshotOrThrow();
  }

  async startDeferred(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    this.connection = openDatabaseConnection({ baseDir: this.baseDir, dbPath: this.options?.dbPath });
  }

  async initializeWithKey(masterKey: string): Promise<void> {
    await this.startDeferred();
    this.encryptionKey = deriveKey(masterKey);

    try {
      this.loadSnapshotOrThrow();
    } catch (error) {
      this.logger.warn(
        { error: String(error) },
        "failed to decrypt secrets.enc — MASTER_KEY may have changed; starting with empty store",
      );
      this.cache.clear();
      await this.replaceAll({});
      this.notify();
      return;
    }

    if (this.readRows().length === 0) {
      await this.replaceAll({});
    }
    this.notify();
  }

  isInitialized(): boolean {
    return this.encryptionKey !== null;
  }

  reset(): void {
    this.cache.clear();
    this.encryptionKey = null;
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): string[] {
    return [...this.cache.keys()].sort((left, right) => left.localeCompare(right));
  }

  get(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  async store(key: string, value: string): Promise<void> {
    if (!key.trim()) {
      throw new Error("secret key must not be empty");
    }
    this.cache.set(key, value);
    await this.replaceAll(this.snapshot());
    this.notify();
  }

  async set(key: string, value: string): Promise<void> {
    await this.store(key, value);
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.cache.delete(key);
    if (!existed) {
      return false;
    }
    await this.replaceAll(this.snapshot());
    this.notify();
    return true;
  }

  snapshot(): SecretSnapshot {
    return toSnapshot(this.cache);
  }

  async replaceAll(snapshot: SecretSnapshot): Promise<void> {
    const connection = this.connectionOrOpen();
    const now = new Date().toISOString();
    const rows = this.readRows();
    const existingCreatedAt = new Map(rows.map((row) => [row.key, row.createdAt]));
    const keys = Object.keys(snapshot).sort((left, right) => left.localeCompare(right));

    connection.sqlite.transaction(() => {
      if (keys.length === 0) {
        connection.db.delete(secrets).run();
        return;
      }

      for (const key of keys) {
        const encrypted = encryptText(snapshot[key], this.requiredKey());
        connection.db
          .insert(secrets)
          .values({
            key,
            algorithm: encrypted.algorithm,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            ciphertext: encrypted.ciphertext,
            version: encrypted.version,
            createdAt: existingCreatedAt.get(key) ?? now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: secrets.key,
            set: {
              algorithm: encrypted.algorithm,
              iv: encrypted.iv,
              authTag: encrypted.authTag,
              ciphertext: encrypted.ciphertext,
              version: encrypted.version,
              updatedAt: now,
            },
          })
          .run();
      }

      connection.db.delete(secrets).where(notInArray(secrets.key, keys)).run();
    })();

    applySnapshot(this.cache, snapshot);
  }

  hasPersistedSecrets(): boolean {
    return this.readRows().length > 0;
  }

  private notify(): void {
    if (this.options?.notifySubscribers === false) {
      return;
    }
    for (const listener of this.listeners) {
      listener();
    }
  }

  private requiredKey(): Buffer {
    if (!this.encryptionKey) {
      throw new Error("SecretsStore has not been started");
    }
    return this.encryptionKey;
  }

  private connectionOrOpen(): SqliteConnection {
    if (!this.connection) {
      this.connection = openDatabaseConnection({ baseDir: this.baseDir, dbPath: this.options?.dbPath });
    }
    return this.connection;
  }

  private readRows(): SecretRow[] {
    return this.connectionOrOpen().db.select().from(secrets).orderBy(asc(secrets.key)).all();
  }

  private loadSnapshotOrThrow(): void {
    const snapshot: SecretSnapshot = {};
    for (const row of this.readRows()) {
      try {
        snapshot[row.key] = decryptText(toEnvelope(row), this.requiredKey());
      } catch (error) {
        this.logger.error(
          { error: String(error), key: row.key },
          "failed to decrypt secrets.enc — refusing to overwrite existing secret store",
        );
        throw new Error("failed to decrypt secrets.enc; MASTER_KEY may not match the existing archive", {
          cause: error,
        });
      }
    }
    applySnapshot(this.cache, snapshot);
  }
}

export class DualWriteSecretStore implements LifecycleSecretBackend {
  private readonly listeners = new Set<() => void>();
  private readonly fileStore: SecretsStore;
  private readonly sqliteStore: SecretsStoreSqlite;
  private readonly options?: SecretsStoreOptions & { dbPath?: string | null };

  constructor(baseDir: string, logger: SymphonyLogger, options?: SecretsStoreOptions & { dbPath?: string | null }) {
    this.options = options;
    this.fileStore = new SecretsStore(baseDir, logger, { ...options, notifySubscribers: false });
    this.sqliteStore = new SecretsStoreSqlite(baseDir, logger, { ...options, notifySubscribers: false });
  }

  async start(): Promise<void> {
    await this.startDeferred();
    const masterKey = this.resolveMasterKey();
    await this.initializeBackends(masterKey);
  }

  async startDeferred(): Promise<void> {
    await this.fileStore.startDeferred();
    await this.sqliteStore.startDeferred();
  }

  async initializeWithKey(masterKey: string): Promise<void> {
    await this.startDeferred();
    await this.initializeBackends(masterKey);
    this.notify();
  }

  isInitialized(): boolean {
    return this.fileStore.isInitialized();
  }

  reset(): void {
    this.fileStore.reset();
    this.sqliteStore.reset();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): string[] {
    return this.readBackend().list();
  }

  get(key: string): string | null {
    return this.readBackend().get(key);
  }

  async store(key: string, value: string): Promise<void> {
    await this.fileStore.store(key, value);
    await this.syncSqliteFromFile();
    this.notify();
  }

  async set(key: string, value: string): Promise<void> {
    await this.store(key, value);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = await this.fileStore.delete(key);
    if (!deleted) {
      return false;
    }
    await this.syncSqliteFromFile();
    this.notify();
    return true;
  }

  snapshot(): SecretSnapshot {
    return this.fileStore.snapshot();
  }

  async replaceAll(snapshot: SecretSnapshot): Promise<void> {
    await this.fileStore.replaceAll(snapshot);
    await this.sqliteStore.replaceAll(snapshot);
  }

  private readBackend(): SecretBackend {
    return isEnabled(SQLITE_SECRET_READS_FLAG) ? this.sqliteStore : this.fileStore;
  }

  private async syncSqliteFromFile(): Promise<void> {
    await this.sqliteStore.replaceAll(this.fileStore.snapshot());
  }

  private resolveMasterKey(): string {
    const masterKey = this.options?.masterKey ?? process.env.MASTER_KEY ?? "";
    if (!masterKey) {
      throw new Error("MASTER_KEY is required to initialize SecretsStore");
    }
    return masterKey;
  }

  private async initializeBackends(masterKey: string): Promise<void> {
    const fileHasSource = await this.fileStore.hasPersistedSource();
    const sqliteHasSource = this.sqliteStore.hasPersistedSecrets();

    if (fileHasSource) {
      await this.fileStore.initializeWithKey(masterKey);
      await this.sqliteStore.initializeWithKey(masterKey);
      await this.syncSqliteFromFile();
      return;
    }

    if (sqliteHasSource) {
      await this.sqliteStore.initializeWithKey(masterKey);
      await this.fileStore.initializeWithKey(masterKey);
      await this.fileStore.replaceAll(this.sqliteStore.snapshot());
      return;
    }

    await this.fileStore.initializeWithKey(masterKey);
    await this.sqliteStore.initializeWithKey(masterKey);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
