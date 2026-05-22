import { afterEach, describe, expect, it, vi } from "vitest";

import type { NotificationEvent } from "../../src/notification/channel.js";
import { deliverWebhookJson } from "../../src/notification/webhook-delivery.js";

function createEvent(): NotificationEvent {
  return {
    type: "worker_failed",
    severity: "critical",
    timestamp: "2026-05-22T00:00:00.000Z",
    message: "worker failed",
    issue: {
      id: "issue-1",
      identifier: "NIN-42",
      title: "Fix delivery",
      state: "In Progress",
      url: "https://linear.app/example/issue/NIN-42",
    },
    attempt: 2,
  };
}

describe("deliverWebhookJson", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts JSON payloads with shared content and custom headers", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok", { status: 200 }));

    await deliverWebhookJson({
      channelName: "ops",
      url: "https://notify.example/hook",
      payload: { ok: true },
      failureLabel: "webhook",
      event: createEvent(),
      headers: { authorization: "Bearer token" },
      timeoutMs: 10_000,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://notify.example/hook",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          authorization: "Bearer token",
        },
        body: JSON.stringify({ ok: true }),
      }),
    );
  });

  it("keeps labeled status errors and logs delivery context", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("down", { status: 503 }));
    const logger = { error: vi.fn() };

    await expect(
      deliverWebhookJson({
        channelName: "ops",
        url: "https://notify.example/hook",
        payload: { ok: true },
        failureLabel: "webhook",
        event: createEvent(),
        timeoutMs: 10_000,
        fetchImpl,
        logger,
      }),
    ).rejects.toThrow("webhook request failed with status 503: down");

    expect(logger.error).toHaveBeenCalledWith(
      {
        channel: "ops",
        eventType: "worker_failed",
        issueIdentifier: "NIN-42",
        error: "webhook request failed with status 503: down",
      },
      "notification delivery failed",
    );
  });

  it("aborts delivery after the configured timeout", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        capturedSignal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });

    const delivery = deliverWebhookJson({
      channelName: "ops",
      url: "https://notify.example/hook",
      payload: { ok: true },
      failureLabel: "webhook",
      event: createEvent(),
      timeoutMs: 5,
      fetchImpl,
    });

    const rejection = expect(delivery).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(5);

    await rejection;
    expect(capturedSignal?.aborted).toBe(true);
  });
});
