import { and, asc, desc, gte, lt } from "drizzle-orm";

import {
  COST_SAMPLE_RETENTION_MS,
  type CostSampleInput,
  type CostSampleRecord,
  type CostSampleStorePort,
  type RecentSamplesOptions,
} from "../../core/cost-sample-port.js";
import type { RisolutoDatabase } from "./database.js";
import { costSamples } from "./schema.js";
import { clampLimit } from "./store-utils.js";

/**
 * SQLite-backed implementation of the cost-sample time-series store.
 *
 * `append` is called once per orchestrator tick. Each insert opportunistically
 * deletes rows older than the retention window so storage stays bounded
 * without a separate maintenance job. SQLite indexes the `sampled_at`
 * column, so the truncation is O(log n + k) where k is the number of
 * rows actually being removed (almost always zero).
 */
export class SqliteCostSampleStore implements CostSampleStorePort {
  static create(db: RisolutoDatabase): CostSampleStorePort {
    return new SqliteCostSampleStore(db, COST_SAMPLE_RETENTION_MS);
  }

  constructor(
    private readonly db: RisolutoDatabase,
    private readonly retentionMs: number,
  ) {}

  append(input: CostSampleInput): void {
    this.db
      .insert(costSamples)
      .values({
        sampledAt: input.atMs,
        costUsd: input.costUsd,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        secondsRunning: input.secondsRunning,
        headroomPct: input.headroomPct,
      })
      .run();
    const cutoff = input.atMs - this.retentionMs;
    this.db.delete(costSamples).where(lt(costSamples.sampledAt, cutoff)).run();
  }

  recentSamples(options: RecentSamplesOptions = {}): CostSampleRecord[] {
    const limit = clampLimit(options.limit);
    const since = options.sinceMs ?? null;

    // Newest-first selection so the limit picks the freshest rows. Result
    // is reversed back to ascending so callers (sparkline renderers) get
    // chronological data without an extra sort.
    const rows = (
      since !== null
        ? this.db
            .select()
            .from(costSamples)
            .where(and(gte(costSamples.sampledAt, since)))
            .orderBy(desc(costSamples.sampledAt))
            .limit(limit)
            .all()
        : this.db.select().from(costSamples).orderBy(desc(costSamples.sampledAt)).limit(limit).all()
    ).reverse();

    return rows.map(rowToRecord);
  }

  /**
   * Test-only helper: returns every row in ascending order. Not part of the
   * port — production callers should use `recentSamples`.
   */
  allForTesting(): CostSampleRecord[] {
    return this.db.select().from(costSamples).orderBy(asc(costSamples.sampledAt)).all().map(rowToRecord);
  }
}

function rowToRecord(row: typeof costSamples.$inferSelect): CostSampleRecord {
  return {
    atMs: row.sampledAt,
    costUsd: row.costUsd,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    secondsRunning: row.secondsRunning,
    headroomPct: row.headroomPct,
  };
}
