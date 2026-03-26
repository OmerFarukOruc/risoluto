import { Type, type Static } from "@sinclair/typebox";

import { NullableStringSchema } from "./common.js";

export const WorkspaceStatusSchema = Type.Union([
  Type.Literal("running"),
  Type.Literal("retrying"),
  Type.Literal("completed"),
  Type.Literal("orphaned"),
]);

export const WorkspaceIssueSummarySchema = Type.Union([
  Type.Object({
    identifier: Type.String(),
    title: Type.String(),
    state: Type.String(),
  }),
  Type.Null(),
]);

export const WorkspaceInventoryEntrySchema = Type.Object({
  workspace_key: Type.String(),
  path: Type.String(),
  status: WorkspaceStatusSchema,
  strategy: Type.String(),
  issue: WorkspaceIssueSummarySchema,
  disk_bytes: Type.Union([Type.Number(), Type.Null()]),
  last_modified_at: NullableStringSchema,
});

export const WorkspaceInventoryResponseSchema = Type.Object({
  workspaces: Type.Array(WorkspaceInventoryEntrySchema),
  generated_at: Type.String(),
  total: Type.Number(),
  active: Type.Number(),
  orphaned: Type.Number(),
});

export const WorkspaceKeyParamsSchema = Type.Object({
  workspace_key: Type.String(),
});

export type WorkspaceStatus = Static<typeof WorkspaceStatusSchema>;
export type WorkspaceIssueSummary = Static<typeof WorkspaceIssueSummarySchema>;
export type WorkspaceInventoryEntry = Static<typeof WorkspaceInventoryEntrySchema>;
export type WorkspaceInventoryResponse = Static<typeof WorkspaceInventoryResponseSchema>;
export type WorkspaceKeyParams = Static<typeof WorkspaceKeyParamsSchema>;
