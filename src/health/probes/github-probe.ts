import type { HealthFailureKind, HealthSubprobe } from "../../core/types/health.js";
import type { HealthProbe, HealthProbeContext } from "../probe-port.js";
import { timedSubprobe } from "../timed-probe.js";

/**
 * Three-way GitHub reachability probe:
 *   1. `GET /user` — token valid + scopes returned
 *   2. `GET /repos/{owner}/{repo}` for every distinct repo in last 24h + the configured fallback
 *   3. `GET /rate_limit` — headroom check, free, doesn't count against quota
 *
 * All three sub-probes run in parallel via `Promise.allSettled` so a slow
 * repo lookup can't hold up the auth check. Per-sub-probe latency is
 * banded ok / slow / down. Failure is mapped to a specific
 * `HealthFailureKind` so operators can tell `auth_failure` from
 * `config_drift` from `unreachable` at a glance.
 */

const SLOW_MS = 1500;
const DOWN_MS = 5000;

const REQUIRED_SCOPES: ReadonlyArray<string> = ["repo", "workflow"];

export interface GithubProbeHttp {
  /** Hit GET /user with the configured PAT. Returns `{ status, scopes, body }`. */
  pingUser(signal: AbortSignal): Promise<GithubHttpResult>;
  /** Hit GET /repos/{owner}/{repo}. */
  pingRepo(owner: string, repo: string, signal: AbortSignal): Promise<GithubHttpResult>;
  /** Hit GET /rate_limit. Returns the parsed core-resource bucket. */
  pingRateLimit(signal: AbortSignal): Promise<GithubRateLimitResult>;
}

export interface GithubHttpResult {
  /** HTTP status code. 0 → didn't connect. */
  status: number;
  /** Header value of `X-OAuth-Scopes`, lowercase + trimmed list. Empty when missing. */
  scopes: string[];
  /** Optional body excerpt for diagnostic detail (truncated to ~200 chars). */
  bodyExcerpt: string;
}

export interface GithubRateLimitResult extends GithubHttpResult {
  remaining: number;
  limit: number;
  resetAt: string | null;
}

export interface GithubRepoRef {
  owner: string;
  repo: string;
}

export interface GithubProbeOptions {
  http: GithubProbeHttp;
  /** Returns repos seen in the last 24h of attempts (caller-provided). */
  recentRepos: () => ReadonlyArray<GithubRepoRef>;
  /** Configured fallback repo from `agent.repoUrl`. May be null. */
  configuredRepo: () => GithubRepoRef | null;
  /** Cap on per-tick repo probes — distinct repos beyond this are skipped. */
  maxRepoProbes?: number;
}

export class GithubProbe implements HealthProbe {
  readonly id = "github" as const;

  constructor(private readonly options: GithubProbeOptions) {}

  async run(context: HealthProbeContext): Promise<HealthSubprobe[]> {
    const { signal, nowMs } = context;
    const subprobes: HealthSubprobe[] = [];

    // Auth + rate-limit always run; per-repo runs for the union of recent + configured.
    const repoRefs = this.collectRepoRefs();

    const tasks: Array<Promise<HealthSubprobe>> = [];
    tasks.push(timed(nowMs, "auth", () => this.runAuth(signal)));
    tasks.push(timed(nowMs, "rate_limit", () => this.runRateLimit(signal)));
    for (const ref of repoRefs) {
      tasks.push(timed(nowMs, `repo:${ref.owner}/${ref.repo}`, () => this.runRepo(ref, signal)));
    }

    const results = await Promise.all(tasks);
    subprobes.push(...results);
    return subprobes;
  }

  private collectRepoRefs(): GithubRepoRef[] {
    const max = this.options.maxRepoProbes ?? 5;
    const seen = new Map<string, GithubRepoRef>();
    const configured = this.options.configuredRepo();
    if (configured) seen.set(refKey(configured), configured);
    for (const ref of this.options.recentRepos()) {
      if (seen.size >= max) break;
      const key = refKey(ref);
      if (!seen.has(key)) seen.set(key, ref);
    }
    return [...seen.values()];
  }

