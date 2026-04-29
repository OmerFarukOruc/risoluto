/**
 * Health probe port.
 *
 * Concrete implementations sit in `src/health/probes/` — one per
 * top-level probe (github, linear, docker). The `HealthRunner` calls
 * `run()` in parallel for every registered probe on each tick (subject
 * to adaptive cadence) and aggregates the resulting subprobes into a
 * `HealthProbeResult` via its sliding-window state machine.
 *
 * Implementations must:
 *   - Always return a populated `HealthSubprobe[]` (never throw).
 *   - Honour the `signal` for cancellation when a per-probe timeout fires.
 *   - Populate `latencyMs` even on failure (use the elapsed time).
 *   - Set `failureKind` to `ok` only when `status === "ok"`; otherwise
 *     pick the most specific kind from `HealthFailureKind`.
 */

import type { HealthProbeId, HealthSubprobe } from "../core/types/health.js";

export interface HealthProbeContext {
  /** Cancels in-flight work when the per-probe timeout elapses. */
  signal: AbortSignal;
  /** Now() in ms — injected so tests can pin time. */
  nowMs: () => number;
}

export interface HealthProbe {
  /** Identifier matching `HealthChecks.<id>`. */
  id: HealthProbeId;
  /**
   * Runs every sub-probe in parallel and returns their outcomes. Must
   * never throw — wrap and report as a failed `HealthSubprobe` instead.
   */
  run(context: HealthProbeContext): Promise<HealthSubprobe[]>;
}
