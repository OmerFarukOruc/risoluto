import type { HealthCheckStatus, HealthFailureKind, HealthSubprobe } from "../core/types/health.js";

/**
 * Shared latency-banding wrapper for sub-probes.
 *
 * Each probe file (github, docker, linear) wraps its sub-probe bodies in
 * `timedSubprobe()` to attach `latencyMs` and promote `ok` → `slow` /
 * `down` based on the elapsed time. Thresholds vary per sub-probe so the
 * caller passes them explicitly — `slowMs` triggers `slow`, `downMs`
 * triggers `down` regardless of the body's reported status.
 *
 * The body returns the decision (status + failureKind + detail). The
 * wrapper sets latency, may demote `ok`, and packages everything as a
 * `HealthSubprobe`.
 */
export interface ProbeDecision {
  status: HealthCheckStatus;
  failureKind: HealthFailureKind;
  detail: string;
}

export async function timedSubprobe(
  nowMs: () => number,
  name: string,
  slowMs: number,
  downMs: number,
  body: () => Promise<ProbeDecision>,
): Promise<HealthSubprobe> {
  const start = nowMs();
  const result = await body();
  const latencyMs = nowMs() - start;
  let status: HealthCheckStatus = result.status;
  let detail = result.detail;
  if (status === "ok" && latencyMs >= downMs) {
    status = "down";
    detail = detail || `${name} timeout (>${downMs}ms)`;
  } else if (status === "ok" && latencyMs >= slowMs) {
    status = "slow";
    detail = detail || `${name} slow (${Math.round(latencyMs)}ms)`;
  }
  return { name, status, failureKind: result.failureKind, latencyMs, detail };
}
