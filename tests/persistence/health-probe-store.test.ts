import { describe, expect, it } from "vitest";

import type { HealthSubprobe } from "../../src/core/types/health.js";
import { HEALTH_PROBE_RETENTION_MS, SqliteHealthProbeStore } from "../../src/persistence/sqlite/health-probe-store.js";
import { openDatabase } from "../../src/persistence/sqlite/database.js";

function newStore(retentionMs: number = HEALTH_PROBE_RETENTION_MS): SqliteHealthProbeStore {
  const db = openDatabase(":memory:");
  return new SqliteHealthProbeStore(db, retentionMs);
}

function subprobe(name: string, overrides: Partial<HealthSubprobe> = {}): HealthSubprobe {
  return {
    name,
    status: "ok",
    failureKind: "ok",
    latencyMs: 42,
    detail: "",
    ...overrides,
  };
}

describe("SqliteHealthProbeStore", () => {
  it("appends one row per subprobe and reads back in chronological order", () => {
    const store = newStore();
    store.append({
      atMs: 1_000,
      probe: "github",
      subprobes: [subprobe("auth"), subprobe("repo:acme/foo", { latencyMs: 88 })],
    });
    store.append({
      atMs: 2_000,
      probe: "github",
      subprobes: [subprobe("auth", { status: "down", failureKind: "auth_failure", detail: "401" })],
    });

    const samples = store.recentSamples();
    expect(samples).toHaveLength(3);
    expect(samples.map((s) => `${s.atMs}/${s.name}/${s.status}`)).toEqual([
      "1000/auth/ok",
      "1000/repo:acme/foo/ok",
      "2000/auth/down",
    ]);
  });

  it("filters by probe + subprobe + sinceMs", () => {
    const store = newStore();
    store.append({ atMs: 1_000, probe: "github", subprobes: [subprobe("auth")] });
    store.append({ atMs: 2_000, probe: "linear", subprobes: [subprobe("workflow_states")] });
    store.append({ atMs: 3_000, probe: "github", subprobes: [subprobe("auth")] });

    expect(store.recentSamples({ probe: "github" }).map((s) => s.atMs)).toEqual([1_000, 3_000]);
    expect(store.recentSamples({ subprobe: "auth" }).map((s) => s.atMs)).toEqual([1_000, 3_000]);
    expect(store.recentSamples({ sinceMs: 2_500 }).map((s) => s.atMs)).toEqual([3_000]);
  });

  it("clamps limit and keeps the freshest rows", () => {
    const store = newStore();
    for (let i = 0; i < 50; i += 1) {
      store.append({ atMs: i, probe: "github", subprobes: [subprobe("auth", { latencyMs: i })] });
    }
    const recent = store.recentSamples({ limit: 5 });
    expect(recent).toHaveLength(5);
    expect(recent.map((s) => s.atMs)).toEqual([45, 46, 47, 48, 49]);
  });

  it("truncates rows older than the retention window on every append", () => {
    const store = newStore(1_000);
    store.append({ atMs: 100, probe: "github", subprobes: [subprobe("auth")] });
    store.append({ atMs: 500, probe: "github", subprobes: [subprobe("auth")] });
    expect(store.recentSamples()).toHaveLength(2);

    store.append({ atMs: 5_000, probe: "github", subprobes: [subprobe("auth")] });
    const samples = store.recentSamples();
    expect(samples).toHaveLength(1);
    expect(samples[0].atMs).toBe(5_000);
  });

  it("ignores empty subprobe arrays without writing rows", () => {
    const store = newStore();
    store.append({ atMs: 1_000, probe: "github", subprobes: [] });
    expect(store.recentSamples()).toEqual([]);
  });
});
