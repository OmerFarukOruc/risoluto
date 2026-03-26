import { Type, type Static } from "@sinclair/typebox";

import { NullableNumberSchema, NullableStringSchema } from "./common.js";

export const AttemptEventSchema = Type.Object(
  {
    at: Type.String(),
    event: Type.String(),
    attemptId: Type.Optional(Type.String()),
    issueId: Type.Optional(NullableStringSchema),
    issueIdentifier: Type.Optional(NullableStringSchema),
    sessionId: Type.Optional(NullableStringSchema),
    message: Type.Optional(Type.String()),
    content: Type.Optional(NullableStringSchema),
    metadata: Type.Optional(Type.Unknown()),
    usage: Type.Optional(Type.Unknown()),
    rateLimits: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: true },
);

export const AttemptSummarySchema = Type.Object(
  {
    attemptId: Type.String(),
    status: Type.String(),
    attemptNumber: Type.Optional(NullableNumberSchema),
    startedAt: Type.Optional(Type.String()),
    endedAt: Type.Optional(NullableStringSchema),
    errorCode: Type.Optional(NullableStringSchema),
    errorMessage: Type.Optional(NullableStringSchema),
  },
  { additionalProperties: true },
);

export const AttemptDetailSchema = Type.Object(
  {
    attemptId: Type.String(),
    status: Type.String(),
    events: Type.Optional(Type.Array(AttemptEventSchema)),
  },
  { additionalProperties: true },
);

export const AttemptListResponseSchema = Type.Object({
  attempts: Type.Array(AttemptSummarySchema),
  current_attempt_id: NullableStringSchema,
});

export const IssueDetailSchema = Type.Object(
  {
    issueId: Type.String(),
    identifier: Type.String(),
    title: Type.String(),
    state: Type.String(),
    attempts: Type.Optional(Type.Array(AttemptSummarySchema)),
    currentAttemptId: Type.Optional(NullableStringSchema),
  },
  { additionalProperties: true },
);

export const AbortResponseSchema = Type.Object({
  ok: Type.Boolean(),
  status: Type.String(),
  already_stopping: Type.Boolean(),
  requested_at: Type.String(),
});

export type AttemptEvent = Static<typeof AttemptEventSchema>;
export type AttemptSummary = Static<typeof AttemptSummarySchema>;
export type AttemptDetail = Static<typeof AttemptDetailSchema>;
export type AttemptListResponse = Static<typeof AttemptListResponseSchema>;
export type IssueDetail = Static<typeof IssueDetailSchema>;
export type AbortResponse = Static<typeof AbortResponseSchema>;
