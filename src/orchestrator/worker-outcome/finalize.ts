import type { Issue, RunOutcome, Workspace } from "../../core/types.js";
import type { StopSignal } from "../../core/signal-detection.js";
import type { UpsertPrInput } from "../../core/attempt-store-port.js";
import type { OutcomeContext } from "../context.js";
import type { RunningEntry } from "../runtime-types.js";
import { executeGitPostRun } from "../git-post-run.js";
import { nowIso } from "../views.js";
import { toErrorString } from "../../utils/type-guards.js";
import { writeCompletionWriteback, writeFailureWriteback } from "./completion-writeback.js";
import { issueRef, outcomeToStatus, type PreparedWorkerOutcome } from "./types.js";

export function finalizeServiceStopped(ctx: OutcomeContext, prepared: PreparedWorkerOutcome): void {
  const { outcome, entry, latestIssue: issue, workspace, modelSelection, attempt } = prepared;
  const message = outcome.errorMessage ?? "service stopped before the worker completed";
  ctx.notify({
    type: "worker_failed",
    severity: "critical",
    timestamp: nowIso(),
    message,
    issue: issueRef(issue),
    attempt,
  });
  ctx.releaseIssueClaim(issue.id);
  ctx.setCompletedView(
    issue.identifier,
    ctx.buildOutcomeView({
      issue,
      workspace,
      entry,
      configuredSelection: modelSelection,
      overrides: {
        status: "cancelled",
        attempt,
        error: outcome.errorMessage,
        message,
      },
    }),
  );
  ctx.deps.eventBus?.emit("issue.completed", {
    issueId: issue.id,
    identifier: issue.identifier,
    outcome: "cancelled",
  });
}

export async function finalizeTerminalCleanup(ctx: OutcomeContext, prepared: PreparedWorkerOutcome): Promise<void> {
  const { outcome, entry, latestIssue: issue, workspace, modelSelection, attempt } = prepared;
  const removalResult = await removeWorkspaceWithLogging(ctx, issue.identifier, issue);
  await recordAutoCommitCleanup(ctx, entry, issue, outcome, removalResult?.autoCommitSha ?? null);
  ctx.setCompletedView(
    issue.identifier,
    ctx.buildOutcomeView({
      issue,
      workspace,
      entry,
      configuredSelection: modelSelection,
      overrides: {
        status: outcomeToStatus(outcome.kind),
        attempt,
        error: outcome.errorMessage ?? outcome.errorCode,
        message: removalResult?.preserved
          ? "workspace preserved after cleanup protection triggered"
          : "workspace cleaned after terminal state",
      },
    }),
  );
  ctx.deps.eventBus?.emit("issue.completed", {
    issueId: issue.id,
    identifier: issue.identifier,
    outcome: outcomeToStatus(outcome.kind),
  });
  ctx.releaseIssueClaim(issue.id);
}

export function finalizeInactiveIssue(ctx: OutcomeContext, prepared: PreparedWorkerOutcome): void {
  const { entry, latestIssue: issue, workspace, modelSelection } = prepared;
  ctx.setCompletedView(
    issue.identifier,
    ctx.buildOutcomeView({
      issue,
      workspace,
      entry,
      configuredSelection: modelSelection,
      overrides: {
        status: "paused",
        message: "issue is no longer active",
      },
    }),
  );
  ctx.deps.eventBus?.emit("issue.completed", {
    issueId: issue.id,
    identifier: issue.identifier,
    outcome: "paused",
  });
  ctx.releaseIssueClaim(issue.id);
}

export function finalizeOperatorAbort(ctx: OutcomeContext, prepared: PreparedWorkerOutcome): void {
  const { outcome, entry, latestIssue: issue, workspace, modelSelection, attempt } = prepared;
  const message = outcome.errorMessage ?? "worker cancelled by operator request";
  ctx.notify({
    type: "worker_failed",
    severity: "info",
    timestamp: nowIso(),
    message,
    issue: issueRef(issue),
    attempt,
    metadata: { errorCode: outcome.errorCode },
  });
  ctx.setCompletedView(
    issue.identifier,
    ctx.buildOutcomeView({
      issue,
      workspace,
      entry,
      configuredSelection: modelSelection,
      overrides: {
        status: "cancelled",
        attempt,
        error: outcome.errorCode,
        message,
      },
    }),
  );
  ctx.deps.eventBus?.emit("issue.completed", {
    issueId: issue.id,
    identifier: issue.identifier,
    outcome: "cancelled",
  });
  ctx.suppressIssueDispatch?.(issue);
  ctx.releaseIssueClaim(issue.id);
}

