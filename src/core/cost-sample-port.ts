/**
 * Port for the cost-sample time-series store.
 *
 * Each tick of the orchestrator appends one sample so the dashboard can
 * render a session-cumulative cost sparkline backed by real data, not
 * fabricated trends. Samples persist across restarts and are truncated
 * to a 7-day window on every append.
 */

export interface CostSampleInput {
  /** Sampling instant in epoch milliseconds. */
  atMs: number;
  /** Total session cost in USD; null when usage is unavailable. */
  costUsd: number | null;
  /** Cumulative input tokens at sample time. */
  inputTokens: number;
  /** Cumulative output tokens at sample time. */
  outputTokens: number;
  /** Cumulative agent runtime seconds at sample time. */
  secondsRunning: number;
  /** Rate-limit headroom 0–100, null when unknown. */
  headroomPct: number | null;
}

export type CostSampleRecord = CostSampleInput;

export interface RecentSamplesOptions {
  /** Hard cap on returned rows. Defaults to 64 (≈ enough for one session sparkline). */
  limit?: number;
  /** Lower bound on `atMs`. */
  sinceMs?: number;
}

export interface CostSampleStorePort {
  /** Append a sample and opportunistically truncate older than the retention window. */
  append(input: CostSampleInput): void;
  /** Most-recent samples first by `atMs`, capped by `limit`. */
  recentSamples(options?: RecentSamplesOptions): CostSampleRecord[];
}

/** 7-day retention as agreed in the design brief. */
export const COST_SAMPLE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
