import type { Express } from "express";

import type { HttpRouteDeps } from "../route-types.js";
import { methodNotAllowed } from "../route-helpers.js";
import { handleWorkspaceInventory, handleWorkspaceRemove } from "../workspace-inventory.js";

export function registerWorkspaceRoutes(app: Express, deps: HttpRouteDeps): void {
  if (!deps.workspaceManager) {
    // Skip registration when not wired — tests that don't exercise workspace
    // routes will hit the 404 handler. Production wiring always provides one.
    return;
  }
  const workspaceManager = deps.workspaceManager;

  app
    .route("/api/v1/workspaces")
    .get(async (req, res) => {
      await handleWorkspaceInventory(
        {
          orchestrator: deps.orchestrator,
          configStore: deps.configStore,
          workspaceManager,
        },
        req,
        res,
      );
    })
    .all((_req, res) => {
      methodNotAllowed(res);
    });

  app
    .route("/api/v1/workspaces/:workspace_key")
    .delete(async (req, res) => {
      await handleWorkspaceRemove(
        {
          orchestrator: deps.orchestrator,
          configStore: deps.configStore,
          workspaceManager,
        },
        req,
        res,
      );
    })
    .all((_req, res) => {
      methodNotAllowed(res, ["DELETE"]);
    });
}