  private async runAuth(signal: AbortSignal): Promise<Pick<HealthSubprobe, "status" | "failureKind" | "detail">> {
    try {
      const result = await this.options.http.pingUser(signal);
      if (result.status === 0) return down("unreachable", "GitHub /user unreachable");
      if (result.status === 401 || result.status === 403) {
        return down("auth_failure", `GitHub auth ${result.status} — rotate or rescope PAT`);
      }
      if (result.status === 429) return down("rate_limited", "GitHub /user rate-limited");
      if (result.status >= 500) return down("remote_error", `GitHub /user ${result.status}`);
      if (result.status < 200 || result.status >= 300) {
        return down("remote_error", `GitHub /user unexpected ${result.status}`);
      }
      const missing = REQUIRED_SCOPES.filter((scope) => !result.scopes.includes(scope));
      if (missing.length > 0) {
        return down("auth_failure", `PAT missing scope${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
      }
      return ok();
    } catch (error) {
      return down("unreachable", asMessage(error));
    }
  }

  private async runRepo(
    ref: GithubRepoRef,
    signal: AbortSignal,
  ): Promise<Pick<HealthSubprobe, "status" | "failureKind" | "detail">> {
    try {
      const result = await this.options.http.pingRepo(ref.owner, ref.repo, signal);
      if (result.status === 0) return down("unreachable", `GitHub ${ref.owner}/${ref.repo} unreachable`);
      if (result.status === 404) return down("config_drift", `Repo ${ref.owner}/${ref.repo} not found`);
      if (result.status === 401 || result.status === 403) {
        return down("auth_failure", `${ref.owner}/${ref.repo} access ${result.status}`);
      }
      if (result.status === 429) return down("rate_limited", `${ref.owner}/${ref.repo} rate-limited`);
      if (result.status >= 500) return down("remote_error", `${ref.owner}/${ref.repo} ${result.status}`);
      if (result.status < 200 || result.status >= 300) {
        return down("remote_error", `${ref.owner}/${ref.repo} unexpected ${result.status}`);
      }
      return ok();
    } catch (error) {
      return down("unreachable", asMessage(error));
    }
  }

  private async runRateLimit(signal: AbortSignal): Promise<Pick<HealthSubprobe, "status" | "failureKind" | "detail">> {
    try {
      const result = await this.options.http.pingRateLimit(signal);
      if (result.status === 0) return down("unreachable", "GitHub /rate_limit unreachable");
      if (result.status === 401 || result.status === 403) {
        return down("auth_failure", `GitHub /rate_limit ${result.status}`);
      }
      if (result.status >= 500) return down("remote_error", `GitHub /rate_limit ${result.status}`);
      if (result.status < 200 || result.status >= 300) {
        return down("remote_error", `GitHub /rate_limit unexpected ${result.status}`);
      }
      if (result.remaining < 10) {
        return {
          status: "down",
          failureKind: "rate_limited",
          detail: `Only ${result.remaining}/${result.limit} req remaining`,
        };
      }
      if (result.remaining < 100) {
        return {
          status: "degraded",
          failureKind: "rate_limited",
          detail: `Headroom low: ${result.remaining}/${result.limit}`,
        };
      }
      return { status: "ok", failureKind: "ok", detail: `${result.remaining}/${result.limit} headroom` };
    } catch (error) {
      return down("unreachable", asMessage(error));
    }
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

function refKey(ref: GithubRepoRef): string {
  return `${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}`;
}

function ok(): Pick<HealthSubprobe, "status" | "failureKind" | "detail"> {
  return { status: "ok", failureKind: "ok", detail: "" };
}

function down(
  failureKind: HealthFailureKind,
  detail: string,
): Pick<HealthSubprobe, "status" | "failureKind" | "detail"> {
  return { status: "down", failureKind, detail };
}

function asMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function timed(
  nowMs: () => number,
  name: string,
  body: () => Promise<Pick<HealthSubprobe, "status" | "failureKind" | "detail">>,
): Promise<HealthSubprobe> {
  return timedSubprobe(nowMs, name, SLOW_MS, DOWN_MS, body);
}
