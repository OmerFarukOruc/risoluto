import { describe, expect, it, vi } from "vitest";

import { LinearProbe } from "../../../src/health/probes/linear-probe.js";
import type { TrackerPort } from "../../../src/tracker/port.js";

function tracker(overrides: Partial<TrackerPort> = {}): TrackerPort {
  return {
    fetchCandidateIssues: vi.fn(async () => []),
    fetchIssueStatesByIds: vi.fn(async () => []),
    fetchIssuesByStates: vi.fn(async () => []),
    resolveStateId: vi.fn(async () => "state-1"),
    updateIssueState: vi.fn(async () => undefined),
    createComment: vi.fn(async () => undefined),
    createIssue: vi.fn(async () => ({ id: "x", identifier: "X-1", url: "" })),
    transitionIssue: vi.fn(async () => ({ success: true })),
    provision: vi.fn(),
    ...overrides,
  } as unknown as TrackerPort;
}

function ctx(now: () => number = () => 0) {
  return { signal: new AbortController().signal, nowMs: now };
}

describe("LinearProbe", () => {
  it("returns ok for both subprobes on the happy path", async () => {
    const probe = new LinearProbe({ tracker: tracker(), activeStateName: () => "In Progress" });
    const subprobes = await probe.run(ctx());
    expect(subprobes.map((s) => s.name)).toEqual(["workflow_states", "issues"]);
    expect(subprobes.every((s) => s.status === "ok")).toBe(true);
  });

  it("flags missing workflow state as config_drift", async () => {
    const probe = new LinearProbe({
      tracker: tracker({ resolveStateId: vi.fn(async () => null) }),
      activeStateName: () => "In Progress",
    });
    const subprobes = await probe.run(ctx());
    const wf = subprobes.find((s) => s.name === "workflow_states")!;
    expect(wf.status).toBe("down");
    expect(wf.failureKind).toBe("config_drift");
  });

  it("classifies HTTP 401 as auth_failure", async () => {
    const probe = new LinearProbe({
      tracker: tracker({
        fetchCandidateIssues: vi.fn(async () => {
          throw new Error("Linear API responded 401: unauthorized");
        }),
      }),
      activeStateName: () => "In Progress",
    });
    const subprobes = await probe.run(ctx());
    const issues = subprobes.find((s) => s.name === "issues")!;
    expect(issues.status).toBe("down");
    expect(issues.failureKind).toBe("auth_failure");
  });

  it("classifies HTTP 404 as config_drift", async () => {
    const probe = new LinearProbe({
      tracker: tracker({
        fetchCandidateIssues: vi.fn(async () => {
          throw new Error("project not found (404)");
        }),
      }),
      activeStateName: () => "In Progress",
    });
    const subprobes = await probe.run(ctx());
    const issues = subprobes.find((s) => s.name === "issues")!;
    expect(issues.status).toBe("down");
    expect(issues.failureKind).toBe("config_drift");
  });

  it("classifies HTTP 429 as rate_limited", async () => {
    const probe = new LinearProbe({
      tracker: tracker({
        fetchCandidateIssues: vi.fn(async () => {
          throw new Error("Linear 429 too many requests");
        }),
      }),
      activeStateName: () => "In Progress",
    });
    const subprobes = await probe.run(ctx());
    const issues = subprobes.find((s) => s.name === "issues")!;
    expect(issues.failureKind).toBe("rate_limited");
  });

  it("classifies HTTP 5xx as remote_error", async () => {
    const probe = new LinearProbe({
      tracker: tracker({
        fetchCandidateIssues: vi.fn(async () => {
          throw new Error("Linear API 503 Service Unavailable");
        }),
      }),
      activeStateName: () => "In Progress",
    });
    const subprobes = await probe.run(ctx());
    const issues = subprobes.find((s) => s.name === "issues")!;
    expect(issues.failureKind).toBe("remote_error");
  });

  it("classifies network error keywords as unreachable", async () => {
    const probe = new LinearProbe({
      tracker: tracker({
        fetchCandidateIssues: vi.fn(async () => {
          throw new Error("fetch failed: ECONNREFUSED");
        }),
      }),
      activeStateName: () => "In Progress",
    });
    const subprobes = await probe.run(ctx());
    const issues = subprobes.find((s) => s.name === "issues")!;
    expect(issues.failureKind).toBe("unreachable");
  });

  it("treats reachable + empty issue list as ok", async () => {
    const probe = new LinearProbe({
      tracker: tracker({ fetchCandidateIssues: vi.fn(async () => []) }),
      activeStateName: () => "In Progress",
    });
    const subprobes = await probe.run(ctx());
    const issues = subprobes.find((s) => s.name === "issues")!;
    expect(issues.status).toBe("ok");
    expect(issues.detail).toContain("0 candidate");
  });

  it("returns unknown for workflow_states when no active state is configured", async () => {
    const probe = new LinearProbe({ tracker: tracker(), activeStateName: () => null });
    const subprobes = await probe.run(ctx());
    const wf = subprobes.find((s) => s.name === "workflow_states")!;
    expect(wf.status).toBe("unknown");
  });
});
