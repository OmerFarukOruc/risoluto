import type {
  Issue,
  RuntimeSnapshot,
  RunOutcome,
  RuntimeIssueView,
  SystemHealth,
  TokenUsageSnapshot,
  Workspace,
} from "../core/types.js";
import type { RuntimeEventRecord } from "../core/lifecycle-events.js";
import type { NotificationEvent } from "../notification/channel.js";
import type { OrchestratorDeps, RunningEntry } from "./runtime-types.js";
import type { OrchestratorContext } from "./context.js";
import { buildOutcomeView as buildProjectedOutcomeView, createRuntimeReadModelFromState } from "./snapshot-builder.js";
import type { AttemptDetailView, IssueDetailView, OutcomeViewInput, RuntimeReadModel } from "./snapshot-builder.js";

import { resolveModelSelection as resolveModelSelectionFromConfig } from "./model-selection.js";
import { createRetryCoordinator } from "./retry-coordinator.js";
import {
  applyUsageEventInState,
  claimIssueInState,
  deleteRetryEntryInState,
  deleteRunningEntryInState,
  MAX_RECENT_EVENTS,
  pushRecentEventInState,
  releaseIssueClaimInState,
  setCompletedViewInState,
  setDetailViewInState,
  setQueuedViewsInState,
  setRateLimitsInState,
  setRetryEntryInState,
  setRunningEntryInState,
  type LifecycleState,
} from "./core/lifecycle-state.js";
import {
  reconcileRunningAndRetrying as reconcileRunningAndRetryingState,
  refreshQueueViews as refreshQueueViewsState,
  cleanupTerminalIssueWorkspaces as cleanupTerminalIssueWorkspacesState,
} from "./lifecycle.js";
import {
  canDispatchIssue as canDispatchIssueState,
  hasAvailableStateSlot as hasAvailableStateSlotState,
  launchAvailableWorkers as launchAvailableWorkersState,
  launchWorker as launchWorkerState,
  buildIssueDispatchFingerprint,
} from "./worker-launcher.js";
import { handleWorkerFailure } from "./worker-failure.js";
import { handleWorkerOutcome } from "./worker-outcome/index.js";
import { detectAndKillStalledWorkers } from "./stall-detector.js";
import { createMetricsCollector } from "../observability/metrics.js";
import { toErrorString } from "../utils/type-guards.js";

export interface RunLifecycleCoordinator {
  getContext(): OrchestratorContext;
  cleanupTerminalWorkspaces(): Promise<void>;
  reconcileRunningAndRetrying(): Promise<boolean>;
  refreshQueueViews(candidateIssues?: Issue[]): Promise<void>;
  launchAvailableWorkers(candidateIssues?: Issue[]): Promise<void>;
  buildSnapshot(): RuntimeSnapshot;
  buildIssueDetail(identifier: string): IssueDetailView | null;
  buildAttemptDetail(attemptId: string): AttemptDetailView | null;
}

export type OrchestratorState = LifecycleState;

export interface RunLifecycleReadModelDeps {
  getSystemHealth?: () => SystemHealth | null;
}

export function createRunLifecycleCoordinator(
  state: OrchestratorState,
  deps: OrchestratorDeps,
  readModelDeps: RunLifecycleReadModelDeps = {},
): RunLifecycleCoordinator {
  return new RunLifecycleCoordinatorImpl(state, deps, readModelDeps);
}

class RunLifecycleCoordinatorImpl implements RunLifecycleCoordinator {
  private readonly ctx: OrchestratorContext;
  private readonly readModel: RuntimeReadModel;

