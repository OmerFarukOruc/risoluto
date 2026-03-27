/**
 * Gateway parity suite — RunAttemptDispatcher contract tested end-to-end
 * through the HTTP adapter (DispatchClient) using a minimal test data plane
 * and fake in-memory runner. No Docker, no Codex, no disk reads.
 *
 * Contract guarantees verified:
 *   - events emitted by the runner are forwarded to the caller's onEvent
 *   - the final RunOutcome is returned unchanged through the SSE stream
 *   - aborting the caller's signal is forwarded to the data plane runner
 *   - runner errors surface as failed outcomes (not unhandled rejections)
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import express from "express";
import { DispatchClient } from "../../src/dispatch/client.js";
import type { RunAttemptDispatcher, DispatchRequest, DispatchStreamMessage } from "../../src/dispatch/types.js";
import type { AgentRunnerEventHandler } from "../../src/agent-runner/contracts.js";
import type { RunOutcome, Issue, ModelSelection, Workspace, ServiceConfig } from "../../src/core/types.js";

vi.mock("../../src/codex/runtime-config.js", () => ({
  prepareCodexRuntimeConfig: vi.fn().mockResolvedValue({
    configToml: 'model = "test-model"\n',
    authJsonBase64: null,
  }),
  getRequiredProviderEnvNames: vi.fn().mockReturnValue([]),
}));

// ---------------------------------------------------------------------------
// Minimal test data plane
// Implements the dispatch SSE protocol with an injected runner so tests can
// control exactly what the "data plane" returns without needing Docker/Codex.
// ---------------------------------------------------------------------------

interface TestDataPlane {
  url: string;
  close: () => Promise<void>;
}

function createTestDataPlane(runner: RunAttemptDispatcher, secret: string): Promise<TestDataPlane> {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  const activeRuns = new Map<string, AbortController>();

  app.post("/dispatch", (req, res) => {
    if (req.headers.authorization !== `Bearer ${secret}`) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const body = req.body as DispatchRequest;
    const runId = body.issue.id;
    const abortController = new AbortController();
    activeRuns.set(runId, abortController);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders();

    const sendSSE = (message: DispatchStreamMessage) => {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    };

    const onEvent: AgentRunnerEventHandler = (event) => {
      sendSSE({ type: "event", payload: event });
    };

    runner
      .runAttempt({
        issue: body.issue,
        attempt: body.attempt,
        modelSelection: body.modelSelection,
        promptTemplate: body.promptTemplate,
        workspace: body.workspace,
        signal: abortController.signal,
        onEvent,
      })
      .then((outcome) => {
        sendSSE({ type: "outcome", payload: outcome });
      })
      .catch((error: unknown) => {
        sendSSE({
          type: "outcome",
          payload: {
            kind: "failed",
            errorCode: "runner_error",
            errorMessage: String(error),
            threadId: null,
            turnId: null,
            turnCount: 0,
          },
        });
      })
      .finally(() => {
        activeRuns.delete(runId);
        res.end();
      });
  });

  app.post("/dispatch/:runId/abort", (req, res) => {
    if (req.headers.authorization !== `Bearer ${secret}`) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const runId = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;
    const controller = activeRuns.get(runId);
    if (!controller) {
      res.status(404).json({ error: "run not found" });
      return;
    }
    controller.abort();
    res.json({ status: "aborted" });
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        reject(new TypeError("Failed to get server address"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const mockIssue: Issue = {
  id: "parity-test-id",
  identifier: "PAR-1",
  title: "Parity Test Issue",
  description: "desc",
  priority: 1,
  state: "active",
  branchName: null,
  url: "https://linear.app/test/PAR-1",
  labels: [],
  blockedBy: [],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockModelSelection: ModelSelection = { model: "test-model", reasoningEffort: null, source: "default" };
const mockWorkspace: Workspace = { path: "/tmp/workspaces/PAR-1", workspaceKey: "PAR-1", createdNow: false };
const mockConfig = {
  tracker: {
    kind: "linear",
    apiKey: "t",
    endpoint: "https://api.linear.app",
    projectSlug: "t",
    activeStates: [],
    terminalStates: [],
  },
  polling: { intervalMs: 30000 },
  workspace: {
    root: "/tmp/workspaces",
    hooks: { afterCreate: null, beforeRun: null, afterRun: null, beforeRemove: null, timeoutMs: 30000 },
  },
  agent: {
    maxConcurrentAgents: 3,
    maxConcurrentAgentsByState: {},
    maxTurns: 50,
    maxRetryBackoffMs: 60000,
    maxContinuationAttempts: 5,
    successState: null,
    stallTimeoutMs: 60000,
  },
  codex: {
    command: "codex",
    model: "test-model",
    reasoningEffort: null,
    approvalPolicy: "suggest",
    threadSandbox: "none",
    turnSandboxPolicy: { type: "none" },
    readTimeoutMs: 30000,
    turnTimeoutMs: 300000,
    drainTimeoutMs: 5000,
    startupTimeoutMs: 60000,
    stallTimeoutMs: 60000,
    auth: { mode: "api_key", sourceHome: "/tmp" },
    provider: null,
    sandbox: {
      image: "test",
      network: "none",
      security: { noNewPrivileges: true, dropCapabilities: true, gvisor: false, seccompProfile: "" },
      resources: { memory: "1g", memoryReservation: "512m", memorySwap: "2g", cpus: "1", tmpfsSize: "100m" },
      extraMounts: [],
      envPassthrough: [],
      logs: { driver: "json-file", maxSize: "10m", maxFile: 3 },
      egressAllowlist: [],
    },
  },
  server: { port: 4000 },
} as unknown as ServiceConfig;

const createMockLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
});

const SECRET = "parity-test-secret";

function createClient(url: string) {
  return new DispatchClient({
    dispatchUrl: `${url}/dispatch`,
    secret: SECRET,
    getConfig: () => mockConfig,
    logger: createMockLogger() as unknown as ReturnType<typeof import("../../src/core/logger.js").createLogger>,
  });
}

const baseInput = {
  issue: mockIssue,
  attempt: 1 as number | null,
  modelSelection: mockModelSelection,
  promptTemplate: "Test prompt",
  workspace: mockWorkspace,
};

// ---------------------------------------------------------------------------
// Parity tests
// ---------------------------------------------------------------------------

describe("RunAttemptDispatcher contract (HTTP gateway parity)", () => {
  let dataPlane: TestDataPlane;

  afterEach(async () => {
    await dataPlane.close();
  });

  it("forwards all runner events to the caller via SSE", async () => {
    type EventParam = Parameters<AgentRunnerEventHandler>[0];
    const event1 = {
      at: "2024-01-01T00:00:00Z",
      issueId: "parity-test-id",
      issueIdentifier: "PAR-1",
      sessionId: null,
      event: "status",
      message: "starting",
    } as EventParam;
    const event2 = { ...event1, message: "running" } as EventParam;

    const normalOutcome: RunOutcome = {
      kind: "normal",
      errorCode: null,
      errorMessage: null,
      threadId: "thread-1",
      turnId: "turn-1",
      turnCount: 3,
    };

    const fakeRunner: RunAttemptDispatcher = {
      async runAttempt(input) {
        input.onEvent(event1);
        input.onEvent(event2);
        return normalOutcome;
      },
    };

    dataPlane = await createTestDataPlane(fakeRunner, SECRET);
    const client = createClient(dataPlane.url);

    const receivedEvents: unknown[] = [];
    const outcome = await client.runAttempt({
      ...baseInput,
      signal: new AbortController().signal,
      onEvent: (event) => receivedEvents.push(event),
    });

    expect(receivedEvents).toHaveLength(2);
    expect(receivedEvents[0]).toMatchObject({ event: "status", message: "starting" });
    expect(receivedEvents[1]).toMatchObject({ event: "status", message: "running" });
    expect(outcome).toEqual(normalOutcome);
  });

  it("returns the runner outcome unchanged through the SSE stream", async () => {
    const failedOutcome: RunOutcome = {
      kind: "failed",
      errorCode: "agent_error",
      errorMessage: "something went wrong",
      threadId: "thread-2",
      turnId: "turn-2",
      turnCount: 5,
    };

    const fakeRunner: RunAttemptDispatcher = {
      async runAttempt() {
        return failedOutcome;
      },
    };

    dataPlane = await createTestDataPlane(fakeRunner, SECRET);
    const client = createClient(dataPlane.url);

    const outcome = await client.runAttempt({
      ...baseInput,
      signal: new AbortController().signal,
      onEvent: vi.fn(),
    });

    expect(outcome).toEqual(failedOutcome);
  });

  it("forwards abort signal from caller to the data plane runner", async () => {
    let runnerSignal: AbortSignal | null = null;
    let resolveRunnerStarted!: () => void;
    const runnerStarted = new Promise<void>((resolve) => {
      resolveRunnerStarted = resolve;
    });

    const fakeRunner: RunAttemptDispatcher = {
      async runAttempt(input) {
        runnerSignal = input.signal;
        resolveRunnerStarted();
        await new Promise<void>((resolve) => {
          if (input.signal.aborted) {
            resolve();
            return;
          }
          input.signal.addEventListener("abort", resolve, { once: true });
        });
        return {
          kind: "cancelled",
          errorCode: "operator_abort",
          errorMessage: "worker cancelled by operator request",
          threadId: null,
          turnId: null,
          turnCount: 0,
        };
      },
    };

    dataPlane = await createTestDataPlane(fakeRunner, SECRET);
    const client = createClient(dataPlane.url);

    const abortController = new AbortController();
    const runPromise = client.runAttempt({
      ...baseInput,
      signal: abortController.signal,
      onEvent: vi.fn(),
    });

    // Wait until the server is actually running the fake runner, then abort.
    // This ensures the abort POST reaches an active run (not a 404).
    await runnerStarted;
    abortController.abort("operator_abort");

    // DispatchClient waits for the abort POST to complete before returning.
    // By the time runPromise resolves, the server has already called
    // abortController.abort() on the runner's signal.
    await runPromise;

    expect(runnerSignal?.aborted).toBe(true);
  });

  it("surfaces runner errors as failed outcomes (no unhandled rejections)", async () => {
    const fakeRunner: RunAttemptDispatcher = {
      async runAttempt() {
        throw new Error("runner exploded");
      },
    };

    dataPlane = await createTestDataPlane(fakeRunner, SECRET);
    const client = createClient(dataPlane.url);

    const outcome = await client.runAttempt({
      ...baseInput,
      signal: new AbortController().signal,
      onEvent: vi.fn(),
    });

    expect(outcome.kind).toBe("failed");
    expect((outcome as { errorCode: string }).errorCode).toBe("runner_error");
    expect((outcome as { errorMessage: string }).errorMessage).toContain("runner exploded");
  });
});
