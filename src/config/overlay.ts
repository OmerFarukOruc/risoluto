import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import chokidar, { type FSWatcher } from "chokidar";

import type { SymphonyLogger } from "../core/types.js";
import { FEATURE_FLAG_SQLITE_CONFIG_READS, isEnabled } from "../core/feature-flags.js";
import {
  ConfigStoreSqlite,
  DualWriteConfigStore,
  type ConfigOverlayPersistenceStore,
} from "../db/config-store-sqlite.js";
import { FileConfigStore } from "./file-config-store.js";
import {
  flattenOverlayMap,
  isDangerousKey,
  isOverlayEqual,
  normalizeOverlayPath,
  removeOverlayValue,
  setOverlayValue,
} from "./overlay-map.js";
import type { ConfigOverlayEntry } from "./overlay-map.js";
import { isRecord } from "../utils/type-guards.js";

function cloneOverlayMap(map: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(map) as Record<string, unknown>;
}

function mergeDeep(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const output = structuredClone(base) as Record<string, unknown>;

  for (const key of Object.keys(patch)) {
    if (isDangerousKey(key)) continue;
    const patchValue = patch[key];
    const baseValue = Object.hasOwn(output, key) ? output[key] : undefined;
    if (isRecord(baseValue) && isRecord(patchValue)) {
      output[key] = mergeDeep(baseValue, patchValue);
      continue;
    }
    output[key] = structuredClone(patchValue);
  }

  return output;
}

export class ConfigOverlayStore {
  private overlay: Record<string, unknown> = {};
  private readonly listeners = new Set<() => void>();
  private watcher: FSWatcher | null = null;
  private readonly fileStore: FileConfigStore;
  private readonly sqliteStore: ConfigStoreSqlite;
  private readonly writeStore: ConfigOverlayPersistenceStore;

  constructor(
    private readonly overlayPath: string,
    private readonly logger: SymphonyLogger,
  ) {
    const archiveDir = path.dirname(path.dirname(this.overlayPath));
    this.fileStore = new FileConfigStore(this.overlayPath, this.logger);
    this.sqliteStore = new ConfigStoreSqlite(archiveDir, this.logger.child({ component: "config-overlay-sqlite" }));
    this.writeStore = new DualWriteConfigStore(this.fileStore, this.sqliteStore, this.logger);
  }

  async start(): Promise<void> {
    await mkdir(path.dirname(this.overlayPath), { recursive: true });
    const fileSource = await this.readOverlaySource({ allowMissingFile: true }, "startup:file");
    if (fileSource !== null) {
      await this.applySource("startup:file");
    } else {
      this.overlay = await this.loadReadMap("startup");
    }

    this.watcher = chokidar.watch(this.overlayPath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    });
    this.watcher.on("add", () => void this.reloadFromDisk("watch:add", { allowMissingFile: true }));
    this.watcher.on("change", () => void this.reloadFromDisk("watch:change", { allowMissingFile: true }));
    this.watcher.on("unlink", () => void this.reloadFromDisk("watch:unlink", { allowMissingFile: true }));
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.writeStore.close?.();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  toMap(): Record<string, unknown> {
    return cloneOverlayMap(this.overlay);
  }

  async replace(nextMap: Record<string, unknown>): Promise<boolean> {
    return this.commit(nextMap, "replace");
  }

  async applyPatch(patch: Record<string, unknown>): Promise<boolean> {
    return this.commit(mergeDeep(this.overlay, patch), "patch");
  }

  async set(pathExpression: string, value: unknown): Promise<boolean> {
    const segments = normalizeOverlayPath(pathExpression);
    if (segments.length === 0) {
      throw new Error("overlay path must contain at least one segment");
    }

    const next = this.toMap();
    setOverlayValue(next, segments, value);
    return this.commit(next, `set:${pathExpression}`);
  }

