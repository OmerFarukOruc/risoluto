import { Type, type Static } from "@sinclair/typebox";

import { ReasoningEffortSchema } from "../config-schema.js";
import { NullableStringSchema } from "./common.js";

export const ModelUpdateBodySchema = Type.Object({
  model: Type.String({ minLength: 1 }),
  reasoning_effort: Type.Optional(Type.Union([ReasoningEffortSchema, Type.Null()])),
  reasoningEffort: Type.Optional(Type.Union([ReasoningEffortSchema, Type.Null()])),
});

export const ModelSelectionResponseSchema = Type.Object({
  model: Type.String(),
  reasoning_effort: NullableStringSchema,
  source: Type.String(),
});

export const ModelUpdateResponseSchema = Type.Object({
  updated: Type.Boolean(),
  restarted: Type.Boolean(),
  applies_next_attempt: Type.Boolean(),
  selection: ModelSelectionResponseSchema,
});

export type ModelUpdateBody = Static<typeof ModelUpdateBodySchema>;
export type ModelSelectionResponse = Static<typeof ModelSelectionResponseSchema>;
export type ModelUpdateResponse = Static<typeof ModelUpdateResponseSchema>;