export async function finalizeCancelledOrHardFailure(
  ctx: OutcomeContext,
  prepared: PreparedWorkerOutcome,
): Promise<void> {
  const { outcome, entry, latestIssue: issue, workspace, modelSelection, attempt } = prepared;
  const errorReason = outcome.errorMessage ?? outcome.errorCode ?? "worker stopped without a retry";
  ctx.notify({
    type: "worker_failed",
    severity: "critical",
    timestamp: nowIso(),
    message: errorReason,
    issue: issueRef(issue),
    attempt,
    metadata: { errorCode: outcome.errorCode },
  });
  ctx.setCompletedView(
    issue.identifier,
    ctx.buildOutcomeView({
      issue,
      workspace,
      entry,
      configuredSelection: modelSelection,
      overrides: {
        status: outcomeToStatus(outcome.kind),
        attempt,
        error: outcome.errorCode,
        message: errorReason,
      },
    }),
  );
  ctx.deps.eventBus?.emit("issue.completed", {
    issueId: issue.id,
    identifier: issue.identifier,
    outcome: outcomeToStatus(outcome.kind),
  });
  ctx.releaseIssueClaim(issue.id);
  await writeFailureWriteback(ctx, {
    issue,
    entry,
    attemptCount: attempt,
    errorReason,
  });
}

export async function finalizeStopSignal(
  ctx: OutcomeContext,
  stopSignal: StopSignal,
  prepared: PreparedWorkerOutcome,
  turnCount: number | null,
): Promise<void> {
  const { entry, latestIssue: issue, workspace, modelSelection, attempt } = prepared;
  const { pullRequestUrl, summary } = await runGitPostRun(ctx, stopSignal, entry, workspace, issue);

  await ctx.deps.attemptStore
    .updateAttempt(entry.runId, {
      stopSignal,
      pullRequestUrl,
      summary,
      status: stopSignal === "blocked" ? "paused" : "completed",
    })
    .catch((error) => {
      ctx.deps.logger.info(
        { attempt_id: entry.runId, error: toErrorString(error) },
        "attempt update failed after stop signal (non-fatal)",
      );
    });

  if (pullRequestUrl) {
    ctx.deps.logger.info({ issue_identifier: issue.identifier, url: pullRequestUrl }, "pull request created");
    registerPrForMonitoring(ctx, entry, issue, pullRequestUrl).catch((error) => {
      ctx.deps.logger.warn(
        { issue_identifier: issue.identifier, error: toErrorString(error) },
        "PR registration for monitoring failed (non-fatal)",
      );
    });
  }

  const isBlocked = stopSignal === "blocked";
  const statusMessage = isBlocked ? "worker reported issue blocked" : "worker reported issue complete";
  ctx.setCompletedView(
    issue.identifier,
    ctx.buildOutcomeView({
      issue,
      workspace,
      entry,
      configuredSelection: modelSelection,
      overrides: {
        status: isBlocked ? "paused" : "completed",
        attempt,
        message: statusMessage,
        pullRequestUrl,
      },
    }),
  );
  ctx.notify({
    type: isBlocked ? "worker_failed" : "worker_completed",
    severity: isBlocked ? "critical" : "info",
    timestamp: nowIso(),
    message: statusMessage,
    issue: issueRef(issue),
    attempt,
    metadata: { workspace: workspace.path, pullRequestUrl },
  });
  ctx.deps.eventBus?.emit("issue.completed", {
    issueId: issue.id,
    identifier: issue.identifier,
    outcome: isBlocked ? "paused" : "completed",
  });
  if (isBlocked) {
    ctx.releaseIssueClaim(issue.id);
  }

  const transitionedState = await writeCompletionWriteback(ctx, {
    issue,
    entry,
    attempt,
    stopSignal,
    pullRequestUrl,
    turnCount,
  }).catch((error) => {
    ctx.deps.logger.warn(
      { issue_identifier: issue.identifier, error: toErrorString(error) },
      "completion writeback failed (non-fatal)",
    );
    return null;
  });

  if (transitionedState) {
    const view = ctx.completedViews.get(issue.identifier);
    if (view) {
      view.state = transitionedState;
    }
  }
}

