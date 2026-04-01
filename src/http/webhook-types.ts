import type { Request } from "express";

/**
 * Extended Express request carrying the raw body buffer for webhook
 * signature verification (HMAC-SHA256).
 *
 * Populated by the `verify` callback on `express.json()` for paths
 * under `/webhooks/`. Non-webhook routes never receive this property.
 */
export interface WebhookRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Shape of a Linear webhook delivery payload.
 *
 * Linear sends this JSON body for every webhook event. The `action`
 * and `type` fields identify what happened (e.g. action="update",
 * type="Issue"). `webhookTimestamp` is used for replay rejection.
 *
 * Headers sent alongside the body:
 * - `Linear-Delivery` — unique delivery UUID (our dedup key)
 * - `Linear-Event` — entity type (e.g. "Issue")
 * - `Linear-Signature` — HMAC-SHA256 hex digest of the raw body
 */
export interface LinearWebhookPayload {
  action: string;
  type: string;
  data: Record<string, unknown>;
  actor?: Record<string, unknown>;
  id?: string;
  webhookTimestamp: number;
  url?: string;
  createdAt?: string;
  /** Present on Issue update events — contains the previous state values. */
  updatedFrom?: Record<string, unknown>;
  /** The webhook subscription ID that triggered this delivery. */
  webhookId?: string;
}

/** Resource types that Risoluto consumes from Linear webhooks. */
export const SUPPORTED_WEBHOOK_TYPES = new Set(["Issue", "Comment"]);

/** Issue actions that trigger targeted refresh. */
export const ISSUE_ACTIONS = new Set(["create", "update", "remove"]);

/** Comment actions that trigger activity updates. */
export const COMMENT_ACTIONS = new Set(["create", "update", "remove"]);

/**
 * Validate that a parsed webhook payload has the minimum required fields.
 * Returns an error message if invalid, null if valid.
 */
export function validateWebhookPayload(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "payload is not an object";
  }
  const payload = body as Record<string, unknown>;
  if (typeof payload.action !== "string" || !payload.action) {
    return "missing or invalid 'action' field";
  }
  if (typeof payload.type !== "string" || !payload.type) {
    return "missing or invalid 'type' field";
  }
  if (!payload.data || typeof payload.data !== "object") {
    return "missing or invalid 'data' field";
  }
  if (typeof payload.webhookTimestamp !== "number") {
    return "missing or invalid 'webhookTimestamp' field";
  }
  return null;
}