  constructor(
    private readonly state: OrchestratorState,
    private readonly deps: OrchestratorDeps,
    private readonly readModelDeps: RunLifecycleReadModelDeps,
  ) {
    this.ctx = this.buildContext();
    this.readModel = createRuntimeReadModelFromState(
      { attemptStore: deps.attemptStore },
      {
        state: this.state,
        getConfig: () => this.deps.configStore.getConfig(),
        resolveModelSelection: (identifier: string) => this.ctx.resolveModelSelection(identifier),
        getSystemHealth: () => this.readModelDeps.getSystemHealth?.() ?? null,
        getTemplateName: (templateId: string) => this.deps.templateStore?.get(templateId)?.name ?? null,
        getWebhookHealth: () => {
          const tracker = this.deps.webhookHealthTracker;
          if (!tracker) {
            return undefined;
          }
          const health = tracker.getHealth();
          return {
            status: health.status,
            effectiveIntervalMs: health.effectiveIntervalMs,
            stats: health.stats,
            lastDeliveryAt: health.lastDeliveryAt,
            lastEventType: health.lastEventType,
          };
        },
      },
    );
    this.ctx.retryCoordinator = createRetryCoordinator(
      {
        tracker: deps.tracker,
        attemptStore: deps.attemptStore,
        workspaceManager: deps.workspaceManager,
        logger: deps.logger,
      },
      this.ctx,
    );
  }

  getContext(): OrchestratorContext {
    return this.ctx;
  }

  async cleanupTerminalWorkspaces(): Promise<void> {
    await cleanupTerminalIssueWorkspacesState(this.ctx);
  }

  async reconcileRunningAndRetrying(): Promise<boolean> {
    return reconcileRunningAndRetryingState(this.ctx);
  }

  async refreshQueueViews(candidateIssues?: Issue[]): Promise<void> {
    await refreshQueueViewsState(this.ctx, candidateIssues);
  }

  async launchAvailableWorkers(candidateIssues?: Issue[]): Promise<void> {
    await launchAvailableWorkersState(this.ctx, candidateIssues);
  }

  buildSnapshot(): RuntimeSnapshot {
    return this.readModel.buildSnapshot();
  }

  buildIssueDetail(identifier: string): IssueDetailView | null {
    return this.readModel.buildIssueDetail(identifier);
  }

  buildAttemptDetail(attemptId: string): AttemptDetailView | null {
    return this.readModel.buildAttemptDetail(attemptId);
  }

