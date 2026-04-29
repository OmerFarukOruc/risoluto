import { describe, expect, it, vi } from "vitest";

import { GithubProbe, type GithubProbeHttp } from "../../../src/health/probes/github-probe.js";

function http(overrides: Partial<GithubProbeHttp> = {}): GithubProbeHttp {
  return {
    pingUser: vi.fn(async () => ({ status: 200, scopes: ["repo", "workflow"], bodyExcerpt: "" })),
    pingRepo: vi.fn(async () => ({ status: 200, scopes: [], bodyExcerpt: "" })),
    pingRateLimit: vi.fn(async () => ({
      status: 200,
      scopes: [],
      bodyExcerpt: "",
      remaining: 4_500,
      limit: 5_000,
      resetAt: null,
    })),
    ...overrides,
  };
}

function ctx(now: () => number = () => 0) {
  return { signal: new AbortController().signal, nowMs: now };
}

describe("GithubProbe", () => {
  it("returns auth + rate-limit + per-repo subprobes all ok on a happy path", async () => {
    const probe = new GithubProbe({
      http: http(),
      recentRepos: () => [{ owner: "acme", repo: "worker" }],
      configuredRepo: () => ({ owner: "acme", repo: "core" }),
    });
    const subprobes = await probe.run(ctx());
    expect(subprobes.map((s) => s.name)).toEqual(["auth", "rate_limit", "repo:acme/core", "repo:acme/worker"]);
    expect(subprobes.every((s) => s.status === "ok")).toBe(true);
  });

  it("flags auth_failure when /user returns 401", async () => {
    const probe = new GithubProbe({
      http: http({ pingUser: vi.fn(async () => ({ status: 401, scopes: [], bodyExcerpt: "" })) }),
      recentRepos: () => [],
      configuredRepo: () => ({ owner: "acme", repo: "core" }),
    });
    const subprobes = await probe.run(ctx());
    const auth = subprobes.find((s) => s.name === "auth")!;
    expect(auth.status).toBe("down");
    expect(auth.failureKind).toBe("auth_failure");
    expect(auth.detail).toContain("401");
  });

  it("flags missing scope as auth_failure", async () => {
    const probe = new GithubProbe({
      http: http({ pingUser: vi.fn(async () => ({ status: 200, scopes: ["repo"], bodyExcerpt: "" })) }),
      recentRepos: () => [],
      configuredRepo: () => null,
    });
    const subprobes = await probe.run(ctx());
    const auth = subprobes.find((s) => s.name === "auth")!;
    expect(auth.status).toBe("down");
    expect(auth.failureKind).toBe("auth_failure");
    expect(auth.detail).toContain("workflow");
  });

  it("flags 404 on a repo as config_drift", async () => {
    const probe = new GithubProbe({
      http: http({ pingRepo: vi.fn(async () => ({ status: 404, scopes: [], bodyExcerpt: "" })) }),
      recentRepos: () => [],
      configuredRepo: () => ({ owner: "acme", repo: "missing" }),
    });
    const subprobes = await probe.run(ctx());
    const repo = subprobes.find((s) => s.name === "repo:acme/missing")!;
    expect(repo.status).toBe("down");
    expect(repo.failureKind).toBe("config_drift");
  });

  it("flags low rate-limit headroom as degraded, very low as down/rate_limited", async () => {
    const lowProbe = new GithubProbe({
      http: http({
        pingRateLimit: vi.fn(async () => ({
          status: 200,
          scopes: [],
          bodyExcerpt: "",
          remaining: 50,
          limit: 5_000,
          resetAt: null,
        })),
      }),
      recentRepos: () => [],
      configuredRepo: () => null,
    });
    const lowSubprobes = await lowProbe.run(ctx());
    const lowRl = lowSubprobes.find((s) => s.name === "rate_limit")!;
    expect(lowRl.status).toBe("degraded");
    expect(lowRl.failureKind).toBe("rate_limited");

    const veryLowProbe = new GithubProbe({
      http: http({
        pingRateLimit: vi.fn(async () => ({
          status: 200,
          scopes: [],
          bodyExcerpt: "",
          remaining: 5,
          limit: 5_000,
          resetAt: null,
        })),
      }),
      recentRepos: () => [],
      configuredRepo: () => null,
    });
    const veryLow = await veryLowProbe.run(ctx());
    const veryRl = veryLow.find((s) => s.name === "rate_limit")!;
    expect(veryRl.status).toBe("down");
    expect(veryRl.failureKind).toBe("rate_limited");
  });

  it("classifies a thrown network error as unreachable", async () => {
    const probe = new GithubProbe({
      http: http({
        pingUser: vi.fn(async () => {
          throw new Error("ECONNREFUSED");
        }),
      }),
      recentRepos: () => [],
      configuredRepo: () => null,
    });
    const subprobes = await probe.run(ctx());
    const auth = subprobes.find((s) => s.name === "auth")!;
    expect(auth.status).toBe("down");
    expect(auth.failureKind).toBe("unreachable");
  });

  it("dedupes repos seen via configured + recent and caps at maxRepoProbes", async () => {
    const probe = new GithubProbe({
      http: http(),
      recentRepos: () => [
        { owner: "acme", repo: "core" },
        { owner: "acme", repo: "worker" },
        { owner: "acme", repo: "ci" },
      ],
      configuredRepo: () => ({ owner: "acme", repo: "core" }),
      maxRepoProbes: 2,
    });
    const subprobes = await probe.run(ctx());
    const repoNames = subprobes.filter((s) => s.name.startsWith("repo:")).map((s) => s.name);
    expect(repoNames).toEqual(["repo:acme/core", "repo:acme/worker"]);
  });

  it("promotes ok to slow when latency exceeds the slow band", async () => {
    let now = 0;
    const probe = new GithubProbe({
      http: http({
        pingUser: vi.fn(async () => {
          now += 2_000;
          return { status: 200, scopes: ["repo", "workflow"], bodyExcerpt: "" };
        }),
      }),
      recentRepos: () => [],
      configuredRepo: () => null,
    });
    const subprobes = await probe.run(ctx(() => now));
    const auth = subprobes.find((s) => s.name === "auth")!;
    expect(auth.status).toBe("slow");
    expect(auth.latencyMs).toBe(2_000);
  });
});
