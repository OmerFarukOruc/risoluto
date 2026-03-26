import { Type, type Static } from "@sinclair/typebox";

import { ServiceConfigSchema, WorkflowSchema } from "../config-schema.js";

export { ServiceConfigSchema, WorkflowSchema };

export const ConfigValueSchema = Type.Record(Type.String(), Type.Unknown());

export const ConfigSchemaResponseSchema = Type.Object(
  {
    overlay_put_body_examples: Type.Array(Type.Unknown()),
    routes: Type.Record(Type.String(), Type.String()),
  },
  { additionalProperties: true },
);

export const ConfigOverlayResponseSchema = Type.Object({
  overlay: ConfigValueSchema,
});

export const ConfigOverlayUpdateResponseSchema = Type.Object({
  updated: Type.Boolean(),
  overlay: ConfigValueSchema,
});

export const ConfigOverlayPatchBodySchema = Type.Object({
  value: Type.Unknown(),
});

export const ConfigPathParamsSchema = Type.Object({
  path: Type.String(),
});

export type ConfigValue = Static<typeof ConfigValueSchema>;
export type ConfigSchemaResponse = Static<typeof ConfigSchemaResponseSchema>;
export type ConfigOverlayResponse = Static<typeof ConfigOverlayResponseSchema>;
export type ConfigOverlayUpdateResponse = Static<typeof ConfigOverlayUpdateResponseSchema>;
export type ConfigOverlayPatchBody = Static<typeof ConfigOverlayPatchBodySchema>;
export type ConfigPathParams = Static<typeof ConfigPathParamsSchema>;