async function runGitPostRun(
  ctx: OutcomeContext,
  stopSignal: StopSignal,
  entry: RunningEntry,
  workspace: Workspace,
  issue: Issue,
): Promise<{ pullRequestUrl: string | null; summary: string | null }> {
  if (stopSignal !== "done" || !entry.repoMatch || !ctx.deps.gitManager) {
    return { pullRequestUrl: null, summary: null };
  }

  try {
    const result = await executeGitPostRun(ctx.deps.gitManager, workspace, issue, entry.repoMatch);
    return { pullRequestUrl: result.pullRequestUrl, summary: result.summary };
  } catch (error) {
    ctx.deps.logger.info(
      { issue_identifier: issue.identifier, error: toErrorString(error) },
      "git post-run failed after DONE — completing issue anyway",
    );
    return { pullRequestUrl: null, summary: null };
  }
}

async function registerPrForMonitoring(
  ctx: OutcomeContext,
  entry: RunningEntry,
  issue: Issue,
  pullRequestUrl: string,
): Promise<void> {
  const repoMatch = entry.repoMatch;
  if (!repoMatch) {
    return;
  }

  const owner = repoMatch.githubOwner ?? null;
  const repoName = repoMatch.githubRepo ?? null;
  if (!owner || !repoName) {
    return;
  }

  const pullNumberMatch = /\/pull\/(\d+)$/.exec(pullRequestUrl);
  if (!pullNumberMatch) {
    return;
  }

  const attemptStore = ctx.deps.attemptStore;
  if (!attemptStore.upsertPr) {
    ctx.deps.logger.warn({ issue_identifier: issue.identifier }, "PR registration skipped: upsertPr not available");
    return;
  }

  const pullNumber = parseInt(pullNumberMatch[1], 10);
  const now = new Date().toISOString();
  const input: UpsertPrInput = {
    issueId: issue.id,
    owner,
    repo: repoName,
    pullNumber,
    url: pullRequestUrl,
    attemptId: entry.runId,
    status: "open",
    createdAt: now,
    updatedAt: now,
    branchName: issue.branchName ?? "",
  };

  await attemptStore.upsertPr(input);
}

async function removeWorkspaceWithLogging(
  ctx: OutcomeContext,
  issueIdentifier: string,
  issue: Issue,
): Promise<{
  preserved?: boolean;
  autoCommitSha?: string | null;
} | null> {
  if (ctx.deps.workspaceManager.removeWorkspaceWithResult) {
    return ctx.deps.workspaceManager.removeWorkspaceWithResult(issueIdentifier, issue).catch((error) => {
      ctx.deps.logger.info(
        { issue_identifier: issueIdentifier, error: toErrorString(error) },
        "workspace cleanup failed (non-fatal)",
      );
      return null;
    });
  }

  await ctx.deps.workspaceManager.removeWorkspace(issueIdentifier, issue).catch((error) => {
    ctx.deps.logger.info(
      { issue_identifier: issueIdentifier, error: toErrorString(error) },
      "workspace cleanup failed (non-fatal)",
    );
  });
  return null;
}

async function recordAutoCommitCleanup(
  ctx: OutcomeContext,
  entry: RunningEntry,
  issue: Issue,
  outcome: RunOutcome,
  autoCommitSha: string | null,
): Promise<void> {
  if (!autoCommitSha || !ctx.deps.attemptStore.appendEvent || !ctx.deps.attemptStore.appendCheckpoint) {
    return;
  }

  const createdAt = nowIso();
  await ctx.deps.attemptStore.appendEvent({
    attemptId: entry.runId,
    at: createdAt,
    issueId: issue.id,
    issueIdentifier: issue.identifier,
    sessionId: entry.sessionId,
    event: "workspace_auto_committed",
    message: "Uncommitted workspace changes were auto-committed before cleanup",
    metadata: {
      commitSha: autoCommitSha,
    },
  });
  await ctx.deps.attemptStore.appendCheckpoint({
    attemptId: entry.runId,
    trigger: "status_transition",
    eventCursor: null,
    status: outcomeToStatus(outcome.kind) as import("../../core/types.js").AttemptRecord["status"],
    threadId: entry.sessionId,
    turnId: outcome.turnId,
    turnCount: outcome.turnCount,
    tokenUsage: entry.tokenUsage,
    metadata: {
      autoCommitSha,
    },
    createdAt,
  });
}
