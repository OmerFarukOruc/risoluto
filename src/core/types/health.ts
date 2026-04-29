/**
 * Risoluto health contracts.
 *
 * `SystemHealth` is the legacy composite watchdog status driven by the
 * orchestrator's polling loop. It stays as-is to keep the existing UI
 * + alerting pipeline working.
 *
 * `HealthChecks` is the new per-subsystem probe surface fed by
 * `HealthRunner` — a real reachability probe that runs every tick (with
 * adaptive cadence) and persists outcomes to SQLite for forensic review.
 */

export type HealthStatus = "healthy" | "degraded" | "critical";

export interface SystemHealth {
  status: HealthStatus;
  checkedAt: string;
  runningCount: number;
  message: string;
}

// ── Per-subsystem probe surface ─────────────────────────────────────────

/**
 * Discrete probe states. `slow` is a real signal — a probe that succeeded
 * but exceeded its expected latency band. The state machine treats it as
 * a degraded variant so operators see early warning before outages.
 */
export type HealthCheckStatus = "ok" | "slow" | "degraded" | "down" | "unknown";

/**
 * Why a probe failed. `ok` means the probe succeeded — it sits in the
 * same union to keep `result.failureKind` always populated and avoid
 * `null` checks at every consumer.
 */
export type HealthFailureKind =
  | "ok"
  | "auth_failure" // 401/403, missing scopes, revoked PAT
  | "rate_limited" // 429
  | "remote_error" // 5xx, gateway, partial outage
  | "unreachable" // DNS, connection refused, timeout
  | "config_drift" // 404 — repo gone, project misconfigured
  | "resource" // ENOSPC, EACCES — disk / permissions
  | "image_missing"; // codex container image not pulled locally

/**
 * Single sub-probe outcome inside a compound probe. GitHub has three
 * (auth, per-repo, rate-limit); Docker has three (daemon, image,
 * workspace); Linear has two (workflow-states, issues). The aggregate
 * `HealthProbeResult.status` is the worst-of across these.
 */
export interface HealthSubprobe {
  /** Stable identifier — `auth`, `repo:acme/foo`, `daemon`, `image`, `workspace`, `workflow_states`, `issues`. */
  name: string;
  status: HealthCheckStatus;
  failureKind: HealthFailureKind;
  /** Round-trip in ms. Always populated, even on timeout (timeout duration). */
  latencyMs: number;
  /** Operator-readable diagnostic line. Empty string on `ok`. */
  detail: string;
}

/**
 * Aggregated outcome for a top-level probe (`github` / `linear` / `docker`).
 * Fed by the `HealthRunner` state machine after each invocation.
 */
export interface HealthProbeResult {
  status: HealthCheckStatus;
  failureKind: HealthFailureKind;
  /** ISO timestamp of the latest probe attempt. */
  checkedAt: string;
  /** ISO timestamp of the most recent probe with `status === "ok"`. */
  lastSuccessAt: string | null;
  /** ISO timestamp of the most recent probe with `status !== "ok"`. */
  lastFailureAt: string | null;
  /** Aggregate latency for this probe — typically `max(subprobe.latencyMs)`. */
  latencyMs: number;
  /** Operator-readable headline (composed by the runner from the worst sub-probe). */
  detail: string;
  /** Per-sub-probe breakdown surfaced in the UI tooltip. */
  subprobes: HealthSubprobe[];
  /** Number of `ok` outcomes in the last 5 attempts. */
  windowOk: number;
  /** Number of failed outcomes in the last 5 attempts. */
  windowFailed: number;
}

/**
 * Snapshot-level surface. `webhook` is intentionally omitted — Risoluto
 * already exposes it via `RuntimeSnapshot.webhookHealth` (passive
 * observer of inbound deliveries, no probe needed).
 */
export interface HealthChecks {
  github: HealthProbeResult;
  linear: HealthProbeResult;
  docker: HealthProbeResult;
}

/**
 * Probe identifier. Used as the discriminator on persistence + state.
 */
export type HealthProbeId = "github" | "linear" | "docker";
