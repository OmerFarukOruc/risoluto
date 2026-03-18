import {
  updateIssueModelSelection,
  resolveModelSelection as resolveModelSelectionFromConfig,
} from "./orchestrator/model-selection.js";
import {
  clearRetryEntry as clearRetryEntryState,
  handleRetryLaunchFailure as handleRetryLaunchFailureState,
  queueRetry as queueRetryState,
  revalidateAndLaunchRetry as revalidateAndLaunchRetryState,
} from "./orchestrator/retry-manager.js";
import {
  cleanupTerminalIssueWorkspaces as cleanupTerminalIssueWorkspacesState,
  reconcileRunningAndRetrying as reconcileRunningAndRetryingState,
  refreshQueueViews as refreshQueueViewsState,
} from "./orchestrator/lifecycle.js";
import type { OrchestratorDeps, RetryRuntimeEntry, RunningEntry } from "./orchestrator/runtime-types.js";
import { type IssueView, nowIso, usageDelta } from "./orchestrator/views.js";
import { handleWorkerFailure, handleWorkerOutcome } from "./orchestrator/worker-outcome.js";
import {
  canDispatchIssue as canDispatchIssueState,
  hasAvailableStateSlot as hasAvailableStateSlotState,
  launchAvailableWorkers as launchAvailableWorkersState,
  launchWorker as launchWorkerState,
} from "./orchestrator/worker-launcher.js";
import { buildAttemptDetail, buildIssueDetail, buildSnapshot } from "./orchestrator/snapshot-builder.js";
import type {
  Issue,
  ModelSelection,
  RecentEvent,
  ReasoningEffort,
  RuntimeSnapshot,
  ServiceConfig,
  TokenUsageSnapshot,
} from "./types.js";
import type { NotificationEvent } from "./notification-channel.js";

