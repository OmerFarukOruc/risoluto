import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import type { SecretBackend } from "@symphony/shared";

import type { SymphonyLogger } from "../core/types.js";
import { openSymphonyDatabase } from "../persistence/sqlite/database.js";
import { secretAuditRows, secretStateRows } from "../persistence/sqlite/schema.js";
import { asStringRecord } from "../utils/type-guards.js";
import { decryptText, deriveKey, encodeEnvelope, encryptText, parseEnvelope } from "./crypto.js";

export interface SecretsStoreOptions {
  masterKey?: string;
  auditLog?: boolean;
  notifySubscribers?: boolean;
}

export class SecretsStore implements SecretBackend {
  private readonly cache = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private encryptionKey: Buffer | null = null;
  private database: ReturnType<typeof openSymphonyDatabase> | null = null;

  constructor(
    private readonly baseDir: string,
    private readonly logger: SymphonyLogger,
    private readonly options?: SecretsStoreOptions,
  ) {}

  async start(): Promise<void> {
    await this.startDeferred();
    const masterKey = this.options?.masterKey ?? process.env.MASTER_KEY ?? "";
    if (!masterKey) {
      throw new Error("MASTER_KEY is required to initialize SecretsStore");
    }
    this.encryptionKey = deriveKey(masterKey);
    const source = await this.readPersistedEnvelope();
    if (source === null) {
      await this.persist();
      return;
    }

    await this.loadFromEnvelopeSource(source.value, source.sourceLabel);
  }

  async startDeferred(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    this.database = openSymphonyDatabase(this.baseDir);
  }

  async initializeWithKey(masterKey: string): Promise<void> {
    await this.startDeferred();
    this.encryptionKey = deriveKey(masterKey);
    const source = await this.readPersistedEnvelope();
    if (source === null) {
      await this.persist();
      this.notify();
      return;
    }

    const envelope = parseEnvelope(source.value);
    let decrypted: string;
    try {
      decrypted = decryptText(envelope, this.requiredKey());
    } catch (error) {
      this.logger.warn(
        { error: String(error) },
        "failed to decrypt secrets.enc — MASTER_KEY may have changed; starting with empty store",
      );
      await this.persist();
      this.notify();
      return;
    }
    this.loadCache(decrypted);
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
    await this.persist();
    await this.appendAuditEntry("set", key);
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

    await this.persist();
    await this.appendAuditEntry("delete", key);
    this.notify();
    return true;
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.cache);
  }

  async replaceAll(snapshot: Record<string, string>): Promise<void> {
    this.cache.clear();
    for (const [key, value] of Object.entries(snapshot)) {
      this.cache.set(key, value);
    }
    await this.persist();
  }

  async hasPersistedSource(): Promise<boolean> {
    return (await this.readEncryptedFile()) !== null || (await this.readEnvelopeFromDb()) !== null;
  }

  private requiredKey(): Buffer {
    if (!this.encryptionKey) {
      throw new Error("SecretsStore has not been started");
    }
    return this.encryptionKey;
  }

  private notify(): void {
    if (this.options?.notifySubscribers === false) {
      return;
    }
    for (const listener of this.listeners) {
      listener();
    }
  }

  private async appendAuditEntry(operation: "set" | "delete", key: string): Promise<void> {
    if (this.options?.auditLog === false) {
      return;
    }
    const entry = {
      at: new Date().toISOString(),
      operation,
      key,
    };
    const line = JSON.stringify(entry);
    await appendFile(this.auditPath(), `${line}\n`, "utf8");
    if (this.database) {
      await this.database.db.insert(secretAuditRows).values(entry);
    }
  }

  private async readEncryptedFile(): Promise<string | null> {
    try {
      return await readFile(this.secretsPath(), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private async readPersistedEnvelope(): Promise<{ value: string; sourceLabel: "file" | "sqlite" } | null> {
    const fileEnvelope = await this.readEncryptedFile();
    if (fileEnvelope !== null) {
      return { value: fileEnvelope, sourceLabel: "file" };
    }

    const sqliteEnvelope = await this.readEnvelopeFromDb();
    if (sqliteEnvelope !== null) {
      return { value: sqliteEnvelope, sourceLabel: "sqlite" };
    }

    return null;
  }

  private loadCache(decrypted: string): void {
    const secrets = asStringRecord(JSON.parse(decrypted) as unknown);
    this.cache.clear();
    for (const [key, value] of Object.entries(secrets)) {
      this.cache.set(key, value);
    }
  }

  private async persist(): Promise<void> {
    const serializedSecrets = JSON.stringify(Object.fromEntries(this.cache), null, 2);
    const envelope = encryptText(serializedSecrets, this.requiredKey());
    const encodedEnvelope = encodeEnvelope(envelope);

    for (let attempt = 0; attempt < 2; attempt++) {
      const temporaryPath = `${this.secretsPath()}.tmp-${process.pid}-${Date.now()}`;
      try {
        await writeFile(temporaryPath, encodedEnvelope, "utf8");
        await rename(temporaryPath, this.secretsPath());
        await this.persistEnvelopeToDb(encodedEnvelope);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" && attempt === 0) {
          this.logger.warn({ error: String(error) }, "secrets persist retrying after ENOENT");
          continue;
        }
        throw error;
      }
    }
  }

  private secretsPath(): string {
    return path.join(this.baseDir, "secrets.enc");
  }

  private auditPath(): string {
    return path.join(this.baseDir, "secrets.audit.log");
  }

  private async loadFromEnvelopeSource(source: string, sourceLabel: "file" | "sqlite"): Promise<void> {
    let envelope: ReturnType<typeof parseEnvelope>;
    try {
      envelope = parseEnvelope(source);
    } catch (error) {
      this.logger.error(
        { error: String(error), source: sourceLabel, secretsPath: this.secretsPath() },
        "corrupted secrets envelope — cannot parse JSON",
      );
      throw new Error("secrets envelope is not valid JSON; the stored envelope may be corrupted", { cause: error });
    }
    let decrypted: string;
    try {
      decrypted = decryptText(envelope, this.requiredKey());
    } catch (error) {
      this.logger.error(
        { error: String(error), source: sourceLabel, secretsPath: this.secretsPath() },
        "failed to decrypt secrets.enc — refusing to overwrite existing secret store",
      );
      throw new Error("failed to decrypt secrets.enc; MASTER_KEY may not match the existing archive", { cause: error });
    }
    this.loadCache(decrypted);
    await this.persistEnvelopeToDb(source);
  }

  private async readEnvelopeFromDb(): Promise<string | null> {
    if (!this.database) {
      return null;
    }
    const row = await this.database.db.query.secretStateRows.findFirst({
      where: eq(secretStateRows.id, 1),
    });
    return row?.envelope ?? null;
  }

  private async persistEnvelopeToDb(envelope: string): Promise<void> {
    if (!this.database) {
      return;
    }
    await this.database.db
      .insert(secretStateRows)
      .values({
        id: 1,
        envelope,
      })
      .onConflictDoUpdate({
        target: secretStateRows.id,
        set: {
          envelope,
        },
      });
  }
}
