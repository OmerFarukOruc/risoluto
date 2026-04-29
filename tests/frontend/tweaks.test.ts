import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_TWEAKS,
  resetTweaksCacheForTests,
  loadTweaks,
  resetTweaks,
  saveTweaks,
} from "../../frontend/src/state/tweaks";

const STORAGE_KEY = "risoluto:board:tweaks";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("tweaks store", () => {
  let originalStorage: Storage | undefined;
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
    originalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memory });
    resetTweaksCacheForTests();
  });

  afterEach(() => {
    if (originalStorage === undefined) {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    } else {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage });
    }
  });

  it("returns defaults when storage is empty", () => {
    expect(loadTweaks()).toEqual({ ...DEFAULT_TWEAKS });
  });

  it("persists a partial patch and merges it on next load", () => {
    const next = saveTweaks({ density: "comfortable", headerStyle: "accent", showLifecycle: false });
    expect(next.density).toBe("comfortable");
    expect(next.headerStyle).toBe("accent");
    expect(next.showLifecycle).toBe(false);
    expect(next.groupBy).toBe(DEFAULT_TWEAKS.groupBy);

    const reloaded = loadTweaks();
    expect(reloaded).toEqual(next);
  });

  it("ignores values with the wrong type and falls back to defaults", () => {
    memory.setItem(
      STORAGE_KEY,
      JSON.stringify({ density: "huge", headerStyle: 7, showLifecycle: "yes", tweaksOpen: null }),
    );
    expect(loadTweaks()).toEqual({ ...DEFAULT_TWEAKS });
  });

  it("returns defaults when JSON is unparseable", () => {
    memory.setItem(STORAGE_KEY, "{not json");
    expect(loadTweaks()).toEqual({ ...DEFAULT_TWEAKS });
  });

  it("clears the entry on resetTweaks", () => {
    saveTweaks({ density: "compact", tweaksOpen: true });
    expect(memory.getItem(STORAGE_KEY)).not.toBeNull();
    expect(resetTweaks()).toEqual({ ...DEFAULT_TWEAKS });
    expect(memory.getItem(STORAGE_KEY)).toBeNull();
  });
});
