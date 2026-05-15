import type { TypedEventBus } from "../core/event-bus.js";
import type { RisolutoEventMap } from "../core/risoluto-events.js";
import type { RisolutoLogger } from "../core/types.js";
import type {
  HealthChecks,
  HealthCheckStatus,
  HealthFailureKind,
  HealthProbeId,
  HealthProbeResult,
  HealthSubprobe,
} from "../core/types/health.js";
import type { HealthProbeStorePort } from "../persistence/sqlite/health-probe-store.js";
import type { HealthProbe } from "./probe-port.js";

/**
 * Sliding-window state machine + adaptive cadence on top of the per-probe
 * `HealthProbe` runners. Designed to be invoked once per orchestrator
 * tick — `tick()` may decide to skip a probe based on its own cadence
 * gating, so the call is cheap when nothing is due.
 *
 * Cadence policy:
 *   - steady-state (last 5 attempts all `ok`)         → run every 5 ticks
 *   - watch        (any non-ok in window)             → run every tick
 *   - incident     (current status === "down")        → run every tick + ±5s jitter
 *
 * Hysteresis: 3-of-5 sliding window. Each probe owns an independent buffer
 * so a noisy GitHub doesn't latch the Docker check.
 *
 * Persistence: every result is written to the `HealthProbeStorePort`
 * (one row per sub-probe) so the snapshot can survive backend restart
 * and operators get a forensic trail.
 *
 * Audit: state transitions emit a `health.transition` event on the bus.
 */

const WINDOW_SIZE = 5;
const STEADY_STATE_INTERVAL_TICKS = 5;
const PROBE_TIMEOUT_MS = 8_000; // hard ceiling — covers per-sub-probe timeouts plus their fan-out

export interface HealthRunnerOptions {
  probes: ReadonlyArray<HealthProbe>;
  store: HealthProbeStorePort;
  logger: RisolutoLogger;
  eventBus?: TypedEventBus<RisolutoEventMap>;
  /** Inject for tests; defaults to `Math.random`. */
  random?: () => number;
  /** Inject for tests; defaults to `Date.now`. */
  nowMs?: () => number;
  /** Per-probe hard timeout in ms. */
  probeTimeoutMs?: number;
}

export class HealthRunner {
  private readonly probes: Map<HealthProbeId, HealthProbe>;
  private readonly state = new Map<HealthProbeId, ProbeState>();
  private readonly random: () => number;
  private readonly nowMs: () => number;
  private readonly timeoutMs: number;
  private tickCount = 0;

  constructor(private readonly options: HealthRunnerOptions) {
    this.probes = new Map(options.probes.map((probe) => [probe.id, probe]));
    this.random = options.random ?? Math.random;
    this.nowMs = options.nowMs ?? Date.now;
    this.timeoutMs = options.probeTimeoutMs ?? PROBE_TIMEOUT_MS;
    for (const probe of options.probes) {
      this.state.set(probe.id, createInitialState());
    }
  }

  /** Snapshot of the latest aggregated results. Always returns four fields (one per id, plus a synthetic for any unconfigured probe). */
  getChecks(): HealthChecks {
    return {
      github: this.resolveResult("github"),
      linear: this.resolveResult("linear"),
      docker: this.resolveResult("docker"),
    };
  }

  /**
   * Runs every probe whose cadence permits in parallel. Awaits all probes
   * to complete (or hit the per-probe timeout) — slow callers do not block
   * a fast probe from updating.
   */
  async tick(): Promise<void> {
    this.tickCount += 1;
    const due = [...this.probes.values()].filter((probe) => this.isDue(probe.id));
    if (due.length === 0) return;

    await Promise.all(due.map((probe) => this.runProbe(probe)));
  }

  private isDue(id: HealthProbeId): boolean {
    const state = this.state.get(id);
    if (!state) return false;
    if (state.lastResult === null) return true; // never run before
    if (state.lastResult.status === "down") return true; // incident — every tick
    if (this.hasNonOkInWindow(state)) return true; // watch — every tick
    // steady-state: every 5th tick relative to the last successful run.
    return this.tickCount - state.lastTickRunAt >= STEADY_STATE_INTERVAL_TICKS;
  }

  private hasNonOkInWindow(state: ProbeState): boolean {
    return state.window.some((entry) => entry !== "ok");
  }

  private async runProbe(probe: HealthProbe): Promise<void> {
    const state = this.state.get(probe.id);
    if (!state) return;

    await this.applyIncidentJitter(state);
    const subprobes = await this.invokeProbe(probe);
    const result = this.composeResult(state, subprobes);
    this.persistSubprobes(probe.id, subprobes);
    this.maybeEmitTransition(probe.id, state.lastResultBeforeUpdate, result);
  }

  private async applyIncidentJitter(state: ProbeState): Promise<void> {
    if (state.lastResult?.status !== "down") return;
    const jitterMs = Math.round((this.random() - 0.5) * 10_000);
    if (jitterMs > 0) await sleep(jitterMs);
  }

