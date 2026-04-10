import type { AutomationMode } from "../core/types.js";
import type { AutomationRunRecord, AutomationRunStatus, AutomationRunTrigger } from "./types.js";

export interface CreateAutomationRunInput {
  automationName: string;
  mode: AutomationMode;
  trigger: AutomationRunTrigger;
  repoUrl: string | null;
  startedAt: string;
}

export interface FinishAutomationRunInput {
  status: Exclude<AutomationRunStatus, "running">;
  output: string | null;
  details: Record<string, unknown> | null;
  issueId: string | null;
  issueIdentifier: string | null;
  issueUrl: string | null;
  error: string | null;
  finishedAt: string;
}

export interface ListAutomationRunsOptions {
  limit?: number;
  automationName?: string;
}

export interface AutomationStorePort {
  createRun(input: CreateAutomationRunInput): Promise<AutomationRunRecord>;
  finishRun(id: string, input: FinishAutomationRunInput): Promise<AutomationRunRecord | null>;
  listRuns(options?: ListAutomationRunsOptions): Promise<AutomationRunRecord[]>;
  countRuns(): Promise<number>;
}
