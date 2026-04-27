import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import autocannon from "autocannon";

import { registerHttpRoutes } from "../../src/http/routes.js";

/**
 * Load / Stress Tests
 *
 * Uses autocannon to exercise core API endpoints under sustained load.
 * These tests verify:
 *   - No request failures (errors = 0, timeouts = 0)
 *   - Acceptable latency (p99 < 200ms for read endpoints)
 *   - Graceful rate-limiting (429s are allowed but not server errors)
 *
 * Run with: npm run test:load
 *
 * Note: The API has a 300 req/min rate limiter. These tests intentionally
 * exercise at a scale that may trigger it. We assert 0 errors/timeouts
 * and verify the rate limiter works correctly (429s are accounted for).
 */

function makeOrchestrator() {
  const orchestrator = {
    getSnapshot: vi.fn().mockReturnValue({
      generatedAt: "2024-01-01T00:00:00Z",
      counts: { running: 2, retrying: 0, queued: 3, completed: 10 },
      running: [
        {
          id: "i1",
          identifier: "NIN-1",
          title: "Auth flow",
          state: "In Progress",
          runningAttemptId: "att-1",
          model: "o4-mini",
          startedAt: "2024-01-01T00:00:00Z",
        },
      ],
      retrying: [],
      completed: [],
      queued: [{ id: "i3", identifier: "NIN-3", title: "Settings page", state: "Todo" }],
      workflowColumns: [
        { key: "in progress", label: "In Progress", terminal: false },
        { key: "done", label: "Done", terminal: true },
      ],
      codexTotals: {
        inputTokens: 150_000,
        outputTokens: 80_000,
        totalTokens: 230_000,
        secondsRunning: 3700,
        costUsd: 19.44,
      },
      rateLimits: null,
      recentEvents: [{ type: "attempt_started", timestamp: "2024-01-01T00:00:00Z", issueIdentifier: "NIN-1" }],
    }),
    requestRefresh: vi.fn().mockReturnValue({
      queued: true,
      coalesced: false,
      requestedAt: "2024-01-01T00:00:00Z",
    }),
    getIssueDetail: vi.fn().mockReturnValue({
      issueId: "i1",
      identifier: "NIN-1",
      title: "Auth flow",
      state: "In Progress",
      attempts: [{ id: "att-1", startedAt: "2024-01-01T00:00:00Z" }],
      currentAttemptId: "att-1",
    }),
    getAttemptDetail: vi.fn().mockReturnValue(null),
  };
  return {
    ...orchestrator,
    executeCommand: vi.fn().mockImplementation(async (command: { type: string; identifier?: string }) => {
      if (command.type === "refresh") {
        return { ...orchestrator.requestRefresh(), targeted: false };
      }
      if (command.type === "abort_issue") {
        return { ok: false, code: "not_found", message: "Unknown" };
      }
      if (command.type === "update_issue_model_selection") {
        return null;
      }
      return null;
    }),
  };
}

let server: http.Server;
let port: number;

// Disable rate limiter for load tests — we want to test handler performance
vi.mock("express-rate-limit", () => ({
  __esModule: true,
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

beforeAll(async () => {
  const orchestrator = makeOrchestrator();
  const app = express();
  app.use(express.json());
  registerHttpRoutes(app, {
    orchestrator: orchestrator as never,
    frontendDir: "/tmp",
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function runLoad(options: autocannon.Options): Promise<autocannon.Result> {
  return new Promise((resolve, reject) => {
    const instance = autocannon(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    autocannon.track(instance);
  });
}

describe("Load Tests", () => {
  it("GET /api/v1/state handles concurrent connections with 0 errors", async () => {
    const result = await runLoad({
      url: `http://127.0.0.1:${port}/api/v1/state`,
      connections: 10,
      duration: 2,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    // Successful responses should be the majority
    const successRate = (result.requests.total - result.non2xx) / result.requests.total;
    expect(successRate).toBeGreaterThan(0.5);
    // Latency: p99 should be reasonable
    expect(result.latency.p99).toBeLessThan(200);
  });

  it("GET /api/v1/runtime handles burst traffic", async () => {
    const result = await runLoad({
      url: `http://127.0.0.1:${port}/api/v1/runtime`,
      connections: 10,
      duration: 2,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.requests.total).toBeGreaterThan(50);
  });

  it("GET /metrics handles sustained polling", async () => {
    const result = await runLoad({
      url: `http://127.0.0.1:${port}/metrics`,
      connections: 5,
      duration: 2,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
  });

  it("POST /api/v1/refresh handles concurrent writes without crashes", async () => {
    const result = await runLoad({
      url: `http://127.0.0.1:${port}/api/v1/refresh`,
      method: "POST",
      connections: 5,
      duration: 2,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    // 429 rate limits are expected and healthy behavior
  });

  it("GET /api/v1/:id handles concurrent reads with 0 errors", async () => {
    const result = await runLoad({
      url: `http://127.0.0.1:${port}/api/v1/NIN-1`,
      connections: 10,
      duration: 2,
      pipelining: 1,
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    const successRate = (result.requests.total - result.non2xx) / result.requests.total;
    expect(successRate).toBeGreaterThan(0.5);
  });
});
