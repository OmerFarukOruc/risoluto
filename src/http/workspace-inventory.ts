import type { Request, Response } from "express";

import type { ConfigStore } from "../config/store.js";
import type { OrchestratorPort } from "../orchestrator/port.js";
import {
  listWorkspaceInventory,
  removeWorkspaceDirectory,
  type WorkspaceInventoryEntry as DomainWorkspaceInventoryEntry,
  type WorkspaceInventoryResult as DomainWorkspaceInventoryResult,
} from "../workspace/inventory.js";
import type { WorkspacePort } from "../workspace/port.js";

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
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

export interface WorkspaceInventoryDeps {
  orchestrator: OrchestratorPort;
  configStore?: ConfigStore;
  workspaceManager: Pick<WorkspacePort, "withLock">;
}

function toHttpEntry(entry: DomainWorkspaceInventoryEntry): WorkspaceInventoryEntry {
  return {
    workspace_key: entry.workspaceKey,
    path: entry.path,
    status: entry.status,
    strategy: entry.strategy,
    issue: entry.issue,
    disk_bytes: entry.diskBytes,
    last_modified_at: entry.lastModifiedAt,
  };
}

function toHttpResponse(inventory: DomainWorkspaceInventoryResult): WorkspaceInventoryResponse {
  return {
    workspaces: inventory.workspaces.map(toHttpEntry),
    generated_at: inventory.generatedAt,
    total: inventory.total,
    active: inventory.active,
    orphaned: inventory.orphaned,
  };
}

function activeWorkspaceKeys(snapshot: ReturnType<OrchestratorPort["getSnapshot"]>): Set<string> {
  return new Set(
    [...snapshot.running, ...(snapshot.retrying ?? [])]
      .map((view) => view.workspaceKey)
      .filter((workspaceKey): workspaceKey is string => typeof workspaceKey === "string" && workspaceKey.length > 0),
  );
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
  const inventory = await listWorkspaceInventory({
    workspaceRoot,
    strategy,
    runningViews: snapshot.running,
    retryingViews: snapshot.retrying ?? [],
    completedViews: snapshot.completed ?? [],
  });

  res.json(toHttpResponse(inventory));
}

export async function handleWorkspaceRemove(deps: WorkspaceInventoryDeps, req: Request, res: Response): Promise<void> {
  const workspaceKey = String(req.params.workspace_key);
  if (!workspaceKey) {
    res.status(400).json({ error: { code: "bad_request", message: "Missing workspace_key parameter" } });
    return;
  }

  const config = deps.configStore?.getConfig() ?? null;
  const workspaceRoot = config?.workspace.root;

  if (!workspaceRoot) {
    res.status(503).json({ error: { code: "config_unavailable", message: "Workspace config not available" } });
    return;
  }

  await deps.workspaceManager.withLock(workspaceKey, async () => {
    const snapshot = deps.orchestrator.getSnapshot();
    const result = await removeWorkspaceDirectory({
      workspaceRoot,
      workspaceKey,
      activeWorkspaceKeys: activeWorkspaceKeys(snapshot),
    });

    switch (result.status) {
      case "removed":
        res.status(204).end();
        return;
      case "invalid_key":
        res.status(400).json({ error: { code: "bad_request", message: "Invalid workspace key" } });
        return;
      case "active":
        res.status(409).json({ error: { code: "conflict", message: "Cannot remove an active workspace" } });
        return;
      case "not_found":
        res.status(404).json({ error: { code: "not_found", message: "Workspace not found" } });
        return;
    }
  });
}
