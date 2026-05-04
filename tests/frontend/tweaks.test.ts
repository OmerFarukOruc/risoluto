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
    expect(loadTweaks()).toEqual({ ...DEFAULT_TWEAKS, collapsedColumns: [], seenRepos: [] });
  });

  it("persists a partial patch and merges it on next load", () => {
    const next = saveTweaks({ density: "comfortable", headerStyle: "accent", showLifecycle: false });
    expect(next.density).toBe("comfortable");
    expect(next.headerStyle).toBe("accent");
    expect(next.showLifecycle).toBe(false);
    expect(next.viewMode).toBe(DEFAULT_TWEAKS.viewMode);
    expect(next.statusFilter).toBe(DEFAULT_TWEAKS.statusFilter);

    const reloaded = loadTweaks();
    expect(reloaded).toEqual(next);
  });

  it("persists viewMode and statusFilter", () => {
    saveTweaks({ viewMode: "swimlane", statusFilter: "running" });
    const reloaded = loadTweaks();
    expect(reloaded.viewMode).toBe("swimlane");
    expect(reloaded.statusFilter).toBe("running");
  });

  it("persists collapsedColumns and seenRepos arrays", () => {
    saveTweaks({ collapsedColumns: ["done", "blocked"], seenRepos: ["acme/api", "acme/orch"] });
    const reloaded = loadTweaks();
    expect(reloaded.collapsedColumns).toEqual(["done", "blocked"]);
    expect(reloaded.seenRepos).toEqual(["acme/api", "acme/orch"]);
  });

  it("dedupes and trims string-array entries on save", () => {
    const next = saveTweaks({
      seenRepos: ["acme/api", " acme/api ", "", "acme/orch", "acme/orch"],
    });
    expect(next.seenRepos).toEqual(["acme/api", "acme/orch"]);
  });

  it("returns independent array copies so callers can't mutate the cache", () => {
    saveTweaks({ collapsedColumns: ["done"] });
    const first = loadTweaks();
    first.collapsedColumns.push("blocked");
    const second = loadTweaks();
    expect(second.collapsedColumns).toEqual(["done"]);
  });

  it("ignores values with the wrong type and falls back to defaults", () => {
    memory.setItem(
      STORAGE_KEY,
      JSON.stringify({
        density: "huge",
        headerStyle: 7,
        showLifecycle: "yes",
        tweaksOpen: null,
        viewMode: "x",
        statusFilter: 9,
        collapsedColumns: "done",
        seenRepos: [42, "acme/api", null],
      }),
    );
    const loaded = loadTweaks();
    expect(loaded.density).toBe(DEFAULT_TWEAKS.density);
    expect(loaded.headerStyle).toBe(DEFAULT_TWEAKS.headerStyle);
    expect(loaded.showLifecycle).toBe(DEFAULT_TWEAKS.showLifecycle);
    expect(loaded.tweaksOpen).toBe(DEFAULT_TWEAKS.tweaksOpen);
    expect(loaded.viewMode).toBe(DEFAULT_TWEAKS.viewMode);
    expect(loaded.statusFilter).toBe(DEFAULT_TWEAKS.statusFilter);
    expect(loaded.collapsedColumns).toEqual([]);
    expect(loaded.seenRepos).toEqual(["acme/api"]);
  });

  it("ignores a legacy groupBy field on read without breaking", () => {
    memory.setItem(STORAGE_KEY, JSON.stringify({ groupBy: "repo", density: "compact" }));
    const loaded = loadTweaks();
    expect(loaded.density).toBe("compact");
    expect((loaded as unknown as Record<string, unknown>).groupBy).toBeUndefined();
  });

  it("returns defaults when JSON is unparseable", () => {
    memory.setItem(STORAGE_KEY, "{not json");
    expect(loadTweaks()).toEqual({ ...DEFAULT_TWEAKS, collapsedColumns: [], seenRepos: [] });
  });

  it("clears the entry on resetTweaks", () => {
    saveTweaks({ density: "compact", tweaksOpen: true });
    expect(memory.getItem(STORAGE_KEY)).not.toBeNull();
    expect(resetTweaks()).toEqual({ ...DEFAULT_TWEAKS, collapsedColumns: [], seenRepos: [] });
    expect(memory.getItem(STORAGE_KEY)).toBeNull();
  });
});
