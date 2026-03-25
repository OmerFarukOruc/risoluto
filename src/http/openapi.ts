import { Type, type Static } from "@sinclair/typebox";

export const ErrorEnvelopeSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
  }),
});

export type ErrorEnvelope = Static<typeof ErrorEnvelopeSchema>;

const RuntimeResponseSchema = Type.Object({
  version: Type.String(),
  workflow_path: Type.String(),
  data_dir: Type.String(),
  feature_flags: Type.Record(Type.String(), Type.Boolean()),
  provider_summary: Type.String(),
});

const RefreshResponseSchema = Type.Object({
  queued: Type.Boolean(),
  coalesced: Type.Boolean(),
  requested_at: Type.String(),
});

const RuntimeStateResponseSchema = Type.Object({
  generated_at: Type.String(),
  counts: Type.Object({
    running: Type.Number(),
    retrying: Type.Number(),
  }),
  queued: Type.Array(Type.Unknown()),
  running: Type.Array(Type.Unknown()),
  retrying: Type.Array(Type.Unknown()),
  completed: Type.Array(Type.Unknown()),
  workflow_columns: Type.Array(Type.Unknown()),
  codex_totals: Type.Object({
    input_tokens: Type.Number(),
    output_tokens: Type.Number(),
    total_tokens: Type.Number(),
    seconds_running: Type.Number(),
  }),
  rate_limits: Type.Unknown(),
  recent_events: Type.Array(Type.Unknown()),
});

const AbortResponseSchema = Type.Object({
  ok: Type.Boolean(),
  status: Type.String(),
  already_stopping: Type.Boolean(),
  requested_at: Type.String(),
});

const AttemptListResponseSchema = Type.Object({
  attempts: Type.Array(Type.Unknown()),
  current_attempt_id: Type.Union([Type.String(), Type.Null()]),
});

export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Symphony Orchestrator Control Plane API",
      version: process.env.npm_package_version ?? "unknown",
    },
    paths: {
      "/api/v1/state": {
        get: {
          summary: "Get the current orchestrator snapshot",
          responses: {
            "200": {
              description: "Current runtime state",
              content: {
                "application/json": {
                  schema: RuntimeStateResponseSchema,
                },
              },
            },
          },
        },
      },
      "/api/v1/runtime": {
        get: {
          summary: "Get runtime metadata",
          responses: {
            "200": {
              description: "Runtime metadata",
              content: {
                "application/json": {
                  schema: RuntimeResponseSchema,
                },
              },
            },
          },
        },
      },
      "/api/v1/refresh": {
        post: {
          summary: "Queue a refresh pass",
          responses: {
            "202": {
              description: "Refresh accepted",
              content: {
                "application/json": {
                  schema: RefreshResponseSchema,
                },
              },
            },
          },
        },
      },
      "/api/v1/{issue_identifier}/abort": {
        post: {
          summary: "Abort a running issue",
          parameters: [
            {
              in: "path",
              name: "issue_identifier",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Abort already requested",
              content: {
                "application/json": {
                  schema: AbortResponseSchema,
                },
              },
            },
            "202": {
              description: "Abort accepted",
              content: {
                "application/json": {
                  schema: AbortResponseSchema,
                },
              },
            },
            "404": {
              description: "Unknown issue identifier",
              content: {
                "application/json": {
                  schema: ErrorEnvelopeSchema,
                },
              },
            },
          },
        },
      },
      "/api/v1/{issue_identifier}/attempts": {
        get: {
          summary: "List archived attempts for an issue",
          parameters: [
            {
              in: "path",
              name: "issue_identifier",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Issue attempts",
              content: {
                "application/json": {
                  schema: AttemptListResponseSchema,
                },
              },
            },
            "404": {
              description: "Unknown issue identifier",
              content: {
                "application/json": {
                  schema: ErrorEnvelopeSchema,
                },
              },
            },
          },
        },
      },
      "/api/v1/events": {
        get: {
          summary: "Subscribe to control-plane invalidation events",
          responses: {
            "200": {
              description: "Server-sent event stream",
              content: {
                "text/event-stream": {
                  schema: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
