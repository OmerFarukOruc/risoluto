import { Type, type Static } from "@sinclair/typebox";

export const RuntimeResponseSchema = Type.Object({
  version: Type.String(),
  workflow_path: Type.String(),
  data_dir: Type.String(),
  feature_flags: Type.Record(Type.String(), Type.Boolean()),
  provider_summary: Type.String(),
});

export const RefreshResponseSchema = Type.Object({
  queued: Type.Boolean(),
  coalesced: Type.Boolean(),
  requested_at: Type.String(),
});

export type RuntimeResponse = Static<typeof RuntimeResponseSchema>;
export type RefreshResponse = Static<typeof RefreshResponseSchema>;