  private async invokeProbe(probe: HealthProbe): Promise<HealthSubprobe[]> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await probe.run({ signal: controller.signal, nowMs: this.nowMs });
    } catch (error) {
      // Probes are required not to throw — defend in depth.
      const message = error instanceof Error ? error.message : String(error);
      this.options.logger.warn(
        { probe: probe.id, error: message },
        "health probe threw — converting to single down subprobe",
      );
      return [{ name: "probe", status: "down", failureKind: "remote_error", latencyMs: 0, detail: message }];
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private composeResult(state: ProbeState, subprobes: HealthSubprobe[]): HealthProbeResult {
    const aggregated = this.aggregate(subprobes);
    const previous = state.lastResult;
    state.lastResultBeforeUpdate = previous;
    const checkedAt = new Date(this.nowMs()).toISOString();
    pushWindow(state, aggregated.status === "ok" ? "ok" : "fail");
    const windowOk = state.window.filter((s) => s === "ok").length;
    const result: HealthProbeResult = {
      status: applyHysteresis(aggregated.status, state.window),
      failureKind: aggregated.failureKind,
      checkedAt,
      lastSuccessAt: aggregated.status === "ok" ? checkedAt : (previous?.lastSuccessAt ?? null),
      lastFailureAt: aggregated.status !== "ok" ? checkedAt : (previous?.lastFailureAt ?? null),
      latencyMs: aggregated.latencyMs,
      detail: aggregated.detail,
      subprobes,
      windowOk,
      windowFailed: state.window.length - windowOk,
    };
    state.lastResult = result;
    state.lastTickRunAt = this.tickCount;
    return result;
  }

  private persistSubprobes(probe: HealthProbeId, subprobes: HealthSubprobe[]): void {
    try {
      this.options.store.append({ atMs: this.nowMs(), probe, subprobes });
    } catch (error) {
      this.options.logger.warn(
        { probe, error: error instanceof Error ? error.message : String(error) },
        "health probe sample append failed",
      );
    }
  }

  private maybeEmitTransition(
    probe: HealthProbeId,
    previous: HealthProbeResult | null | undefined,
    result: HealthProbeResult,
  ): void {
    const previousStatus = previous?.status ?? "unknown";
    if (previousStatus === result.status) return;
    this.options.logger.info(
      { probe, previous: previousStatus, current: result.status, failureKind: result.failureKind },
      "health probe transition",
    );
    this.options.eventBus?.emit("health.transition", {
      probe,
      previousStatus,
      currentStatus: result.status,
      failureKind: result.failureKind,
      detail: result.detail,
      checkedAt: result.checkedAt,
    });
  }

  private aggregate(subprobes: ReadonlyArray<HealthSubprobe>): {
    status: HealthCheckStatus;
    failureKind: HealthFailureKind;
    detail: string;
    latencyMs: number;
  } {
    if (subprobes.length === 0) {
      return { status: "unknown", failureKind: "ok", detail: "No subprobes", latencyMs: 0 };
    }
    let worst: HealthSubprobe = subprobes[0];
    for (const subprobe of subprobes.slice(1)) {
      if (rankStatus(subprobe.status) > rankStatus(worst.status)) {
        worst = subprobe;
      }
    }
    const latencyMs = Math.max(...subprobes.map((s) => s.latencyMs));
    return {
      status: worst.status,
      failureKind: worst.failureKind,
      detail: worst.status === "ok" ? "All subprobes ok" : worst.detail ? `${worst.name}: ${worst.detail}` : worst.name,
      latencyMs,
    };
  }

  private resolveResult(id: HealthProbeId): HealthProbeResult {
    const state = this.state.get(id);
    if (!state || !state.lastResult) {
      return {
        status: "unknown",
        failureKind: "ok",
        checkedAt: new Date(this.nowMs()).toISOString(),
        lastSuccessAt: null,
        lastFailureAt: null,
        latencyMs: 0,
        detail: "No probe configured",
        subprobes: [],
        windowOk: 0,
        windowFailed: 0,
      };
    }
    return state.lastResult;
  }
}

// ── State + helpers ─────────────────────────────────────────────────────

interface ProbeState {
  lastResult: HealthProbeResult | null;
  /** Snapshot of `lastResult` taken at the start of a probe run, used for transition detection. */
  lastResultBeforeUpdate?: HealthProbeResult | null;
  /** Sliding window of the last `WINDOW_SIZE` outcomes. Newest at the end. */
  window: WindowEntry[];
  lastTickRunAt: number;
}

type WindowEntry = "ok" | "fail";

function createInitialState(): ProbeState {
  return { lastResult: null, window: [], lastTickRunAt: -STEADY_STATE_INTERVAL_TICKS };
}

function pushWindow(state: ProbeState, entry: WindowEntry): void {
  state.window.push(entry);
  if (state.window.length > WINDOW_SIZE) state.window.shift();
}

/**
 * Demote `ok` → `degraded` if 2+ recent fails are in the window.
 * Promote `down` outcomes that are already terminal — leave as-is.
 *
 * Final mapping (where N = number of `fail` in window of size 5):
 *   N ≤ 1   → keep current status
 *   2 ≤ N ≤ 3 → at least `degraded` (never `ok` / `slow`)
 *   N ≥ 4   → at least `down`
 */
function applyHysteresis(current: HealthCheckStatus, window: ReadonlyArray<WindowEntry>): HealthCheckStatus {
  const failures = window.filter((entry) => entry === "fail").length;
  if (failures >= 4) return rankStatus(current) >= rankStatus("down") ? current : "down";
  if (failures >= 2) {
    if (rankStatus(current) >= rankStatus("degraded")) return current;
    return "degraded";
  }
  return current;
}

function rankStatus(status: HealthCheckStatus): number {
  switch (status) {
    case "ok":
      return 0;
    case "slow":
      return 1;
    case "unknown":
      return 1;
    case "degraded":
      return 2;
    case "down":
      return 3;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
