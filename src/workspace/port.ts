import type { Issue, Workspace } from "../core/types.js";

export interface WorkspaceRemovalResult {
  removed: boolean;
  preserved: boolean;
  hadUncommittedChanges: boolean;
  autoCommitAttempted: boolean;
  autoCommitSha: string | null;
  autoCommitError: string | null;
}

/**
 * The single seam for workspace lifecycle. Owns directory creation, hook
 * execution, removal (with auto-commit safety), and per-key serialization
 * so concurrent callers cannot race on the same workspace.
 *
 * Hidden behind the port: directory vs. worktree strategy, the lock map,
 * path-resolution helpers, and the safe-PATH builder used for hooks.
 */
export interface WorkspacePort {
  ensureWorkspace(issueIdentifier: string, issue?: Issue): Promise<Workspace>;
  prepareForAttempt(workspace: Workspace): Promise<void>;
  runBeforeRun(workspace: Workspace, issueIdentifier: string): Promise<void>;
  runAfterRun(workspace: Workspace, issueIdentifier: string): Promise<void>;
  removeWorkspace(issueIdentifier: string, issue?: Issue): Promise<void>;
  removeWorkspaceWithResult(issueIdentifier: string, issue?: Issue): Promise<WorkspaceRemovalResult>;
  /** Serializes lifecycle operations on the same workspaceKey across callers. */
  withLock<T>(workspaceKey: string, task: () => Promise<T>): Promise<T>;
}
