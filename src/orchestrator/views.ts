import type { Issue, IssueBlockerRef, ReasoningEffort, TokenUsageSnapshot } from "../core/types.js";

export interface IssueView {
  issueId: string;
  identifier: string;
  title: string;
  state: string;
  workspaceKey: string | null;
  workspacePath?: string | null;
  message: string | null;
  status: string;
  updatedAt: string;
  attempt: number | null;
  error: string | null;
  priority?: number | null;
  labels?: string[];
  startedAt?: string | null;
  lastEventAt?: string | null;
  tokenUsage?: TokenUsageSnapshot | null;
  model?: string | null;
  reasoningEffort?: ReasoningEffort | null;
  modelSource?: "default" | "override" | null;
  configuredModel?: string | null;
  configuredReasoningEffort?: ReasoningEffort | null;
  configuredModelSource?: "default" | "override" | null;
  modelChangePending?: boolean;
  url?: string | null;
  description?: string | null;
  blockedBy?: IssueBlockerRef[];
  branchName?: string | null;
  createdAt?: string | null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isHardFailure(errorCode: string | null): boolean {
  return ["startup_failed", "turn_input_required", "inactive", "terminal", "shutdown", "cancelled"].includes(
    errorCode ?? "",
  );
}

export function issueView(issue: Issue, extra?: Partial<IssueView>): IssueView {
  return {
    issueId: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    state: issue.state,
    workspaceKey: null,
    message: null,
    status: issue.state,
    updatedAt: issue.updatedAt ?? nowIso(),
    attempt: null,
    error: null,
    url: issue.url,
    description: issue.description,
    blockedBy: issue.blockedBy,
    branchName: issue.branchName,
    createdAt: issue.createdAt,
    ...extra,
  };
}

export function usageDelta(previous: TokenUsageSnapshot | null, next: TokenUsageSnapshot): TokenUsageSnapshot {
  return {
    inputTokens: Math.max(0, next.inputTokens - (previous?.inputTokens ?? 0)),
    outputTokens: Math.max(0, next.outputTokens - (previous?.outputTokens ?? 0)),
    totalTokens: Math.max(0, next.totalTokens - (previous?.totalTokens ?? 0)),
  };
}
