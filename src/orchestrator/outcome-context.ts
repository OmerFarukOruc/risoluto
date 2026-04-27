import type { Issue, ModelSelection, RuntimeIssueView, ServiceConfig } from "../core/types.js";
import type { RunningEntry } from "./runtime-types.js";
import type { GitDiffPort, GitPostRunPort } from "../git/port.js";
import type { NotificationEvent } from "../notification/channel.js";
import type { TypedEventBus } from "../core/event-bus.js";
import type { RisolutoEventMap } from "../core/risoluto-events.js";
import type { WorkspaceRemovalResult } from "../workspace/manager.js";
import type { OutcomeViewInput } from "./snapshot-builder.js";
import type { PreparedWorkerOutcome } from "./worker-outcome/types.js";

/**
 * Retry supervision port. Owns the post-outcome decision of whether to retry,
 * exhaust, or hard-fail a worker run. Co-located with OutcomeContext because
 * the two types reference each other; keeping them in one file lets madge
 * trace them without flagging a circular import.
 */
export interface RetryCoordinator {
  dispatch(ctx: OutcomeContext, prepared: PreparedWorkerOutcome): Promise<void>;
  cancel(issueId: string): void;
}

/** Shared context type for outcome handlers. Used internally by worker-outcome.ts. */
export interface OutcomeContext {
  runningEntries: Map<string, RunningEntry>;
  completedViews: Map<string, RuntimeIssueView>;
  detailViews: Map<string, RuntimeIssueView>;
  deps: {
    tracker: {
      fetchIssueStatesByIds: (ids: string[]) => Promise<Issue[]>;
      resolveStateId: (stateName: string) => Promise<string | null>;
      updateIssueState: (issueId: string, stateId: string) => Promise<void>;
      createComment: (issueId: string, body: string) => Promise<void>;
    };
    attemptStore: {
      updateAttempt: (attemptId: string, patch: Record<string, unknown>) => Promise<void>;
      appendEvent?: (event: import("../core/types.js").AttemptEvent) => Promise<void>;
      appendCheckpoint?: (
        checkpoint: Omit<import("../core/types.js").AttemptCheckpointRecord, "checkpointId" | "ordinal">,
      ) => Promise<void>;
      upsertPr?: (pr: import("../core/attempt-store-port.js").UpsertPrInput) => Promise<void>;
    };
    workspaceManager: {
      removeWorkspace: (identifier: string, issue?: Issue) => Promise<void>;
      removeWorkspaceWithResult?: (identifier: string, issue?: Issue) => Promise<WorkspaceRemovalResult>;
    };
    gitManager?: GitPostRunPort & GitDiffPort;
    eventBus?: TypedEventBus<RisolutoEventMap>;
    logger: {
      info: (meta: Record<string, unknown>, message: string) => void;
      warn: (meta: Record<string, unknown>, message: string) => void;
    };
  };
  isRunning: () => boolean;
  getConfig: () => ServiceConfig;
  releaseIssueClaim: (issueId: string) => void;
  suppressIssueDispatch?: (issue: Issue) => void;
  deleteRunningEntry: (issueId: string) => boolean;
  markDirty: () => void;
  resolveModelSelection: (identifier: string) => ModelSelection;
  buildOutcomeView: (input: OutcomeViewInput) => RuntimeIssueView;
  setDetailView: (identifier: string, view: RuntimeIssueView) => RuntimeIssueView;
  setCompletedView: (identifier: string, view: RuntimeIssueView) => RuntimeIssueView;
  notify: (event: NotificationEvent) => void;
  retryCoordinator: RetryCoordinator;
}
