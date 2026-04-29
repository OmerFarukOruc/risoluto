import { and, asc, desc, eq, gte, lt } from "drizzle-orm";

import type { HealthCheckStatus, HealthFailureKind, HealthProbeId, HealthSubprobe } from "../../core/types/health.js";
import type { RisolutoDatabase } from "./database.js";
import { healthProbeSamples } from "./schema.js";
import { clampLimit } from "./store-utils.js";

/** 7-day retention as agreed in the design brief. */
export const HEALTH_PROBE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface HealthProbeSample extends HealthSubprobe {
  /** Epoch milliseconds. */
  atMs: number;
  /** Top-level probe id (`github` / `linear` / `docker`). */
  probe: HealthProbeId;
}

export interface AppendInput {
  atMs: number;
  probe: HealthProbeId;
  subprobes: ReadonlyArray<HealthSubprobe>;
}

export interface RecentSamplesOptions {
  probe?: HealthProbeId;
  subprobe?: string;
  sinceMs?: number;
  limit?: number;
}

export interface HealthProbeStorePort {
  append(input: AppendInput): void;
  recentSamples(options?: RecentSamplesOptions): HealthProbeSample[];
}

/**
 * SQLite-backed health probe sample store. Each call to `append` writes
 * one row per sub-probe and opportunistically truncates rows older than
 * the retention window so storage stays bounded.
 */
export class SqliteHealthProbeStore implements HealthProbeStorePort {
  static create(db: RisolutoDatabase): HealthProbeStorePort {
    return new SqliteHealthProbeStore(db, HEALTH_PROBE_RETENTION_MS);
  }

  constructor(
    private readonly db: RisolutoDatabase,
    private readonly retentionMs: number,
  ) {}

  append(input: AppendInput): void {
    if (input.subprobes.length === 0) return;
    const rows = input.subprobes.map((subprobe) => ({
      sampledAt: input.atMs,
      probe: input.probe,
      subprobe: subprobe.name,
      status: subprobe.status,
      failureKind: subprobe.failureKind,
      latencyMs: subprobe.latencyMs,
      detail: subprobe.detail,
    }));
    this.db.insert(healthProbeSamples).values(rows).run();
    const cutoff = input.atMs - this.retentionMs;
    this.db.delete(healthProbeSamples).where(lt(healthProbeSamples.sampledAt, cutoff)).run();
  }

  recentSamples(options: RecentSamplesOptions = {}): HealthProbeSample[] {
    const limit = clampLimit(options.limit);
    const conditions = [];
    if (options.probe) conditions.push(eq(healthProbeSamples.probe, options.probe));
    if (options.subprobe) conditions.push(eq(healthProbeSamples.subprobe, options.subprobe));
    if (options.sinceMs !== undefined) conditions.push(gte(healthProbeSamples.sampledAt, options.sinceMs));

    const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
    const query = where
      ? this.db.select().from(healthProbeSamples).where(where)
      : this.db.select().from(healthProbeSamples);

    return query.orderBy(desc(healthProbeSamples.sampledAt)).limit(limit).all().reverse().map(rowToSample);
  }

  /** Test-only — every row in ascending order. */
  allForTesting(): HealthProbeSample[] {
    return this.db.select().from(healthProbeSamples).orderBy(asc(healthProbeSamples.sampledAt)).all().map(rowToSample);
  }
}

function rowToSample(row: typeof healthProbeSamples.$inferSelect): HealthProbeSample {
  return {
    atMs: row.sampledAt,
    probe: row.probe as HealthProbeId,
    name: row.subprobe,
    status: row.status as HealthCheckStatus,
    failureKind: row.failureKind as HealthFailureKind,
    latencyMs: row.latencyMs,
    detail: row.detail,
  };
}
