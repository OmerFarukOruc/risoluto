import { Type, type Static } from "@sinclair/typebox";

export const TransitionsResponseSchema = Type.Object({
  transitions: Type.Record(Type.String(), Type.Array(Type.String())),
});

export const TransitionBodySchema = Type.Object({
  target_state: Type.String(),
});

export const TransitionSuccessResponseSchema = Type.Object({
  ok: Type.Literal(true),
  from: Type.String(),
  to: Type.String(),
});

export const TransitionRejectedResponseSchema = Type.Object({
  ok: Type.Literal(false),
  reason: Type.String(),
});

export type TransitionsResponse = Static<typeof TransitionsResponseSchema>;
export type TransitionBody = Static<typeof TransitionBodySchema>;
export type TransitionSuccessResponse = Static<typeof TransitionSuccessResponseSchema>;
export type TransitionRejectedResponse = Static<typeof TransitionRejectedResponseSchema>;
