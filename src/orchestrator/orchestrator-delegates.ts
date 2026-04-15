import type { OrchestratorContext } from "./context.js";
import type { OrchestratorDeps } from "./runtime-types.js";

import { createRunLifecycleCoordinator, type OrchestratorState } from "./run-lifecycle-coordinator.js";

export type { OrchestratorState } from "./run-lifecycle-coordinator.js";

/**
 * Compatibility wrappers for older tests while the orchestrator runtime logic
 * moves behind the deeper run-lifecycle coordinator.
 */
export function buildCtx(state: OrchestratorState, deps: OrchestratorDeps): OrchestratorContext {
  return createRunLifecycleCoordinator(state, deps).getContext();
}

export async function cleanupTerminalWorkspaces(state: OrchestratorState, deps: OrchestratorDeps): Promise<void> {
  await createRunLifecycleCoordinator(state, deps).cleanupTerminalWorkspaces();
}
