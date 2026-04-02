import type { Express, Request, Response } from "express";

import { methodNotAllowed } from "../http/route-helpers.js";
import { hasLinearCredentials } from "./setup-status.js";
import { handleDetectDefaultBranch } from "./detect-default-branch.js";
import { handleDeleteRepoRoute, handleGetRepoRoutes, handlePostRepoRoute } from "./repo-route-handlers.js";
import type { SetupApiDeps } from "./setup-handlers.js";
import {
  handleGetLinearProjects,
  handleGetPkceAuthStatus,
  handleGetStatus,
  handlePostPkceAuthCancel,
  handlePostCodexAuth,
  handlePostCreateLabel,
  handlePostCreateProject,
  handlePostCreateTestIssue,
  handlePostGithubToken,
  handlePostLinearProject,
  handlePostMasterKey,
  handlePostOpenaiKey,
  handlePostPkceAuthStart,
  handlePostReset,
} from "./setup-handlers.js";

export type { SetupApiDeps } from "./setup-handlers.js";

function isBootstrapConfigured(deps: SetupApiDeps): boolean {
  return deps.secretsStore.isInitialized() && hasLinearCredentials(deps.secretsStore);
}

function rejectSetupDiscoveryAfterBootstrap(deps: SetupApiDeps, res: Response): boolean {
  if (!isBootstrapConfigured(deps)) {
    return false;
  }
  res.status(404).json({ error: { code: "not_found", message: "Not found" } });
  return true;
}

function withBootstrapDiscoveryGate(
  deps: SetupApiDeps,
  handler: (req: Request, res: Response) => void | Promise<void>,
): (req: Request, res: Response) => void | Promise<void> {
  return (req, res) => {
    if (rejectSetupDiscoveryAfterBootstrap(deps, res)) {
      return;
    }
    return handler(req, res);
  };
}

export function registerSetupApi(app: Express, deps: SetupApiDeps): void {
  app
    .route("/api/v1/setup/status")
    .get(handleGetStatus(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/reset")
    .post(handlePostReset(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/master-key")
    .post(handlePostMasterKey(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/linear-projects")
    .get(withBootstrapDiscoveryGate(deps, handleGetLinearProjects(deps)))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/linear-project")
    .post(handlePostLinearProject(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/openai-key")
    .post(handlePostOpenaiKey(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/codex-auth")
    .post(handlePostCodexAuth(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/pkce-auth/start")
    .post(handlePostPkceAuthStart(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/pkce-auth/status")
    .get(handleGetPkceAuthStatus(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/pkce-auth/cancel")
    .post(handlePostPkceAuthCancel(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/github-token")
    .post(handlePostGithubToken(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/create-test-issue")
    .post(handlePostCreateTestIssue(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/create-label")
    .post(handlePostCreateLabel(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/create-project")
    .post(handlePostCreateProject(deps))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/repo-route")
    .post(handlePostRepoRoute({ configOverlayStore: deps.configOverlayStore }))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/repo-route/:index")
    .delete(handleDeleteRepoRoute({ configOverlayStore: deps.configOverlayStore }))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/repo-routes")
    .get(withBootstrapDiscoveryGate(deps, handleGetRepoRoutes({ configOverlayStore: deps.configOverlayStore })))
    .all((_req, res) => methodNotAllowed(res));

  app
    .route("/api/v1/setup/detect-default-branch")
    .post(handleDetectDefaultBranch({ secretsStore: deps.secretsStore }))
    .all((_req, res) => methodNotAllowed(res));
}
