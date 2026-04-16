import { rm, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import type { Issue, ServiceConfig, RisolutoLogger, Workspace } from "../core/types.js";
import type { RepoMatch } from "../git/repo-router.js";
import { buildSafePath, isWithinRoot, sanitizeIdentifier, resolveWorkspacePath } from "./paths.js";
import { toErrorString } from "../utils/type-guards.js";
import type { WorkspacePort, WorkspaceRemovalResult } from "./port.js";

export { buildSafePath } from "./paths.js";
export type { WorkspacePort, WorkspaceRemovalResult } from "./port.js";

const TRANSIENT_DIRECTORIES = ["tmp", ".elixir_ls"];

async function pathIsDirectory(pathname: string): Promise<boolean> {
  try {
    const info = await stat(pathname);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function pathExists(pathname: string): Promise<boolean> {
  try {
    await stat(pathname);
    return true;
  } catch {
    return false;
  }
}

export interface WorkspaceManagerWorktreeDeps {
  gitManager: {
    hasUncommittedChanges: (workspaceDir: string) => Promise<boolean>;
    autoCommit: (workspaceDir: string, message: string, options?: { noVerify?: boolean }) => Promise<string>;
    setupWorktree: (
      route: RepoMatch,
      baseCloneDir: string,
      worktreePath: string,
      issue: Pick<Issue, "identifier" | "branchName">,
      branchPrefix?: string,
    ) => Promise<{ branchName: string }>;
    removeWorktree: (baseCloneDir: string, worktreePath: string, force?: boolean) => Promise<void>;
    deriveBaseCloneDir: (workspaceRoot: string, repoUrl: string) => string;
  };
  repoRouter: {
    matchIssue: (issue: Issue) => RepoMatch | null;
  };
}

/**
 * Module-scoped lock map. Lock keys are workspace identifiers (sanitized
 * issue identifiers), so all WorkspaceManager instances share the same
 * locking domain — preventing two managers (e.g., orchestrator + HTTP
 * inventory route) from racing on the same on-disk workspace.
 */
const workspaceLocks = new Map<string, Promise<void>>();

async function withWorkspaceLock<T>(workspaceKey: string, task: () => Promise<T>): Promise<T> {
  const previous = workspaceLocks.get(workspaceKey) ?? Promise.resolve();

  let releaseLock: (() => void) | undefined;
  const lock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  workspaceLocks.set(workspaceKey, lock);

  try {
    await previous;
    return await task();
  } finally {
    releaseLock?.();
    if (workspaceLocks.get(workspaceKey) === lock) {
      workspaceLocks.delete(workspaceKey);
    }
  }
}

export class WorkspaceManager implements WorkspacePort {
  private readonly worktreeDeps: WorkspaceManagerWorktreeDeps | null;

  constructor(
    private readonly getConfig: () => ServiceConfig,
    private readonly logger: RisolutoLogger,
    worktreeDeps?: WorkspaceManagerWorktreeDeps,
  ) {
    this.worktreeDeps = worktreeDeps ?? null;
  }

  async ensureWorkspace(issueIdentifier: string, issue?: Issue): Promise<Workspace> {
    const config = this.getConfig();

    if (config.workspace.strategy === "worktree") {
      return this.ensureWorktreeWorkspace(config, issueIdentifier, issue);
    }
    return this.ensureDirectoryWorkspace(config, issueIdentifier);
  }

  async prepareForAttempt(workspace: Workspace): Promise<void> {
    this.assertWorkspaceWithinRoot(workspace);
    for (const transientDirectory of TRANSIENT_DIRECTORIES) {
      const target = path.resolve(workspace.path, transientDirectory);
      const normalizedTarget = path.resolve(target);
      if (isWithinRoot(workspace.path, normalizedTarget)) {
        await rm(normalizedTarget, { recursive: true, force: true });
      }
    }
  }

  async runBeforeRun(workspace: Workspace, issueIdentifier: string): Promise<void> {
    const sanitized = sanitizeIdentifier(issueIdentifier);
    await this.runHook(this.getConfig().workspace.hooks.beforeRun, workspace, issueIdentifier, sanitized);
  }

  async runAfterRun(workspace: Workspace, issueIdentifier: string): Promise<void> {
    const sanitized = sanitizeIdentifier(issueIdentifier);
    await this.runHook(this.getConfig().workspace.hooks.afterRun, workspace, issueIdentifier, sanitized);
  }

  async removeWorkspace(issueIdentifier: string, issue?: Issue): Promise<void> {
    await this.removeWorkspaceWithResult(issueIdentifier, issue);
  }

  async removeWorkspaceWithResult(issueIdentifier: string, issue?: Issue): Promise<WorkspaceRemovalResult> {
    const config = this.getConfig();

    if (config.workspace.strategy === "worktree") {
      return this.removeWorktreeWorkspace(config, issueIdentifier, issue);
    }
    return this.removeDirectoryWorkspace(config, issueIdentifier);
  }

  withLock<T>(workspaceKey: string, task: () => Promise<T>): Promise<T> {
    return withWorkspaceLock(workspaceKey, task);
  }

  private async ensureDirectoryWorkspace(config: ServiceConfig, issueIdentifier: string): Promise<Workspace> {
    await mkdir(config.workspace.root, { recursive: true });
    const { workspaceKey, workspacePath } = resolveWorkspacePath(config.workspace.root, issueIdentifier);

    let createdNow = false;
    try {
      try {
        const info = await stat(workspacePath);
        if (!info.isDirectory()) {
          throw new Error(`workspace target is not a directory: ${workspacePath}`);
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          throw error;
        }
        await mkdir(workspacePath, { recursive: false });
        createdNow = true;
      }

      const workspace = { path: workspacePath, workspaceKey, createdNow };
      if (createdNow) {
        await this.runHook(config.workspace.hooks.afterCreate, workspace, issueIdentifier, workspaceKey);
      }
      return workspace;
    } catch (error) {
      if (createdNow) {
        await rm(workspacePath, { recursive: true, force: true });
      }
      throw error;
    }
  }

  private async ensureWorktreeWorkspace(
    config: ServiceConfig,
    issueIdentifier: string,
    issue?: Issue,
  ): Promise<Workspace> {
    if (!issue) {
      throw new Error("worktree strategy requires the full Issue object");
    }
    if (!this.worktreeDeps) {
      throw new Error("worktree strategy requires gitManager and repoRouter deps");
    }

    const repoMatch = this.worktreeDeps.repoRouter.matchIssue(issue);
    if (!repoMatch) {
      throw new Error(
        `worktree strategy requires a repo match for issue ${issueIdentifier} — no matching repo route found`,
      );
    }

    await mkdir(config.workspace.root, { recursive: true });
    const { workspaceKey, workspacePath } = resolveWorkspacePath(config.workspace.root, issueIdentifier);
    const baseCloneDir = this.worktreeDeps.gitManager.deriveBaseCloneDir(config.workspace.root, repoMatch.repoUrl);

    const worktreeExists = await pathIsDirectory(workspacePath);
    const createdNow = !worktreeExists;

    if (createdNow) {
      await this.worktreeDeps.gitManager.setupWorktree(
        repoMatch,
        baseCloneDir,
        workspacePath,
        issue,
        config.workspace.branchPrefix,
      );
    }

    const workspace = { path: workspacePath, workspaceKey, createdNow, gitBaseDir: baseCloneDir };
    if (createdNow) {
      await this.runHook(config.workspace.hooks.afterCreate, workspace, issueIdentifier, workspaceKey);
    }
    return workspace;
  }

  private async removeDirectoryWorkspace(
    config: ServiceConfig,
    issueIdentifier: string,
  ): Promise<WorkspaceRemovalResult> {
    const { workspaceKey, workspacePath } = resolveWorkspacePath(config.workspace.root, issueIdentifier);

    const workspace = { path: workspacePath, workspaceKey, createdNow: false };
    if (!(await pathIsDirectory(workspacePath))) {
      return emptyRemovalResult();
    }

    await this.runBeforeRemoveHook(config, workspace, issueIdentifier, workspaceKey);
    const protection = await this.enforcePreCleanupCommit(workspace, issueIdentifier);
    if (protection.preserved) {
      return protection;
    }
    await rm(workspacePath, { recursive: true, force: true });
    return { ...protection, removed: true };
  }

  private async removeWorktreeWorkspace(
    config: ServiceConfig,
    issueIdentifier: string,
    issue?: Issue,
  ): Promise<WorkspaceRemovalResult> {
    if (!this.worktreeDeps) {
      throw new Error("worktree strategy requires gitManager and repoRouter deps");
    }

    const { workspaceKey, workspacePath } = resolveWorkspacePath(config.workspace.root, issueIdentifier);

    if (!(await pathIsDirectory(workspacePath))) {
      return emptyRemovalResult();
    }

    const workspace = { path: workspacePath, workspaceKey, createdNow: false };
    await this.runBeforeRemoveHook(config, workspace, issueIdentifier, workspaceKey);
    const protection = await this.enforcePreCleanupCommit(workspace, issueIdentifier);
    if (protection.preserved) {
      return protection;
    }

    if (issue) {
      const repoMatch = this.worktreeDeps.repoRouter.matchIssue(issue);
      if (repoMatch) {
        const baseCloneDir = this.worktreeDeps.gitManager.deriveBaseCloneDir(config.workspace.root, repoMatch.repoUrl);
        try {
          await this.worktreeDeps.gitManager.removeWorktree(baseCloneDir, workspacePath, true);
          return { ...protection, removed: true };
        } catch (error) {
          this.logger.warn(
            {
              workspacePath,
              issueIdentifier,
              error: toErrorString(error),
            },
            "git worktree remove failed; falling back to rm",
          );
        }
      }
    }

    await rm(workspacePath, { recursive: true, force: true });
    return { ...protection, removed: true };
  }

  private async runBeforeRemoveHook(
    config: ServiceConfig,
    workspace: Workspace,
    issueIdentifier: string,
    workspaceKey: string,
  ): Promise<void> {
    try {
      await this.runHook(config.workspace.hooks.beforeRemove, workspace, issueIdentifier, workspaceKey);
    } catch (error) {
      this.logger.warn(
        {
          workspacePath: workspace.path,
          issueIdentifier,
          error: toErrorString(error),
          classification: "before_remove_hook_failed",
        },
        "before_remove hook failed; continuing with workspace removal",
      );
    }
  }

  private assertWorkspaceWithinRoot(workspace: Workspace): void {
    const root = this.getConfig().workspace.root;
    if (!isWithinRoot(root, workspace.path)) {
      throw new TypeError(`workspace path escaped root: ${workspace.path}`);
    }
  }

  private async runHook(
    hook: string | null,
    workspace: Workspace,
    issueIdentifier: string,
    sanitizedIdentifier: string,
  ): Promise<void> {
    if (!hook) {
      return;
    }
    this.assertWorkspaceWithinRoot(workspace);

    const timeoutMs = this.getConfig().workspace.hooks.timeoutMs;
    const normalizedCwd = path.resolve(workspace.path);
    await new Promise<void>((resolve, reject) => {
      const child = spawn("sh", ["-lc", hook], {
        cwd: normalizedCwd,
        env: {
          ...process.env,
          PATH: buildSafePath(),
          RISOLUTO_WORKSPACE_PATH: workspace.path,
          RISOLUTO_ISSUE_IDENTIFIER: sanitizedIdentifier,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`hook timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on("exit", (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
          return;
        }
        this.logger.warn(
          {
            workspacePath: workspace.path,
            issueIdentifier,
            code,
            stderr: stderr.trim() || null,
          },
          "workspace hook failed",
        );
        reject(new Error(`hook exited with code ${code}`));
      });
    });
  }

  private async enforcePreCleanupCommit(
    workspace: Workspace,
    issueIdentifier: string,
  ): Promise<WorkspaceRemovalResult> {
    const gitManager = this.worktreeDeps?.gitManager;
    if (!gitManager) {
      return emptyRemovalResult();
    }

    const gitMetadataPath = path.join(workspace.path, ".git");
    const hasGitMetadata = await pathExists(gitMetadataPath);
    if (!hasGitMetadata) {
      return emptyRemovalResult();
    }

    let hasChanges: boolean;
    try {
      hasChanges = await gitManager.hasUncommittedChanges(workspace.path);
    } catch (error) {
      return {
        removed: false,
        preserved: true,
        hadUncommittedChanges: true,
        autoCommitAttempted: false,
        autoCommitSha: null,
        autoCommitError: toErrorString(error),
      };
    }

    if (!hasChanges) {
      return emptyRemovalResult();
    }

    try {
      const autoCommitSha = await gitManager.autoCommit(
        workspace.path,
        `[${issueIdentifier}] auto-commit: workspace cleanup preservation`,
        { noVerify: true },
      );
      return {
        removed: false,
        preserved: false,
        hadUncommittedChanges: true,
        autoCommitAttempted: true,
        autoCommitSha,
        autoCommitError: null,
      };
    } catch (error) {
      return {
        removed: false,
        preserved: true,
        hadUncommittedChanges: true,
        autoCommitAttempted: true,
        autoCommitSha: null,
        autoCommitError: toErrorString(error),
      };
    }
  }
}

function emptyRemovalResult(): WorkspaceRemovalResult {
  return {
    removed: false,
    preserved: false,
    hadUncommittedChanges: false,
    autoCommitAttempted: false,
    autoCommitSha: null,
    autoCommitError: null,
  };
}
