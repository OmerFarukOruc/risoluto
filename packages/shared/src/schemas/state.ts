import { Type, type Static } from "@sinclair/typebox";

import { NullableNumberSchema, NullableStringSchema, StringArraySchema } from "./common.js";

export const TokenTotalsSchema = Type.Object({
  input_tokens: Type.Number(),
  output_tokens: Type.Number(),
  total_tokens: Type.Number(),
  seconds_running: Type.Number(),
});

export const IssueBlockerRefSchema = Type.Object({
  id: NullableStringSchema,
  identifier: NullableStringSchema,
  state: NullableStringSchema,
});

export const TokenUsageSnapshotSchema = Type.Object({
  inputTokens: Type.Number(),
  outputTokens: Type.Number(),
  totalTokens: Type.Number(),
});

export const RuntimeIssueViewSchema = Type.Object({
  issueId: Type.Optional(Type.String()),
  identifier: Type.String(),
  title: Type.String(),
  state: Type.Optional(Type.String()),
  workspaceKey: Type.Optional(NullableStringSchema),
  workspacePath: Type.Optional(NullableStringSchema),
  message: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  status: Type.Optional(Type.String()),
  updatedAt: Type.Optional(Type.String()),
  attempt: Type.Optional(NullableNumberSchema),
  error: Type.Optional(NullableStringSchema),
  priority: Type.Optional(NullableNumberSchema),
  labels: Type.Optional(StringArraySchema),
  startedAt: Type.Optional(NullableStringSchema),
  lastEventAt: Type.Optional(NullableStringSchema),
  tokenUsage: Type.Optional(Type.Union([TokenUsageSnapshotSchema, Type.Null()])),
  model: Type.Optional(NullableStringSchema),
  reasoningEffort: Type.Optional(NullableStringSchema),
  modelSource: Type.Optional(NullableStringSchema),
  configuredModel: Type.Optional(NullableStringSchema),
  configuredReasoningEffort: Type.Optional(NullableStringSchema),
  configuredModelSource: Type.Optional(NullableStringSchema),
  modelChangePending: Type.Optional(Type.Boolean()),
  url: Type.Optional(NullableStringSchema),
  description: Type.Optional(NullableStringSchema),
  blockedBy: Type.Optional(Type.Array(IssueBlockerRefSchema)),
  branchName: Type.Optional(NullableStringSchema),
  pullRequestUrl: Type.Optional(NullableStringSchema),
  nextRetryDueAt: Type.Optional(NullableStringSchema),
  createdAt: Type.Optional(NullableStringSchema),
});

export const WorkflowColumnIssueSchema = Type.Object(
  {
    identifier: Type.String(),
  },
  { additionalProperties: true },
);

export const WorkflowColumnSchema = Type.Object({
  key: Type.String(),
  label: Type.String(),
  kind: Type.String(),
  terminal: Type.Boolean(),
  count: Type.Number(),
  issues: Type.Array(WorkflowColumnIssueSchema),
});

export const RuntimeEventSchema = Type.Object({
  at: Type.String(),
  issue_id: NullableStringSchema,
  issue_identifier: NullableStringSchema,
  session_id: NullableStringSchema,
  event: Type.String(),
  message: Type.String(),
  content: NullableStringSchema,
  metadata: Type.Unknown(),
});

export const StallEventSchema = Type.Object({
  at: Type.String(),
  issue_id: Type.String(),
  issue_identifier: Type.String(),
  silent_ms: Type.Number(),
  timeout_ms: Type.Number(),
});

export const SystemHealthSchema = Type.Object({
  status: Type.Union([Type.Literal("healthy"), Type.Literal("degraded"), Type.Literal("critical")]),
  checked_at: Type.String(),
  running_count: Type.Number(),
  message: Type.String(),
});

export const RuntimeCountsSchema = Type.Object(
  {
    running: Type.Number(),
    retrying: Type.Number(),
  },
  { additionalProperties: Type.Number() },
);

export const RuntimeSnapshotResponseSchema = Type.Object({
  generated_at: Type.String(),
  counts: RuntimeCountsSchema,
  queued: Type.Array(RuntimeIssueViewSchema),
  running: Type.Array(RuntimeIssueViewSchema),
  retrying: Type.Array(RuntimeIssueViewSchema),
  completed: Type.Array(RuntimeIssueViewSchema),
  workflow_columns: Type.Array(WorkflowColumnSchema),
  codex_totals: TokenTotalsSchema,
  rate_limits: Type.Unknown(),
  recent_events: Type.Array(RuntimeEventSchema),
  stall_events: Type.Optional(Type.Array(StallEventSchema)),
  system_health: Type.Optional(SystemHealthSchema),
});

export type TokenTotals = Static<typeof TokenTotalsSchema>;
export type IssueBlockerRef = Static<typeof IssueBlockerRefSchema>;
export type TokenUsageSnapshot = Static<typeof TokenUsageSnapshotSchema>;
export type RuntimeIssueView = Static<typeof RuntimeIssueViewSchema>;
export type WorkflowColumn = Static<typeof WorkflowColumnSchema>;
export type RuntimeEvent = Static<typeof RuntimeEventSchema>;
export type StallEvent = Static<typeof StallEventSchema>;
export type SystemHealth = Static<typeof SystemHealthSchema>;
export type RuntimeCounts = Static<typeof RuntimeCountsSchema>;
export type RuntimeSnapshotResponse = Static<typeof RuntimeSnapshotResponseSchema>;
