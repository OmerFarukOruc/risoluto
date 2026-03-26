import type { AttemptEvent, AttemptRecord } from "@symphony/shared";

import type { AttemptInsert, AttemptRow, EventInsert, EventRow } from "./schema.js";

export function toUsageColumns(usage: AttemptRecord["tokenUsage"] | AttemptEvent["usage"]): {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
} {
  if (!usage) {
    return { inputTokens: null, outputTokens: null, totalTokens: null };
  }
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };
}

export function fromUsageColumns(inputTokens: number | null, outputTokens: number | null, totalTokens: number | null) {
  if (inputTokens === null || outputTokens === null || totalTokens === null) {
    return null;
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

export function serializeJson(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

export function parseJson<T>(value: string | null): T | null {
  if (value === null) {
    return null;
  }
  return JSON.parse(value) as T;
}

export function toAttemptInsert(attempt: AttemptRecord): AttemptInsert {
  const tokenUsage = toUsageColumns(attempt.tokenUsage);
  return {
    attemptId: attempt.attemptId,
    issueId: attempt.issueId,
    issueIdentifier: attempt.issueIdentifier,
    title: attempt.title,
    workspaceKey: attempt.workspaceKey,
    workspacePath: attempt.workspacePath,
    status: attempt.status,
    attemptNumber: attempt.attemptNumber,
    startedAt: attempt.startedAt,
    endedAt: attempt.endedAt,
    model: attempt.model,
    reasoningEffort: attempt.reasoningEffort,
    modelSource: attempt.modelSource,
    threadId: attempt.threadId,
    turnId: attempt.turnId,
    turnCount: attempt.turnCount,
    errorCode: attempt.errorCode,
    errorMessage: attempt.errorMessage,
    tokenUsageInputTokens: tokenUsage.inputTokens,
    tokenUsageOutputTokens: tokenUsage.outputTokens,
    tokenUsageTotalTokens: tokenUsage.totalTokens,
    pullRequestUrl: attempt.pullRequestUrl ?? null,
    stopSignal: attempt.stopSignal ?? null,
  };
}

export function fromAttemptRow(row: AttemptRow): AttemptRecord {
  return {
    attemptId: row.attemptId,
    issueId: row.issueId,
    issueIdentifier: row.issueIdentifier,
    title: row.title,
    workspaceKey: row.workspaceKey,
    workspacePath: row.workspacePath,
    status: row.status,
    attemptNumber: row.attemptNumber,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    model: row.model,
    reasoningEffort: row.reasoningEffort,
    modelSource: row.modelSource,
    threadId: row.threadId,
    turnId: row.turnId,
    turnCount: row.turnCount,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    tokenUsage: fromUsageColumns(row.tokenUsageInputTokens, row.tokenUsageOutputTokens, row.tokenUsageTotalTokens),
    pullRequestUrl: row.pullRequestUrl,
    stopSignal: row.stopSignal,
  };
}

export function toEventInsert(event: AttemptEvent, sequence: number): EventInsert {
  const usage = toUsageColumns(event.usage ?? null);
  return {
    attemptId: event.attemptId,
    sequence,
    at: event.at,
    issueId: event.issueId,
    issueIdentifier: event.issueIdentifier,
    sessionId: event.sessionId,
    event: event.event,
    message: event.message,
    content: event.content ?? null,
    metadataJson: serializeJson(event.metadata ?? null),
    usageInputTokens: usage.inputTokens,
    usageOutputTokens: usage.outputTokens,
    usageTotalTokens: usage.totalTokens,
    rateLimitsJson: serializeJson(event.rateLimits ?? null),
  };
}

export function fromEventRow(row: EventRow): AttemptEvent {
  return {
    attemptId: row.attemptId,
    at: row.at,
    issueId: row.issueId,
    issueIdentifier: row.issueIdentifier,
    sessionId: row.sessionId,
    event: row.event,
    message: row.message,
    content: row.content,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson),
    usage: fromUsageColumns(row.usageInputTokens, row.usageOutputTokens, row.usageTotalTokens),
    rateLimits: parseJson<unknown>(row.rateLimitsJson),
  };
}