  async delete(pathExpression: string): Promise<boolean> {
    const segments = normalizeOverlayPath(pathExpression);
    if (segments.length === 0) {
      throw new Error("overlay path must contain at least one segment");
    }

    const next = this.toMap();
    const removed = removeOverlayValue(next, segments);
    if (!removed) {
      return false;
    }
    await this.commit(next, `delete:${pathExpression}`);
    return true;
  }

  /**
   * Atomically apply multiple set/delete operations in a single persist cycle.
   *
   * This prevents the race condition where sequential `set()` calls each persist
   * the overlay file independently, allowing chokidar to reload partial state
   * between calls.
   */
  async setBatch(entries: Array<{ path: string; value: unknown }>, deletions?: string[]): Promise<boolean> {
    const next = this.toMap();

    for (const entry of entries) {
      const segments = normalizeOverlayPath(entry.path);
      if (segments.length === 0) {
        throw new Error("overlay path must contain at least one segment");
      }
      setOverlayValue(next, segments, entry.value);
    }

    for (const pathExpression of deletions ?? []) {
      const segments = normalizeOverlayPath(pathExpression);
      if (segments.length === 0) {
        throw new Error("overlay path must contain at least one segment");
      }
      removeOverlayValue(next, segments);
    }

    const paths = entries.map((e) => e.path);
    if (deletions?.length) {
      paths.push(...deletions.map((d) => `-${d}`));
    }
    return this.commit(next, `setBatch:${paths.join(",")}`);
  }

  private async commit(nextMap: Record<string, unknown>, reason: string): Promise<boolean> {
    if (isOverlayEqual(nextMap, this.overlay)) {
      return false;
    }

    await this.writeStore.replaceAll?.(this.toEntries(nextMap));
    this.overlay = await this.loadReadMap(reason, nextMap);
    this.logger.info({ reason, overlayPath: this.overlayPath }, "config overlay updated");
    this.notify();
    return true;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private async reloadFromDisk(reason: string, options: { allowMissingFile: boolean }): Promise<void> {
    const source = await this.readOverlaySource(options, reason);
    if (source === null) {
      return;
    }
    await this.applySource(reason);
  }

  private async readOverlaySource(options: { allowMissingFile: boolean }, reason: string): Promise<string | null> {
    try {
      return await readFile(this.overlayPath, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" && options.allowMissingFile) {
        return null;
      }
      this.logger.warn({ error: String(error), reason }, "config overlay read failed");
      return null;
    }
  }

  private async applySource(reason: string): Promise<void> {
    let fileMap: Record<string, unknown>;
    try {
      fileMap = await this.fileStore.load();
    } catch (error) {
      this.logger.warn({ reason, overlayPath: this.overlayPath, error: String(error) }, "config overlay parse failed");
      return;
    }

    if (isOverlayEqual(this.overlay, fileMap)) {
      return;
    }

    await this.syncSqlite(fileMap, reason);
    this.overlay = await this.loadReadMap(reason, fileMap);
    this.logger.info({ reason, overlayPath: this.overlayPath }, "config overlay reloaded");
    this.notify();
  }

  private toEntries(map: Record<string, unknown>): ConfigOverlayEntry[] {
    return flattenOverlayMap(map);
  }

  private async loadReadMap(reason: string, fallbackMap?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const readStore = isEnabled(FEATURE_FLAG_SQLITE_CONFIG_READS) ? this.sqliteStore : this.fileStore;
    try {
      return cloneOverlayMap(await readStore.load());
    } catch (error) {
      if (fallbackMap === undefined) {
        throw error;
      }
      this.logger.warn({ reason, error: String(error) }, "config overlay read backend failed; using file snapshot");
      return cloneOverlayMap(fallbackMap);
    }
  }

  private async syncSqlite(map: Record<string, unknown>, reason: string): Promise<void> {
    try {
      await this.sqliteStore.replaceAll?.(this.toEntries(map));
    } catch (error) {
      this.logger.warn({ reason, error: String(error) }, "config overlay SQLite sync failed");
    }
  }
}
