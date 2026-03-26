import { Type, type Static } from "@sinclair/typebox";

import { ServiceConfigSchema } from "../config-schema.js";
import { StringArraySchema, StringErrorSchema } from "./common.js";

export const DispatchRequestSchema = Type.Object({
  issue: Type.Record(Type.String(), Type.Unknown()),
  attempt: Type.Union([Type.Number(), Type.Null()]),
  modelSelection: Type.Record(Type.String(), Type.Unknown()),
  promptTemplate: Type.String(),
  workspace: Type.Record(Type.String(), Type.Unknown()),
  config: ServiceConfigSchema,
  codexRuntimeConfigToml: Type.String(),
  codexRuntimeAuthJsonBase64: Type.Union([Type.String(), Type.Null()]),
  codexRequiredEnvNames: StringArraySchema,
});

export const DataPlaneHealthSchema = Type.Object({
  status: Type.Union([Type.Literal("ok"), Type.Literal("draining")]),
  activeDispatches: Type.Number(),
});

export const DispatchAbortResponseSchema = Type.Object({
  status: Type.String(),
});

export const DispatchRunIdParamsSchema = Type.Object({
  runId: Type.String(),
});

export { StringErrorSchema };

export type DispatchRequest = Static<typeof DispatchRequestSchema>;
export type DataPlaneHealth = Static<typeof DataPlaneHealthSchema>;
export type DispatchAbortResponse = Static<typeof DispatchAbortResponseSchema>;
export type DispatchRunIdParams = Static<typeof DispatchRunIdParamsSchema>;
export type DispatchStringError = Static<typeof StringErrorSchema>;
