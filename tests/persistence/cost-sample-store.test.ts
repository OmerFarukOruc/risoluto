import { describe, expect, it } from "vitest";

import { COST_SAMPLE_RETENTION_MS } from "../../src/core/cost-sample-port.js";
import { openDatabase } from "../../src/persistence/sqlite/database.js";
import { SqliteCostSampleStore } from "../../src/persistence/sqlite/cost-sample-store.js";

function newStore(retentionMs: number = COST_SAMPLE_RETENTION_MS): SqliteCostSampleStore {
  const db = openDatabase(":memory:");
  return new SqliteCostSampleStore(db, retentionMs);
}

describe("SqliteCostSampleStore", () => {
  it("appends and reads back samples in chronological order", () => {
    const store = newStore();
    store.append({ atMs: 1_000, costUsd: 0.01, inputTokens: 10, outputTokens: 4, secondsRunning: 1, headroomPct: 99 });
    store.append({ atMs: 2_000, costUsd: 0.02, inputTokens: 20, outputTokens: 8, secondsRunning: 2, headroomPct: 95 });
    store.append({ atMs: 3_000, costUsd: 0.05, inputTokens: 30, outputTokens: 12, secondsRunning: 3, headroomPct: 90 });

    const samples = store.recentSamples();
    expect(samples.map((s) => s.atMs)).toEqual([1_000, 2_000, 3_000]);
    expect(samples.map((s) => s.costUsd)).toEqual([0.01, 0.02, 0.05]);
    expect(samples.map((s) => s.headroomPct)).toEqual([99, 95, 90]);
  });

  it("preserves null cost and null headroom on round-trip", () => {
    const store = newStore();
    store.append({ atMs: 1, costUsd: null, inputTokens: 0, outputTokens: 0, secondsRunning: 0, headroomPct: null });

    const [sample] = store.recentSamples();
    expect(sample.costUsd).toBeNull();
    expect(sample.headroomPct).toBeNull();
  });

  it("caps `recentSamples` to the requested limit, keeping the freshest rows", () => {
    const store = newStore();
    for (let i = 0; i < 100; i += 1) {
      store.append({
        atMs: i,
        costUsd: i * 0.01,
        inputTokens: i,
        outputTokens: i,
        secondsRunning: i,
        headroomPct: 100 - i,
      });
    }

    const recent = store.recentSamples({ limit: 10 });
    expect(recent).toHaveLength(10);
    expect(recent.map((s) => s.atMs)).toEqual([90, 91, 92, 93, 94, 95, 96, 97, 98, 99]);
  });

  it("filters by `sinceMs`", () => {
    const store = newStore();
    for (let i = 0; i < 5; i += 1) {
      store.append({
        atMs: i * 1000,
        costUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        secondsRunning: 0,
        headroomPct: null,
      });
    }

    const recent = store.recentSamples({ sinceMs: 2000 });
    expect(recent.map((s) => s.atMs)).toEqual([2000, 3000, 4000]);
  });

  it("truncates samples older than the retention window on every append", () => {
    const retentionMs = 1000;
    const store = newStore(retentionMs);

    store.append({ atMs: 100, costUsd: 0, inputTokens: 0, outputTokens: 0, secondsRunning: 0, headroomPct: null });
    store.append({ atMs: 200, costUsd: 0, inputTokens: 0, outputTokens: 0, secondsRunning: 0, headroomPct: null });
    expect(store.recentSamples()).toHaveLength(2);

    store.append({ atMs: 5000, costUsd: 0, inputTokens: 0, outputTokens: 0, secondsRunning: 0, headroomPct: null });
    const samples = store.recentSamples();
    expect(samples).toHaveLength(1);
    expect(samples[0].atMs).toBe(5000);
  });

  it("clamps absurd limits and falls back to the default for negative or NaN", () => {
    const store = newStore();
    for (let i = 0; i < 10; i += 1) {
      store.append({ atMs: i, costUsd: 0, inputTokens: 0, outputTokens: 0, secondsRunning: 0, headroomPct: null });
    }

    expect(store.recentSamples({ limit: -1 })).toHaveLength(10);
    expect(store.recentSamples({ limit: Number.NaN })).toHaveLength(10);
    expect(store.recentSamples({ limit: 1_000_000 })).toHaveLength(10);
  });
});
