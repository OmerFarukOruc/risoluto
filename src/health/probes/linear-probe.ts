import type { HealthFailureKind, HealthSubprobe } from "../../core/types/health.js";
import type { TrackerPort } from "../../tracker/port.js";
import type { HealthProbe, HealthProbeContext } from "../probe-port.js";
import { timedSubprobe, type ProbeDecision } from "../timed-probe.js";

/**
 * Two-way tracker reachability probe:
 *   1. `resolveStateId(<active state name>)` — validates project access and
 *      that the configured workflow state names exist on the tracker.
 *   2. `fetchCandidateIssues()` — exercises the same query path the
 *      orchestrator uses on every tick.
 *
 * "Reachable + auth valid + 0 issues returned" still counts as `ok`
 * (could legitimately be an empty queue). "Reachable + auth valid +
 * configured state name does not exist on the project" → `config_drift`.
 *
 * Failures map by exception kind:
 *   - HTTP 401/403 → `auth_failure`
 *   - HTTP 404 → `config_drift`
 *   - HTTP 429 → `rate_limited`
 *   - HTTP 5xx → `remote_error`
 *   - Network / DNS / timeout → `unreachable`
 */

const SLOW_MS = 1000;
const DOWN_MS = 4000;

export interface LinearProbeOptions {
  tracker: TrackerPort;
  /** Active workflow state name from config (e.g. "In Progress") used by the workflow probe. */
  activeStateName: () => string | null;
}

export class LinearProbe implements HealthProbe {
  readonly id = "linear" as const;

  constructor(private readonly options: LinearProbeOptions) {}

  async run(context: HealthProbeContext): Promise<HealthSubprobe[]> {
    const { nowMs } = context;
    const tasks: Array<Promise<HealthSubprobe>> = [
      timed(nowMs, "workflow_states", () => this.runWorkflow()),
      timed(nowMs, "issues", () => this.runIssues()),
    ];
    return Promise.all(tasks);
  }

  private async runWorkflow(): Promise<ProbeDecision> {
    const stateName = this.options.activeStateName();
    if (!stateName) {
      return { status: "unknown", failureKind: "ok", detail: "No active state configured" };
    }
    try {
      const id = await this.options.tracker.resolveStateId(stateName);
      if (id === null) {
        return down("config_drift", `Active state "${stateName}" not found on project`);
      }
      return { status: "ok", failureKind: "ok", detail: `State "${stateName}" reachable` };
    } catch (error) {
      return classifyError(error);
    }
  }

  private async runIssues(): Promise<ProbeDecision> {
    try {
      const issues = await this.options.tracker.fetchCandidateIssues();
      return {
        status: "ok",
        failureKind: "ok",
        detail: `${issues.length} candidate issue${issues.length === 1 ? "" : "s"}`,
      };
    } catch (error) {
      return classifyError(error);
    }
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

function down(failureKind: HealthFailureKind, detail: string): ProbeDecision {
  return { status: "down", failureKind, detail };
}

function classifyError(error: unknown): ProbeDecision {
  if (!(error instanceof Error)) {
    return down("remote_error", String(error));
  }
  const msg = error.message;
  const code = extractStatusCode(msg);
  if (code === 401 || code === 403) return down("auth_failure", `Linear ${code} — token invalid`);
  if (code === 404) return down("config_drift", `Linear ${code} — project misconfigured`);
  if (code === 429) return down("rate_limited", "Linear rate-limited");
  if (code !== null && code >= 500) return down("remote_error", `Linear ${code}`);
  if (looksUnreachable(msg)) return down("unreachable", msg);
  return down("remote_error", msg);
}

function extractStatusCode(message: string): number | null {
  const match = /\b(\d{3})\b/.exec(message);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 100 && n < 600 ? n : null;
}

function looksUnreachable(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("etimedout") ||
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("timeout")
  );
}

function timed(nowMs: () => number, name: string, body: () => Promise<ProbeDecision>): Promise<HealthSubprobe> {
  return timedSubprobe(nowMs, name, SLOW_MS, DOWN_MS, body);
}
