import type { GithubHttpResult, GithubProbeHttp, GithubRateLimitResult } from "../probes/github-probe.js";
import { GitHubTransport } from "../../github/transport.js";

/**
 * Concrete GitHub probe HTTP adapter using `globalThis.fetch`. Resolves
 * the PAT lazily so a token rotation lands without restarting the
 * orchestrator. Network errors and timeouts surface as `status: 0` so
 * the probe can classify them as `unreachable`.
 */
export interface GithubHttpAdapterDeps {
  resolveToken: () => string | null;
  baseUrl?: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
}

export function createGithubHttpAdapter(deps: GithubHttpAdapterDeps): GithubProbeHttp {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const transport = new GitHubTransport({
    fetch: fetchImpl,
    apiBaseUrl: deps.baseUrl,
    defaultHeaders: {
      accept: "application/vnd.github+json",
      "user-agent": "risoluto-health-probe/1",
    },
  });

  async function call(path: string, signal: AbortSignal): Promise<GithubHttpResult> {
    const token = deps.resolveToken();
    if (!token) {
      return { status: 0, scopes: [], bodyExcerpt: "no GitHub token configured" };
    }
    try {
      const response = await transport.send({
        pathName: path,
        method: "GET",
        signal,
        token,
      });
      const scopes = parseScopes(response.headers.get("x-oauth-scopes"));
      const bodyExcerpt = await readBodyExcerpt(response);
      return { status: response.status, scopes, bodyExcerpt };
    } catch (error) {
      return { status: 0, scopes: [], bodyExcerpt: errorMessage(error) };
    }
  }

  return {
    async pingUser(signal: AbortSignal): Promise<GithubHttpResult> {
      return call("/user", signal);
    },
    async pingRepo(owner: string, repo: string, signal: AbortSignal): Promise<GithubHttpResult> {
      return call(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, signal);
    },
    async pingRateLimit(signal: AbortSignal): Promise<GithubRateLimitResult> {
      const base = await call("/rate_limit", signal);
      // Extract the `core` resource bucket from the body if available.
      const parsed = parseRateLimit(base.bodyExcerpt);
      return { ...base, ...parsed };
    },
  };
}

function parseScopes(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

async function readBodyExcerpt(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > 1000 ? text.slice(0, 1000) : text;
  } catch {
    return "";
  }
}

function parseRateLimit(body: string): { remaining: number; limit: number; resetAt: string | null } {
  if (!body) return { remaining: 0, limit: 0, resetAt: null };
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    const resources = (json.resources as Record<string, unknown> | undefined) ?? {};
    const core = (resources.core as Record<string, unknown> | undefined) ?? {};
    const limit = Number(core.limit ?? 0);
    const remaining = Number(core.remaining ?? 0);
    const resetEpoch = Number(core.reset ?? 0);
    const resetAt = Number.isFinite(resetEpoch) && resetEpoch > 0 ? new Date(resetEpoch * 1000).toISOString() : null;
    return { remaining, limit, resetAt };
  } catch {
    return { remaining: 0, limit: 0, resetAt: null };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
