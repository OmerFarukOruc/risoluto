import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import type { SymphonyLogger } from "../core/types.js";
import {
  buildOverlayMap,
  flattenOverlayMap,
  normalizeOverlayPath,
  removeOverlayValue,
  setOverlayValue,
} from "./overlay-map.js";
import type { ConfigOverlayEntry } from "./overlay-map.js";
import type { ConfigOverlayPersistenceStore } from "../db/config-store-sqlite.js";
import { isRecord } from "../utils/type-guards.js";

function cloneOverlayMap(map: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(map) as Record<string, unknown>;
}

export class FileConfigStore implements ConfigOverlayPersistenceStore {
  constructor(
    private readonly overlayPath: string,
    private readonly logger: SymphonyLogger,
  ) {}

  async load(): Promise<Record<string, unknown>> {
    const source = await this.readSource();
    if (source === null) {
      return {};
    }
    return this.parseSource(source);
  }

  async save(pathExpression: string, value: unknown): Promise<void> {
    const overlay = await this.load();
    const segments = normalizeOverlayPath(pathExpression);
    if (segments.length === 0) {
      throw new Error("overlay path must contain at least one segment");
    }
    setOverlayValue(overlay, segments, value);
    await this.persistMap(overlay);
  }

  async delete(pathExpression: string): Promise<boolean> {
    const overlay = await this.load();
    const segments = normalizeOverlayPath(pathExpression);
    if (segments.length === 0) {
      throw new Error("overlay path must contain at least one segment");
    }
    const deleted = removeOverlayValue(overlay, segments);
    if (!deleted) {
      return false;
    }
    await this.persistMap(overlay);
    return true;
  }

  async list(): Promise<ConfigOverlayEntry[]> {
    return flattenOverlayMap(await this.load());
  }

  async replaceAll(entries: ConfigOverlayEntry[]): Promise<void> {
    await this.persistMap(buildOverlayMap(entries));
  }

  private async readSource(): Promise<string | null> {
    try {
      return await readFile(this.overlayPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private parseSource(source: string): Record<string, unknown> {
    const parsed = YAML.parse(source);
    const map = parsed === null ? {} : parsed;
    if (!isRecord(map)) {
      throw new TypeError("config overlay root must be a YAML map");
    }
    return cloneOverlayMap(map);
  }

  private async persistMap(map: Record<string, unknown>): Promise<void> {
    const rendered = YAML.stringify(map);
    const dir = path.dirname(this.overlayPath);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const temporaryPath = `${this.overlayPath}.tmp-${process.pid}-${Date.now()}`;
      try {
        await mkdir(dir, { recursive: true });
        await writeFile(temporaryPath, rendered, "utf8");
        await rename(temporaryPath, this.overlayPath);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" && attempt === 0) {
          this.logger.warn({ error: String(error) }, "config overlay persist retrying after ENOENT");
          continue;
        }
        throw error;
      }
    }
  }
}
