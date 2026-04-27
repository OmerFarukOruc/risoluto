import type { Issue, ModelSelection, RuntimeIssueView, ServiceConfig, TokenUsageSnapshot } from "../core/types.js";
import type { OrchestratorDeps, RetryRuntimeEntry, RunningEntry } from "./runtime-types.js";
import type { LaunchWorkerOptions } from "./runtime-types.js";
import type { StallEvent } from "./stall-detector.js";
import type { RuntimeEventRecord } from "../core/lifecycle-events.js";
import type { NotificationEvent } from "../notification/channel.js";
import type { TypedEventBus } from "../core/event-bus.js";
import type { RisolutoEventMap } from "../core/risoluto-events.js";
import type { OutcomeViewInput } from "./snapshot-builder.js";
import type { LifecycleState } from "./core/lifecycle-state.js";
export type { OutcomeContext, RetryCoordinator } from "./outcome-context.js";
import type { RetryCoordinator } from "./outcome-context.js";

export interface OrchestratorContext {
  running: LifecycleState["running"];
  runningEntries: LifecycleState["runningEntries"];
  retryEntries: LifecycleState["retryEntries"];
  completedViews: LifecycleState["completedViews"];
  detailViews: LifecycleState["detailViews"];
  claimedIssueIds: LifecycleState["claimedIssueIds"];
  queuedViews: LifecycleState["queuedViews"];
  deps: OrchestratorDeps;
  getConfig: () => ServiceConfig;
  isRunning: () => boolean;
  resolveModelSelection: (identifier: string) => ModelSelection;
  releaseIssueClaim: (issueId: string) => void;
  claimIssue: (issueId: string) => void;
  setRunningEntry: (issueId: string, entry: RunningEntry) => void;
  deleteRunningEntry: (issueId: string) => boolean;
  setRetryEntry: (issueId: string, entry: RetryRuntimeEntry) => void;
  deleteRetryEntry: (issueId: string) => boolean;
  markDirty: () => void;
  notify: (event: NotificationEvent) => void;
  pushEvent: (event: RuntimeEventRecord) => void;
  retryCoordinator: RetryCoordinator;
  buildOutcomeView: (input: OutcomeViewInput) => RuntimeIssueView;
  setDetailView: (identifier: string, view: RuntimeIssueView) => RuntimeIssueView;
  setCompletedView: (identifier: string, view: RuntimeIssueView) => RuntimeIssueView;
  launchWorker: (issue: Issue, attempt: number | null, options?: LaunchWorkerOptions) => Promise<void>;
  canDispatchIssue: (issue: Issue) => boolean;
  hasAvailableStateSlot: (
    issue: Issue,
    pendingStateCounts?: Map<string, number>,
    runningStateCounts?: Map<string, number>,
  ) => boolean;
  getQueuedViews: () => RuntimeIssueView[];
  setQueuedViews: (views: RuntimeIssueView[]) => void;
  suppressIssueDispatch?: (issue: Issue) => void;
  applyUsageEvent: (entry: RunningEntry, usage: TokenUsageSnapshot, usageMode: "absolute_total" | "delta") => void;
  setRateLimits: (rateLimits: unknown) => void;
  getStallEvents: () => StallEvent[];
  detectAndKillStalled: () => { killed: number };
  eventBus?: TypedEventBus<RisolutoEventMap>;
}

export type RetryRuntimeContext = Pick<
  OrchestratorContext,
  | "runningEntries"
  | "retryEntries"
  | "detailViews"
  | "completedViews"
  | "isRunning"
  | "getConfig"
  | "claimIssue"
  | "releaseIssueClaim"
  | "setRunningEntry"
  | "deleteRunningEntry"
  | "setRetryEntry"
  | "deleteRetryEntry"
  | "hasAvailableStateSlot"
  | "markDirty"
  | "notify"
  | "pushEvent"
  | "resolveModelSelection"
  | "setDetailView"
  | "setCompletedView"
  | "launchWorker"
>;
