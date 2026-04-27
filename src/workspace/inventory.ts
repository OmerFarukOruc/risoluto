import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import type { RuntimeIssueView } from "../core/types.js";
import { isWithinRoot } from "./paths.js";

export type WorkspaceInventoryStatus = "running" | "retrying" | "completed" | "orphaned";

export interface WorkspaceInventoryIssue {
  identifier: string;
  title: string;
  state: string;
}

export interface WorkspaceInventoryEntry {
  workspaceKey: string;
  path: string;
  status: WorkspaceInventoryStatus;
  strategy: string;
  issue: WorkspaceInventoryIssue | null;
  diskBytes: number | null;
  lastModifiedAt: string | null;
}

export interface WorkspaceInventoryResult {
  workspaces: WorkspaceInventoryEntry[];
  generatedAt: string;
  total: number;
  active: number;
  orphaned: number;
}

export interface WorkspaceInventoryInput {
  workspaceRoot: string;
  strategy: string;
  runningViews: RuntimeIssueView[];
  retryingViews: RuntimeIssueView[];
  completedViews: RuntimeIssueView[];
}

export type WorkspaceRemoveResult =
  | { status: "removed"; path: string }
  | { status: "invalid_key" }
  | { status: "active" }
  | { status: "not_found" };

export interface WorkspaceRemoveInput {
  workspaceRoot: string;
  workspaceKey: string;
  activeWorkspaceKeys: ReadonlySet<string>;
}

async function computeDirSize(dirPath: string): Promise<number> {
  let total = 0;
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const isDirectory = entry.isDirectory();
      const isFile = entry.isFile();
      if (!isDirectory && !isFile) continue;

      const fullPath = path.join(dirPath, entry.name);
      if (isDirectory) {
        total += await computeDirSize(fullPath);
      } else {
        const info = await stat(fullPath);
        total += info.size;
      }
    }
  } catch {
    // Permission errors or race conditions should not prevent inventory listing.
  }
  return total;
}

async function getDirMtime(dirPath: string): Promise<string | null> {
  try {
    const info = await stat(dirPath);
    return info.mtime.toISOString();
  } catch {
    return null;
  }
}

function classifyWorkspace(
  key: string,
  runningViews: RuntimeIssueView[],
  retryingViews: RuntimeIssueView[],
  completedViews: RuntimeIssueView[],
): Pick<WorkspaceInventoryEntry, "status" | "issue"> {
  const running = runningViews.find((view) => view.workspaceKey === key);
  if (running) {
    return {
      status: "running",
      issue: { identifier: running.identifier, title: running.title, state: running.state },
    };
  }

  const retrying = retryingViews.find((view) => view.workspaceKey === key);
  if (retrying) {
    return {
      status: "retrying",
      issue: { identifier: retrying.identifier, title: retrying.title, state: retrying.state },
    };
  }

  const completed = completedViews.find((view) => view.workspaceKey === key);
  if (completed) {
    return {
      status: "completed",
      issue: { identifier: completed.identifier, title: completed.title, state: completed.state },
    };
  }

  return { status: "orphaned", issue: null };
}

export async function listWorkspaceInventory(input: WorkspaceInventoryInput): Promise<WorkspaceInventoryResult> {
  let fsEntries: string[];
  try {
    const entries = await readdir(input.workspaceRoot, { withFileTypes: true });
    fsEntries = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        workspaces: [],
        generatedAt: new Date().toISOString(),
        total: 0,
        active: 0,
        orphaned: 0,
      };
    }
    throw error;
  }

  const workspaces: WorkspaceInventoryEntry[] = await Promise.all(
    fsEntries.map(async (key) => {
      const workspacePath = path.join(input.workspaceRoot, key);
      const { status, issue } = classifyWorkspace(key, input.runningViews, input.retryingViews, input.completedViews);
      const [diskBytes, lastModifiedAt] = await Promise.all([
        computeDirSize(workspacePath),
        getDirMtime(workspacePath),
      ]);

      return {
        workspaceKey: key,
        path: workspacePath,
        status,
        strategy: input.strategy,
        issue,
        diskBytes,
        lastModifiedAt,
      };
    }),
  );

  const statusOrder: Record<WorkspaceInventoryStatus, number> = {
    running: 0,
    retrying: 1,
    completed: 2,
    orphaned: 3,
  };
  workspaces.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return {
    workspaces,
    generatedAt: new Date().toISOString(),
    total: workspaces.length,
    active: workspaces.filter((workspace) => workspace.status === "running" || workspace.status === "retrying").length,
    orphaned: workspaces.filter((workspace) => workspace.status === "orphaned").length,
  };
}

export async function removeWorkspaceDirectory(input: WorkspaceRemoveInput): Promise<WorkspaceRemoveResult> {
  const resolvedRoot = path.resolve(input.workspaceRoot);
  const workspacePath = path.resolve(input.workspaceRoot, input.workspaceKey);

  if (workspacePath === resolvedRoot || !isWithinRoot(resolvedRoot, workspacePath)) {
    return { status: "invalid_key" };
  }

  if (input.activeWorkspaceKeys.has(input.workspaceKey)) {
    return { status: "active" };
  }

  try {
    const info = await stat(workspacePath);
    if (!info.isDirectory()) {
      return { status: "not_found" };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "not_found" };
    }
    throw error;
  }

  await rm(workspacePath, { recursive: true, force: true });
  return { status: "removed", path: workspacePath };
}