  private buildContext(): OrchestratorContext {
    const ctx: Omit<
      OrchestratorContext,
      | "running"
      | "runningEntries"
      | "retryEntries"
      | "completedViews"
      | "detailViews"
      | "claimedIssueIds"
      | "queuedViews"
    > = {
      deps: this.deps,
      getConfig: () => this.deps.configStore.getConfig(),
      isRunning: () => this.state.running,
      resolveModelSelection: (identifier) =>
        resolveModelSelectionFromConfig(this.state.issueModelOverrides, this.deps.configStore.getConfig(), identifier),
      releaseIssueClaim: (issueId) => void releaseIssueClaimInState(this.state, issueId),
      suppressIssueDispatch: (issue) =>
        (this.state.operatorAbortSuppressions ??= new Map()).set(issue.id, buildIssueDispatchFingerprint(issue)),
      claimIssue: (issueId) => claimIssueInState(this.state, issueId),
      setRunningEntry: (issueId, entry) => setRunningEntryInState(this.state, issueId, entry),
      deleteRunningEntry: (issueId) => deleteRunningEntryInState(this.state, issueId),
      setRetryEntry: (issueId, entry) => setRetryEntryInState(this.state, issueId, entry),
      deleteRetryEntry: (issueId) => deleteRetryEntryInState(this.state, issueId),
      markDirty: () => this.state.markDirty(),
      notify: (event) => this.notifyChannel(event),
      pushEvent: (event) => this.pushEvent(event),
      retryCoordinator: undefined as unknown as OrchestratorContext["retryCoordinator"],
      buildOutcomeView: (input) => this.buildOutcomeView(input),
      setDetailView: (identifier, view) => this.setDetailView(identifier, view),
      setCompletedView: (identifier, view) => this.setCompletedView(identifier, view),
      launchWorker: async (issue, attempt, options) => {
        await launchWorkerState(
          {
            ...ctx,
            runningEntries: this.state.runningEntries,
            completedViews: this.state.completedViews,
            detailViews: this.state.detailViews,
            handleWorkerPromise: (promise, workerIssue, workspace, entry, workerAttempt) =>
              this.handleWorkerPromise(promise, workerIssue, workspace, entry, workerAttempt),
          },
          issue,
          attempt,
          options,
        );
        this.deps.eventBus?.emit("issue.started", {
          issueId: issue.id,
          identifier: issue.identifier,
          attempt,
        });
      },
      canDispatchIssue: (issue) =>
        canDispatchIssueState(
          issue,
          this.deps.configStore.getConfig(),
          this.state.claimedIssueIds,
          this.state.operatorAbortSuppressions ?? undefined,
        ),
      hasAvailableStateSlot: (issue, pendingStateCounts, runningStateCounts) =>
        hasAvailableStateSlotState(
          issue,
          this.deps.configStore.getConfig(),
          this.state.runningEntries,
          pendingStateCounts,
          runningStateCounts,
        ),
      getQueuedViews: () => this.state.queuedViews,
      setQueuedViews: (views) => setQueuedViewsInState(this.state, views),
      applyUsageEvent: (entry, usage, usageMode) => this.applyUsageEvent(entry, usage, usageMode),
      setRateLimits: (rateLimits) => setRateLimitsInState(this.state, rateLimits),
      getStallEvents: () => this.state.stallEvents,
      detectAndKillStalled: () => this.detectAndKillStalled(),
      eventBus: this.deps.eventBus,
    };

    Object.defineProperties(ctx, {
      running: {
        enumerable: true,
        get: () => this.state.running,
      },
      runningEntries: {
        enumerable: true,
        get: () => this.state.runningEntries,
      },
      retryEntries: {
        enumerable: true,
        get: () => this.state.retryEntries,
      },
      completedViews: {
        enumerable: true,
        get: () => this.state.completedViews,
      },
      detailViews: {
        enumerable: true,
        get: () => this.state.detailViews,
      },
      claimedIssueIds: {
        enumerable: true,
        get: () => this.state.claimedIssueIds,
      },
      queuedViews: {
        enumerable: true,
        get: () => this.state.queuedViews,
      },
    });

    return ctx as OrchestratorContext;
  }

  private notifyChannel(event: NotificationEvent): void {
    if (!this.deps.notificationManager) {
      return;
    }
    void this.deps.notificationManager.notify(event).catch((error: unknown) => {
      this.deps.logger.warn({ eventType: event.type, error: toErrorString(error) }, "notification delivery failed");
    });
  }

  private buildOutcomeView(input: OutcomeViewInput): RuntimeIssueView {
    return buildProjectedOutcomeView(
      input.issue,
      input.workspace,
      input.entry,
      input.configuredSelection,
      input.overrides,
    );
  }

  private setDetailView(identifier: string, view: RuntimeIssueView): RuntimeIssueView {
    return setDetailViewInState(this.state, identifier, view);
  }

  private setCompletedView(identifier: string, view: RuntimeIssueView): RuntimeIssueView {
    return setCompletedViewInState(this.state, identifier, view);
  }

  private pushEvent(event: RuntimeEventRecord): void {
    pushRecentEventInState(this.state, event, MAX_RECENT_EVENTS);
    this.state.markDirty();
    forwardToEventBus(this.deps, event);
  }

  private applyUsageEvent(entry: RunningEntry, usage: TokenUsageSnapshot, usageMode: "absolute_total" | "delta"): void {
    applyUsageEventInState(this.state, entry, usage, usageMode);
  }

