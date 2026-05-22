import type { RisolutoLogger } from "../core/types.js";
import type { NotificationEvent } from "./channel.js";
import { toErrorString } from "../utils/type-guards.js";

export interface WebhookDeliveryOptions {
  channelName: string;
  url: string;
  payload: Record<string, unknown>;
  failureLabel: string;
  event: NotificationEvent;
  headers?: Record<string, string>;
  timeoutMs: number;
  fetchImpl: typeof fetch;
  logger?: Pick<RisolutoLogger, "error">;
}

export async function deliverWebhookJson(options: WebhookDeliveryOptions): Promise<void> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, options.timeoutMs);

  try {
    const response = await options.fetchImpl(options.url, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...(options.headers ?? {}),
      },
      body: JSON.stringify(options.payload),
      signal: abortController.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`${options.failureLabel} request failed with status ${response.status}: ${body}`);
    }
  } catch (error) {
    options.logger?.error(
      {
        channel: options.channelName,
        eventType: options.event.type,
        issueIdentifier: options.event.issue.identifier,
        error: toErrorString(error),
      },
      "notification delivery failed",
    );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