export class Orchestrator {
  private running = false;
  private tickInFlight = false;
  private nextTickTimer: NodeJS.Timeout | null = null;
  private refreshQueued = false;
  private readonly runningEntries = new Map<string, RunningEntry>();
  private readonly retryEntries = new Map<string, RetryRuntimeEntry>();
  private readonly claimedIssueIds = new Set<string>();
  private readonly recentEvents: RecentEvent[] = [];
  private readonly detailViews = new Map<string, IssueView>();
  private readonly completedViews = new Map<string, IssueView>();
  private readonly sessionUsageTotals = new Map<string, TokenUsageSnapshot>();
  private readonly issueModelOverrides = new Map<string, Omit<ModelSelection, "source">>();
  private queuedViews: IssueView[] = [];
  private rateLimits: unknown | null = null;
  private codexTotals = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    secondsRunning: 0,
  };

  constructor(private readonly deps: OrchestratorDeps) {}

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    await this.cleanupTerminalIssueWorkspaces();
    this.scheduleTick(0);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.nextTickTimer) {
      clearTimeout(this.nextTickTimer);
      this.nextTickTimer = null;
    }
    for (const retry of this.retryEntries.values()) {
      if (retry.timer) {
        clearTimeout(retry.timer);
      }
    }
    this.retryEntries.clear();
    this.claimedIssueIds.clear();
    const workers = [...this.runningEntries.values()];
    for (const worker of workers) {
      worker.abortController.abort("shutdown");
    }
    await Promise.allSettled(workers.map((worker) => worker.promise));
  }

  requestRefresh(reason: string): { queued: boolean; coalesced: boolean; requestedAt: string } {
    const requestedAt = nowIso();
    const coalesced = this.refreshQueued;
    this.refreshQueued = true;
    this.deps.logger.info({ reason, requestedAt }, "refresh requested");
    this.scheduleTick(0);
    return {
      queued: !coalesced,
      coalesced,
      requestedAt,
    };
  }

  getSnapshot(): RuntimeSnapshot {
    return buildSnapshot(
      {
        attemptStore: this.deps.attemptStore,
      },
      {
        getConfig: () => this.getConfig(),
        resolveModelSelection: (identifier) => this.resolveModelSelection(identifier),
        getDetailViews: () => this.detailViews,
        getCompletedViews: () => this.completedViews,
        getRunningEntries: () => this.runningEntries,
        getRetryEntries: () => this.retryEntries,
        getQueuedViews: () => this.queuedViews,
        getRecentEvents: () => this.recentEvents,
        getRateLimits: () => this.rateLimits,
        getCodexTotals: () => this.codexTotals,
      },
    );
  }

  getIssueDetail(identifier: string): Record<string, unknown> | null {
    const detail = buildIssueDetail(
      identifier,
      { attemptStore: this.deps.attemptStore },
      {
        getConfig: () => this.getConfig(),
        resolveModelSelection: (issueIdentifier) => this.resolveModelSelection(issueIdentifier),
        getDetailViews: () => this.detailViews,
        getCompletedViews: () => this.completedViews,
        getRunningEntries: () => this.runningEntries,
        getRetryEntries: () => this.retryEntries,
        getQueuedViews: () => this.queuedViews,
        getRecentEvents: () => this.recentEvents,
        getRateLimits: () => this.rateLimits,
        getCodexTotals: () => this.codexTotals,
      },
    );
    return detail ? { ...detail } : null;
  }

  getAttemptDetail(attemptId: string): Record<string, unknown> | null {
    const detail = buildAttemptDetail(attemptId, { attemptStore: this.deps.attemptStore });
    return detail ? { ...detail } : null;
  }

  async updateIssueModelSelection(input: {
    identifier: string;
    model: string;
    reasoningEffort: ReasoningEffort | null;
  }): Promise<{ updated: boolean; restarted: boolean; appliesNextAttempt: boolean; selection: ModelSelection } | null> {
    return updateIssueModelSelection(
      {
        getConfig: () => this.getConfig(),
        getIssueDetail: (identifier) => this.getIssueDetail(identifier),
        issueModelOverrides: this.issueModelOverrides,
        runningEntries: this.runningEntries,
        retryEntries: this.retryEntries,
        pushEvent: (event) => this.pushEvent(event),
        requestRefresh: (reason) => this.requestRefresh(reason),
      },
      input,
    );
  }

  private scheduleTick(delayMs: number): void {
    if (!this.running || this.tickInFlight) {
      return;
    }
    if (this.nextTickTimer) {
      clearTimeout(this.nextTickTimer);
    }
    this.nextTickTimer = setTimeout(() => {
      this.nextTickTimer = null;
      void this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    if (!this.running || this.tickInFlight) {
      return;
    }
    this.tickInFlight = true;
    try {
      await this.reconcileRunningAndRetrying();
      await this.refreshQueueViews();
      await this.launchAvailableWorkers();
    } catch (error) {
      this.deps.logger.error({ error: String(error) }, "orchestrator tick failed");
    } finally {
      this.tickInFlight = false;
      const delayMs = this.refreshQueued ? 0 : this.getConfig().polling.intervalMs;
      this.refreshQueued = false;
      if (this.running) {
        this.scheduleTick(delayMs);
      }
    }
  }

  private async reconcileRunningAndRetrying(): Promise<void> {
    await reconcileRunningAndRetryingState({
      runningEntries: this.runningEntries,
      retryEntries: this.retryEntries,
      deps: {
        linearClient: this.deps.linearClient,
        workspaceManager: this.deps.workspaceManager,
      },
      getConfig: () => this.getConfig(),
      clearRetryEntry: (issueId) => this.clearRetryEntry(issueId),
      pushEvent: (event) => this.pushEvent(event),
    });
  }

  private async refreshQueueViews(): Promise<void> {
    await refreshQueueViewsState({
      queuedViews: this.queuedViews,
      detailViews: this.detailViews,
      claimedIssueIds: this.claimedIssueIds,
      deps: {
        linearClient: this.deps.linearClient,
      },
      canDispatchIssue: (issue) => this.canDispatchIssue(issue),
      resolveModelSelection: (identifier) => this.resolveModelSelection(identifier),
      setQueuedViews: (views) => {
        this.queuedViews = views;
      },
    });
  }

  private async launchAvailableWorkers(): Promise<void> {
    await launchAvailableWorkersState({
      deps: {
        linearClient: this.deps.linearClient,
      },
      getConfig: () => this.getConfig(),
      runningEntries: this.runningEntries,
      claimIssue: (issueId) => this.claimIssue(issueId),
      canDispatchIssue: (issue) => this.canDispatchIssue(issue),
      hasAvailableStateSlot: (issue, pendingStateCounts) => this.hasAvailableStateSlot(issue, pendingStateCounts),
      launchWorker: (issue, attempt, options) => this.launchWorker(issue, attempt, options),
    });
  }

  private async launchWorker(issue: Issue, attempt: number | null, options?: { claimHeld?: boolean }): Promise<void> {
    await launchWorkerState(
      {
        deps: {
          agentRunner: this.deps.agentRunner,
          attemptStore: this.deps.attemptStore,
          configStore: this.deps.configStore,
          workspaceManager: this.deps.workspaceManager,
          repoRouter: this.deps.repoRouter,
          gitManager: this.deps.gitManager,
        },
        runningEntries: this.runningEntries,
        completedViews: this.completedViews,
        detailViews: this.detailViews,
        getQueuedViews: () => this.queuedViews,
        setQueuedViews: (views) => {
          this.queuedViews = views;
        },
        claimIssue: (issueId) => this.claimIssue(issueId),
        releaseIssueClaim: (issueId) => this.releaseIssueClaim(issueId),
        resolveModelSelection: (identifier) => this.resolveModelSelection(identifier),
        notify: (event) => this.notify(event),
        pushEvent: (event) => this.pushEvent(event),
        applyUsageEvent: (entry, usage, usageMode) => this.applyUsageEvent(entry, usage, usageMode),
        setRateLimits: (rateLimits) => {
          this.rateLimits = rateLimits;
        },
        handleWorkerPromise: async (promise, workerIssue, workspace, entry, workerAttempt) => {
          await promise
            .then((outcome) =>
              handleWorkerOutcome(
                {
                  runningEntries: this.runningEntries,
                  completedViews: this.completedViews,
                  detailViews: this.detailViews,
                  deps: {
                    linearClient: this.deps.linearClient,
                    attemptStore: this.deps.attemptStore,
                    workspaceManager: this.deps.workspaceManager,
                    gitManager: this.deps.gitManager,
                    logger: this.deps.logger,
                  },
                  isRunning: () => this.running,
                  getConfig: () => this.getConfig(),
                  releaseIssueClaim: (issueId) => this.releaseIssueClaim(issueId),
                  resolveModelSelection: (identifier) => this.resolveModelSelection(identifier),
                  notify: (event) => this.notify(event),
                  queueRetry: (latestIssue, retryAttempt, delayMs, error) =>
                    this.queueRetry(latestIssue, retryAttempt, delayMs, error),
                },
                outcome,
                entry,
                workerIssue,
                workspace,
                workerAttempt,
              ),
            )
            .catch((error) =>
              handleWorkerFailure(
                {
                  runningEntries: this.runningEntries,
                  releaseIssueClaim: (issueId) => this.releaseIssueClaim(issueId),
                  pushEvent: (event) => this.pushEvent(event),
                  deps: {
                    attemptStore: this.deps.attemptStore,
                  },
                },
                workerIssue,
                entry,
                error,
              ),
            );
        },
      },
      issue,
      attempt,
      options,
    );
  }

  private queueRetry(issue: Issue, attempt: number, delayMs: number, error: string | null): void {
    queueRetryState(
      {
        isRunning: () => this.running,
        claimIssue: (issueId) => this.claimIssue(issueId),
        retryEntries: this.retryEntries,
        detailViews: this.detailViews,
        notify: (event) => this.notify(event),
        revalidateAndLaunchRetry: (issueId, retryAttempt) => this.revalidateAndLaunchRetry(issueId, retryAttempt),
        handleRetryLaunchFailure: (retryIssue, retryAttempt, failure) =>
          this.handleRetryLaunchFailure(retryIssue, retryAttempt, failure),
      },
      issue,
      attempt,
      delayMs,
      error,
    );
  }

  private async revalidateAndLaunchRetry(issueId: string, attempt: number): Promise<void> {
    await revalidateAndLaunchRetryState(
      {
        retryEntries: this.retryEntries,
        runningEntries: this.runningEntries,
        deps: {
          linearClient: this.deps.linearClient,
          workspaceManager: this.deps.workspaceManager,
        },
        getConfig: () => this.getConfig(),
        isRunning: () => this.running,
        clearRetryEntry: (retryIssueId) => this.clearRetryEntry(retryIssueId),
        hasAvailableStateSlot: (retryIssue) => this.hasAvailableStateSlot(retryIssue),
        queueRetry: (retryIssue, retryAttempt, delayMs, error) =>
          this.queueRetry(retryIssue, retryAttempt, delayMs, error),
        launchWorker: (retryIssue, retryAttempt, options) => this.launchWorker(retryIssue, retryAttempt, options),
      },
      issueId,
      attempt,
    );
  }

  private clearRetryEntry(issueId: string): void {
    clearRetryEntryState(
      {
        retryEntries: this.retryEntries,
        runningEntries: this.runningEntries,
        releaseIssueClaim: (retryIssueId) => this.releaseIssueClaim(retryIssueId),
      },
      issueId,
    );
  }

  private notify(event: NotificationEvent): void {
    if (!this.deps.notificationManager) {
      return;
    }
    void this.deps.notificationManager.notify(event);
  }

  private pushEvent(event: RecentEvent & { usage?: unknown; rateLimits?: unknown }): void {
    this.recentEvents.unshift({
      at: event.at,
      issueId: event.issueId,
      issueIdentifier: event.issueIdentifier,
      sessionId: event.sessionId,
      event: event.event,
      message: event.message,
      content: event.content ?? null,
    });
    if (this.recentEvents.length > 250) {
      this.recentEvents.length = 250;
    }
  }

  private applyUsageEvent(entry: RunningEntry, usage: TokenUsageSnapshot, usageMode: "absolute_total" | "delta"): void {
    if (usageMode === "absolute_total") {
      const previous = entry.sessionId ? (this.sessionUsageTotals.get(entry.sessionId) ?? null) : null;
      const delta = usageDelta(previous, usage);
      this.codexTotals.inputTokens += delta.inputTokens;
      this.codexTotals.outputTokens += delta.outputTokens;
      this.codexTotals.totalTokens += delta.totalTokens;
      entry.tokenUsage = usage;
      if (entry.sessionId) {
        this.sessionUsageTotals.set(entry.sessionId, usage);
      }
      return;
    }

    this.codexTotals.inputTokens += usage.inputTokens;
    this.codexTotals.outputTokens += usage.outputTokens;
    this.codexTotals.totalTokens += usage.totalTokens;
    entry.tokenUsage = {
      inputTokens: (entry.tokenUsage?.inputTokens ?? 0) + usage.inputTokens,
      outputTokens: (entry.tokenUsage?.outputTokens ?? 0) + usage.outputTokens,
      totalTokens: (entry.tokenUsage?.totalTokens ?? 0) + usage.totalTokens,
    };
  }

  private async cleanupTerminalIssueWorkspaces(): Promise<void> {
    await cleanupTerminalIssueWorkspacesState({
      deps: {
        linearClient: this.deps.linearClient,
        workspaceManager: this.deps.workspaceManager,
        logger: this.deps.logger,
      },
      getConfig: () => this.getConfig(),
    });
  }

  private canDispatchIssue(issue: Issue): boolean {
    return canDispatchIssueState(issue, this.getConfig(), this.claimedIssueIds);
  }

  private hasAvailableStateSlot(issue: Issue, pendingStateCounts?: Map<string, number>): boolean {
    return hasAvailableStateSlotState(issue, this.getConfig(), this.runningEntries, pendingStateCounts);
  }

  private claimIssue(issueId: string): void {
    this.claimedIssueIds.add(issueId);
  }

  private releaseIssueClaim(issueId: string): void {
    this.claimedIssueIds.delete(issueId);
  }

  private async handleRetryLaunchFailure(issue: Issue, attempt: number, error: unknown): Promise<void> {
    await handleRetryLaunchFailureState(
      {
        runningEntries: this.runningEntries,
        clearRetryEntry: (issueId) => this.clearRetryEntry(issueId),
        deps: {
          attemptStore: this.deps.attemptStore,
          logger: this.deps.logger,
        },
        detailViews: this.detailViews,
        completedViews: this.completedViews,
        pushEvent: (event) => this.pushEvent(event),
        resolveModelSelection: (identifier) => this.resolveModelSelection(identifier),
      },
      issue,
      attempt,
      error,
    );
  }

  private resolveModelSelection(identifier: string): ModelSelection {
    return resolveModelSelectionFromConfig(this.issueModelOverrides, this.getConfig(), identifier);
  }

  private getConfig(): ServiceConfig {
    return this.deps.configStore.getConfig();
  }
}
