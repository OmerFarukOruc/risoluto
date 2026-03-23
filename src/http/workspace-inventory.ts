import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { Request, Response } from "express";

import type { ConfigStore } from "../config/store.js";
import type { Orchestrator } from "../orchestrator/orchestrator.js";
import type { RuntimeIssueView } from "../core/types.js";

/* ------------------------------------------------------------------ */
/*  Response types                                                     */
/* ------------------------------------------------------------------ */

interface WorkspaceInventoryEntry {
  workspace_key: string;
  path: string;
  status: "running" | "retrying" | "completed" | "orphaned";
  strategy: string;
  issue: {
    identifier: string;
    title: string;
    state: string;
  } | null;
  disk_bytes: number | null;
  last_modified_at: string | null;
}

interface WorkspaceInventoryResponse {
  workspaces: WorkspaceInventoryEntry[];
  generated_at: string;
  total: number;
  active: number;
  orphaned: number;
}

/* ------------------------------------------------------------------ */
/*  Disk usage helpers                                                  */
/* ------------------------------------------------------------------ */

async function computeDirSize(dirPath: string): Promise<number> {
  let total = 0;
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        total += await computeDirSize(fullPath);
      } else if (entry.isFile()) {
        const info = await stat(fullPath);
        total += info.size;
      }
    }
  } catch {
    // Permission errors or race conditions — return what we have
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

/* ------------------------------------------------------------------ */
/*  Workspace classification                                            */
/* ------------------------------------------------------------------ */

interface WorkspaceStatus {
  status: "running" | "retrying" | "completed" | "orphaned";
  issue: { identifier: string; title: string; state: string } | null;
}

function classifyWorkspace(
  key: string,
  runningViews: RuntimeIssueView[],
  retryingViews: RuntimeIssueView[],
  completedViews: RuntimeIssueView[],
): WorkspaceStatus {
  const running = runningViews.find((v) => v.workspaceKey === key);
  if (running) {
    return {
      status: "running" as const,
      issue: { identifier: running.identifier, title: running.title, state: running.state },
    };
  }

  const retrying = retryingViews.find((v) => v.workspaceKey === key);
  if (retrying) {
    return {
      status: "retrying" as const,
      issue: { identifier: retrying.identifier, title: retrying.title, state: retrying.state },
    };
  }

  const completed = completedViews.find((v) => v.workspaceKey === key);
  if (completed) {
    return {
      status: "completed" as const,
      issue: { identifier: completed.identifier, title: completed.title, state: completed.state },
    };
  }

  return { status: "orphaned", issue: null };
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

export interface WorkspaceInventoryDeps {
  orchestrator: Orchestrator;
  configStore?: ConfigStore;
}

export async function handleWorkspaceInventory(
  deps: WorkspaceInventoryDeps,
  _req: Request,
  res: Response,
): Promise<void> {
  const config = deps.configStore?.getConfig() ?? null;
  const workspaceRoot = config?.workspace.root;
  const strategy = config?.workspace.strategy ?? "directory";

  if (!workspaceRoot) {
    res.status(503).json({ error: { code: "config_unavailable", message: "Workspace config not available" } });
    return;
  }

  const snapshot = deps.orchestrator.getSnapshot();

  let fsEntries: string[];
  try {
    const entries = await readdir(workspaceRoot, { withFileTypes: true });
    fsEntries = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      res.json({
        workspaces: [],
        generated_at: new Date().toISOString(),
        total: 0,
        active: 0,
        orphaned: 0,
      } satisfies WorkspaceInventoryResponse);
      return;
    }
    throw error;
  }

  // Build inventory entries
  const workspaces: WorkspaceInventoryEntry[] = await Promise.all(
    fsEntries.map(async (key) => {
      const wsPath = path.join(workspaceRoot, key);
      const { status, issue } = classifyWorkspace(key, snapshot.running, snapshot.retrying, snapshot.completed ?? []);

      const [diskBytes, lastModified] = await Promise.all([computeDirSize(wsPath), getDirMtime(wsPath)]);

      return {
        workspace_key: key,
        path: wsPath,
        status,
        strategy,
        issue,
        disk_bytes: diskBytes,
        last_modified_at: lastModified,
      };
    }),
  );

  // Sort: running first, then retrying, completed, orphaned
  const statusOrder: Record<string, number> = { running: 0, retrying: 1, completed: 2, orphaned: 3 };
  workspaces.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));

  const active = workspaces.filter((w) => w.status === "running" || w.status === "retrying").length;
  const orphaned = workspaces.filter((w) => w.status === "orphaned").length;

  const response: WorkspaceInventoryResponse = {
    workspaces,
    generated_at: new Date().toISOString(),
    total: workspaces.length,
    active,
    orphaned,
  };

  res.json(response);
}