  private detectAndKillStalled(): { killed: number } {
    const result = detectAndKillStalledWorkers({
      runningEntries: this.state.runningEntries,
      stallEvents: this.state.stallEvents,
      getConfig: () => this.deps.configStore.getConfig(),
      pushEvent: (event) => {
        pushRecentEventInState(this.state, event, MAX_RECENT_EVENTS);
        forwardToEventBus(this.deps, event);
      },
      logger: { warn: (...args) => this.deps.logger.warn(...args) },
    });
    if (result.updatedStallEvents) {
      this.state.stallEvents = result.updatedStallEvents;
    }
    return { killed: result.killed };
  }

  private async handleWorkerPromise(
    promise: Promise<RunOutcome>,
    workerIssue: Issue,
    workspace: Workspace,
    entry: RunningEntry,
    workerAttempt: number | null,
  ): Promise<void> {
    const metrics = this.deps.metrics ?? createMetricsCollector();
    const observer = this.deps.observability?.getComponent("orchestrator");
    await promise
      .then(async (outcome) => {
        await handleWorkerOutcome(this.ctx, outcome, entry, workerIssue, workspace, workerAttempt);
        metrics.agentRunsTotal.increment({ outcome: outcome.kind });
        observer?.recordOperation({
          metric: "worker_completion",
          operation: "worker_outcome",
          outcome: outcome.kind === "failed" ? "failure" : "success",
          correlationId: entry.runId,
          data: {
            issueId: workerIssue.id,
            issueIdentifier: workerIssue.identifier,
            outcome: outcome.kind,
          },
        });
        observer?.setSession(workerIssue.id, {
          status: outcome.kind,
          correlationId: entry.runId,
          metadata: {
            issueIdentifier: workerIssue.identifier,
            workspaceKey: workspace.workspaceKey,
          },
        });
      })
      .catch(async (error) => {
        await handleWorkerFailure(this.ctx, workerIssue, entry, error);
        metrics.agentRunsTotal.increment({ outcome: "failed" });
        observer?.recordOperation({
          metric: "worker_completion",
          operation: "worker_outcome",
          outcome: "failure",
          correlationId: entry.runId,
          reason: toErrorString(error),
          data: {
            issueId: workerIssue.id,
            issueIdentifier: workerIssue.identifier,
          },
        });
        observer?.setSession(workerIssue.id, {
          status: "failed",
          correlationId: entry.runId,
          metadata: {
            issueIdentifier: workerIssue.identifier,
            error: toErrorString(error),
          },
        });
        observer?.setHealth({
          surface: "workers",
          status: "warn",
          reason: `worker failed for ${workerIssue.identifier}`,
        });
      });
  }
}

function emitLifecycleEvent(deps: OrchestratorDeps, event: RuntimeEventRecord): void {
  const issueId = event.issueId ?? "";
  const identifier = event.issueIdentifier ?? "";
  if (event.event === "agent_stalled" || event.event === "worker_stalled") {
    deps.eventBus?.emit("issue.stalled", { issueId, identifier, reason: event.message });
  } else if (event.event === "worker_failed") {
    deps.eventBus?.emit("worker.failed", { issueId, identifier, error: event.message });
  } else if (event.event === "issue_queued") {
    deps.eventBus?.emit("issue.queued", { issueId, identifier });
  } else if (
    event.event === "workspace_preparing" ||
    event.event === "workspace_ready" ||
    event.event === "workspace_failed"
  ) {
    deps.eventBus?.emit("workspace.event", {
      issueId,
      identifier,
      status: event.event.replaceAll("workspace_", ""),
    });
  }
}

function forwardToEventBus(deps: OrchestratorDeps, event: RuntimeEventRecord): void {
  emitLifecycleEvent(deps, event);
  deps.eventBus?.emit("agent.event", {
    issueId: event.issueId ?? "",
    identifier: event.issueIdentifier ?? "",
    type: event.event,
    message: event.message,
    sessionId: event.sessionId ?? null,
    timestamp: event.at,
    content: event.content ?? null,
  });
}
