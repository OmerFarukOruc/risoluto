import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRunLifecycleCoordinator,
  type OrchestratorState,
} from "../../src/orchestrator/run-lifecycle-coordinator.js";
import type { OrchestratorDeps } from "../../src/orchestrator/runtime-types.js";
import type { AttemptRecord, RecentEvent, RunOutcome } from "../../src/core/types.js";
import {
  createIssue,
  createConfig,
  createConfigStore,
  createAttemptStore,
  createIssueConfigStore,
  createLogger,
  createResolveTemplate,
  passThroughWithLock,
} from "./orchestrator-fixtures.js";
import { createCompletedView, createDetailView, createRunningEntry, createWorkspace } from "./issue-test-factories.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeState(overrides: Partial<OrchestratorState> = {}): OrchestratorState {
  return {
    running: true,
    runningEntries: new Map(),
    retryEntries: new Map(),
    completedViews: new Map(),
    detailViews: new Map(),
    claimedIssueIds: new Set(),
    queuedViews: [],
    recentEvents: [],
    rateLimits: null,
    issueModelOverrides: new Map(),
    issueTemplateOverrides: new Map(),
    sessionUsageTotals: new Map(),
    codexTotals: { inputTokens: 0, outputTokens: 0, totalTokens: 0, secondsRunning: 0 },
    stallEvents: [],
    markDirty: vi.fn(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
  const config = createConfig();
  return {
    attemptStore: createAttemptStore(),
    configStore: createConfigStore(config),
    tracker: {
      fetchCandidateIssues: vi.fn(async () => []),
      fetchIssueStatesByIds: vi.fn(async () => []),
      fetchIssuesByStates: vi.fn(async () => []),
    } as never,
    workspaceManager: {
      ensureWorkspace: vi.fn(async (identifier: string) => ({
        path: `/tmp/risoluto/${identifier}`,
        workspaceKey: identifier,
        createdNow: true,
      })),
      removeWorkspace: vi.fn(async () => undefined),
      withLock: passThroughWithLock,
    } as never,
    agentRunner: {
      runAttempt: vi.fn(
        async (): Promise<RunOutcome> => ({
          kind: "failed",
          errorCode: "turn_failed",
          errorMessage: "boom",
          threadId: null,
          turnId: null,
          turnCount: 1,
        }),
      ),
    } as never,
    issueConfigStore: createIssueConfigStore(),
    logger: createLogger(),
    resolveTemplate: createResolveTemplate(),
    ...overrides,
  };
}

async function flushLifecycleWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("RunLifecycleCoordinator", () => {
  it("drives launch, retry, and relaunch through one runtime boundary", async () => {
    vi.useFakeTimers();
    const issue = createIssue();
    const state = makeState();
    const agentRunner = {
      runAttempt: vi.fn(
        async (): Promise<RunOutcome> => ({
          kind: "failed",
          errorCode: "turn_failed",
          errorMessage: "boom",
          threadId: null,
          turnId: null,
          turnCount: 1,
        }),
      ),
    } as OrchestratorDeps["agentRunner"];
    const tracker = {
      fetchCandidateIssues: vi.fn(async () => [issue]),
      fetchIssueStatesByIds: vi.fn(async () => [issue]),
      fetchIssuesByStates: vi.fn(async () => []),
    } as OrchestratorDeps["tracker"];
    const coordinator = createRunLifecycleCoordinator(
      state,
      makeDeps({
        tracker,
        agentRunner,
      }),
    );

    await coordinator.launchAvailableWorkers([issue]);
    await flushLifecycleWork();

    expect(agentRunner.runAttempt).toHaveBeenCalledTimes(1);
    expect(state.runningEntries.size).toBe(0);
    expect(state.detailViews.get(issue.identifier)).toMatchObject({
      identifier: issue.identifier,
      status: "failed",
      attempt: 1,
      error: "boom",
    });
    expect(state.retryEntries.get(issue.id)).toMatchObject({
      identifier: issue.identifier,
      attempt: 2,
      error: "turn_failed",
    });

    await vi.advanceTimersByTimeAsync(20_000);
    await flushLifecycleWork();

    expect(agentRunner.runAttempt).toHaveBeenCalledTimes(2);
    expect(state.retryEntries.get(issue.id)).toMatchObject({
      identifier: issue.identifier,
      attempt: 3,
      error: "turn_failed",
    });

    coordinator.getContext().retryCoordinator.cancel(issue.id);
  });

  it("projects snapshot and issue detail through the coordinator read-model boundary", () => {
    const issue = createIssue("Done");
    const attemptStore = createAttemptStore();
    const state = makeState({
      completedViews: new Map([
        [
          issue.identifier,
          createCompletedView({
            issueId: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            state: issue.state,
          }),
        ],
      ]),
      detailViews: new Map([
        [
          issue.identifier,
          createDetailView({
            issueId: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            state: issue.state,
            status: "completed",
          }),
        ],
      ]),
      stallEvents: [
        {
          at: "2026-04-14T10:50:00.000Z",
          issueId: issue.id,
          issueIdentifier: issue.identifier,
          silentMs: 120_000,
          timeoutMs: 60_000,
        },
      ],
      issueTemplateOverrides: new Map([[issue.identifier, "template-1"]]),
    });

    const coordinator = createRunLifecycleCoordinator(
      state,
      makeDeps({
        attemptStore,
        templateStore: {
          get: vi.fn((templateId: string) =>
            templateId === "template-1" ? { id: templateId, name: "Release template" } : null,
          ),
        } as never,
      }),
      {
        getSystemHealth: () => ({
          status: "healthy",
          checkedAt: "2026-04-14T10:51:00.000Z",
          runningCount: 0,
          message: "all clear",
        }),
      },
    );

    const snapshot = coordinator.buildSnapshot();
    const detail = coordinator.buildIssueDetail(issue.identifier);
    expect(snapshot.completed).toEqual([
      expect.objectContaining({
        identifier: issue.identifier,
        title: issue.title,
        status: "completed",
      }),
    ]);
    expect(snapshot.stallEvents).toEqual([
      expect.objectContaining({
        issueId: issue.id,
        issueIdentifier: issue.identifier,
      }),
    ]);
    expect(snapshot.systemHealth).toEqual(
      expect.objectContaining({
        status: "healthy",
        runningCount: 0,
      }),
    );
    expect(detail).toEqual(
      expect.objectContaining({
        identifier: issue.identifier,
        configuredTemplateId: "template-1",
        configuredTemplateName: "Release template",
      }),
    );
  });

  it("projects attempt detail through the coordinator read-model boundary", () => {
    const attempt: AttemptRecord = {
      attemptId: "attempt-1",
      issueId: "issue-1",
      issueIdentifier: "MT-42",
      title: "Retry me",
      workspaceKey: "MT-42",
      workspacePath: "/tmp/risoluto/MT-42",
      status: "completed",
      attemptNumber: 1,
      startedAt: "2026-03-15T00:00:00Z",
      endedAt: "2026-03-15T00:01:00Z",
      model: "gpt-5.4",
      reasoningEffort: "high",
      modelSource: "default",
      threadId: "thread-1",
      turnId: "turn-1",
      turnCount: 3,
      errorCode: null,
      errorMessage: null,
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      summary: "Implemented the requested change.",
      stopSignal: "done",
      pullRequestUrl: "https://github.com/org/repo/pull/99",
    };
    const events: RecentEvent[] = [
      {
        at: "2026-03-15T00:00:30Z",
        issueId: "issue-1",
        issueIdentifier: "MT-42",
        sessionId: "session-1",
        event: "codex_config_loaded",
        message: "Codex config loaded",
        metadata: {
          modelProvider: "cliproxyapi",
          model: "gpt-5.4",
          reasoningEffort: "high",
          approvalPolicy: "never",
        },
      },
      {
        at: "2026-03-15T00:00:45Z",
        issueId: "issue-1",
        issueIdentifier: "MT-42",
        sessionId: "session-1",
        event: "thread_status",
        message: "Thread status updated",
        metadata: {
          threadStatus: { type: "active", activeFlags: ["waitingOnApproval"] },
        },
      },
    ];
    const attemptStore = createAttemptStore();
    vi.mocked(attemptStore.getAttempt).mockImplementation((attemptId: string) =>
      attemptId === attempt.attemptId ? attempt : null,
    );
    vi.mocked(attemptStore.getEvents).mockImplementation((attemptId: string) =>
      attemptId === attempt.attemptId ? events : [],
    );
    const coordinator = createRunLifecycleCoordinator(makeState(), makeDeps({ attemptStore }));

    const detail = coordinator.buildAttemptDetail(attempt.attemptId);

    expect(detail).toEqual(
      expect.objectContaining({
        attemptId: "attempt-1",
        summary: "Implemented the requested change.",
        events,
        appServerBadge: {
          effectiveProvider: "cliproxyapi",
          threadStatus: "active",
        },
        appServer: expect.objectContaining({
          approvalPolicy: "never",
          threadStatusPayload: { type: "active", activeFlags: ["waitingOnApproval"] },
        }),
      }),
    );
  });

  it("projects running issue detail with archived enrichment through the coordinator read-model boundary", () => {
    const issue = createIssue();
    const entry = createRunningEntry({
      issue,
      workspace: createWorkspace(),
      runId: "run-42",
      tokenUsage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
    });
    const archivedAttempt: AttemptRecord = {
      attemptId: "attempt-1",
      issueId: issue.id,
      issueIdentifier: issue.identifier,
      title: issue.title,
      workspaceKey: entry.workspace.workspaceKey,
      workspacePath: entry.workspace.path,
      status: "completed",
      attemptNumber: 1,
      startedAt: "2026-03-15T00:00:00Z",
      endedAt: "2026-03-15T00:01:00Z",
      model: "gpt-5.4",
      reasoningEffort: "high",
      modelSource: "default",
      threadId: "thread-1",
      turnId: "turn-1",
      turnCount: 1,
      errorCode: null,
      errorMessage: null,
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      summary: null,
      stopSignal: "done",
      pullRequestUrl: null,
    };
    const liveEvent: RecentEvent = {
      at: "2026-03-15T00:00:30Z",
      issueId: issue.id,
      issueIdentifier: issue.identifier,
      sessionId: "session-1",
      event: "worker_started",
      message: "Worker started",
    };
    const attemptStore = createAttemptStore();
    vi.mocked(attemptStore.getAttemptsForIssue).mockReturnValue([archivedAttempt]);
    vi.mocked(attemptStore.getEvents).mockImplementation((attemptId: string) =>
      attemptId === entry.runId ? [liveEvent] : [],
    );
    const state = makeState({
      runningEntries: new Map([[issue.id, entry]]),
      issueTemplateOverrides: new Map([[issue.identifier, "template-1"]]),
    });
    const coordinator = createRunLifecycleCoordinator(
      state,
      makeDeps({
        attemptStore,
        templateStore: {
          get: vi.fn((templateId: string) =>
            templateId === "template-1" ? { id: templateId, name: "Release template" } : null,
          ),
        } as never,
      }),
    );

    const detail = coordinator.buildIssueDetail(issue.identifier);

    expect(detail).toEqual(
      expect.objectContaining({
        identifier: issue.identifier,
        status: "running",
        currentAttemptId: "run-42",
        recentEvents: [liveEvent],
        tokenUsage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
        configuredTemplateId: "template-1",
        configuredTemplateName: "Release template",
      }),
    );
    expect(detail?.attempts).toEqual([expect.objectContaining({ attemptId: "attempt-1" })]);
  });

  it("projects completed issue detail and reuses archived event lookups through the coordinator read-model boundary", () => {
    const issue = createIssue("Done");
    const attempt1: AttemptRecord = {
      attemptId: "attempt-1",
      issueId: issue.id,
      issueIdentifier: issue.identifier,
      title: issue.title,
      workspaceKey: "MT-42",
      workspacePath: "/tmp/risoluto/MT-42",
      status: "completed",
      attemptNumber: 1,
      startedAt: "2026-03-15T00:00:00Z",
      endedAt: "2026-03-15T00:01:00Z",
      model: "gpt-5.4",
      reasoningEffort: "high",
      modelSource: "default",
      threadId: "thread-1",
      turnId: "turn-1",
      turnCount: 1,
      errorCode: null,
      errorMessage: null,
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      summary: null,
      stopSignal: "done",
      pullRequestUrl: null,
    };
    const attempt2: AttemptRecord = {
      ...attempt1,
      attemptId: "attempt-2",
      attemptNumber: 2,
      threadId: "thread-2",
      turnId: "turn-2",
    };
    const eventsByAttempt = new Map<string, RecentEvent[]>([
      [
        "attempt-1",
        [
          {
            at: "2026-03-15T00:00:15Z",
            issueId: issue.id,
            issueIdentifier: issue.identifier,
            sessionId: "session-1",
            event: "worker_started",
            message: "Worker started",
          },
        ],
      ],
      [
        "attempt-2",
        [
          {
            at: "2026-03-15T00:01:15Z",
            issueId: issue.id,
            issueIdentifier: issue.identifier,
            sessionId: "session-2",
            event: "worker_finished",
            message: "Worker finished",
          },
        ],
      ],
    ]);
    const attemptStore = createAttemptStore();
    vi.mocked(attemptStore.getAttemptsForIssue).mockReturnValue([attempt1, attempt2]);
    vi.mocked(attemptStore.getEvents).mockImplementation((attemptId: string) => eventsByAttempt.get(attemptId) ?? []);
    const state = makeState({
      completedViews: new Map([
        [
          issue.identifier,
          createCompletedView({
            issueId: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            state: issue.state,
            attempt: 2,
          }),
        ],
      ]),
    });
    const coordinator = createRunLifecycleCoordinator(state, makeDeps({ attemptStore }));

    const detail = coordinator.buildIssueDetail(issue.identifier);

    expect(detail).toEqual(
      expect.objectContaining({
        identifier: issue.identifier,
        currentAttemptId: null,
        recentEvents: [...(eventsByAttempt.get("attempt-1") ?? []), ...(eventsByAttempt.get("attempt-2") ?? [])],
      }),
    );
    expect(detail?.attempts).toEqual([
      expect.objectContaining({ attemptId: "attempt-1" }),
      expect.objectContaining({ attemptId: "attempt-2" }),
    ]);
    expect(attemptStore.getEvents).toHaveBeenCalledTimes(2);
    expect(attemptStore.getEvents).toHaveBeenNthCalledWith(1, "attempt-1");
    expect(attemptStore.getEvents).toHaveBeenNthCalledWith(2, "attempt-2");
  });

  it("projects queued issue detail from live recent events without archive enrichment", () => {
    const issue = createIssue();
    const matchingEvent: RecentEvent = {
      at: "2026-03-15T00:00:30Z",
      issueId: issue.id,
      issueIdentifier: issue.identifier,
      sessionId: "session-1",
      event: "worker_started",
      message: "Worker started",
    };
    const ignoredEvent: RecentEvent = {
      ...matchingEvent,
      issueIdentifier: "MT-99",
      event: "worker_finished",
      message: "Worker finished elsewhere",
    };
    const state = makeState({
      detailViews: new Map([
        [
          issue.identifier,
          createDetailView({
            issueId: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            state: issue.state,
            status: "queued",
          }),
        ],
      ]),
      recentEvents: [matchingEvent, ignoredEvent],
    });
    const coordinator = createRunLifecycleCoordinator(state, makeDeps());

    const detail = coordinator.buildIssueDetail(issue.identifier);

    expect(detail).toEqual(
      expect.objectContaining({
        identifier: issue.identifier,
        status: "queued",
        recentEvents: [matchingEvent],
      }),
    );
    expect(detail?.startedAt).toBeUndefined();
    expect(detail?.tokenUsage).toBeUndefined();
  });
});
