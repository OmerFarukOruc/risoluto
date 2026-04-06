import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";

import { handleTestSlackNotification } from "../../src/http/notifications-handler.js";
import { SlackWebhookChannel } from "../../src/notification/slack-webhook.js";
import type { ConfigStore } from "../../src/config/store.js";
import type { ServiceConfig } from "../../src/core/types.js";
import { createJsonResponse, createMockLogger, createTextResponse, makeMockResponse } from "../helpers.js";

function makeConfigStore(slack: ServiceConfig["notifications"] extends infer _U ? unknown : never): ConfigStore {
  return {
    getConfig: () => ({ notifications: slack }) as unknown as ServiceConfig,
  } as unknown as ConfigStore;
}

function emptyRequest(): Request {
  return {} as unknown as Request;
}

describe("handleTestSlackNotification", () => {
  it("returns 503 when config store is not available", async () => {
    const res = makeMockResponse();
    await handleTestSlackNotification({}, emptyRequest(), res);
    expect(res._status).toBe(503);
    expect((res._body as { error: { code: string } }).error.code).toBe("not_configured");
  });

  it("returns 400 when slack webhook is not configured", async () => {
    const configStore = makeConfigStore({ slack: null, channels: [] });
    const res = makeMockResponse();
    await handleTestSlackNotification({ configStore, logger: createMockLogger() }, emptyRequest(), res);
    expect(res._status).toBe(400);
    const body = res._body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("slack_not_configured");
    expect(body.error.message).toContain("Save a Slack webhook URL");
  });

  it("dispatches a test event even when saved verbosity is off", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse(200, { ok: true }));
    const configStore = makeConfigStore({
      slack: { webhookUrl: "https://hooks.slack.com/services/T000/B000/XXXX", verbosity: "off" },
      channels: [],
    });
    // Inject the fetch via createSlackChannel seam so we can assert payload + verbosity override.
    const logger = createMockLogger();

    const res = makeMockResponse();
    await handleTestSlackNotification(
      {
        configStore,
        logger,
        createSlackChannel: ({ webhookUrl }) =>
          new SlackWebhookChannel({
            name: "slack_webhook_test",
            webhookUrl,
            verbosity: "verbose",
            minSeverity: "info",
            fetchImpl: fetchMock as unknown as typeof fetch,
            logger,
          }),
      },
      emptyRequest(),
      res,
    );

    expect(res._status).toBe(200);
    const body = res._body as { ok: true; sentAt: string };
    expect(body.ok).toBe(true);
    expect(typeof body.sentAt).toBe("string");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://hooks.slack.com/services/T000/B000/XXXX");
    const payload = JSON.parse((init as { body: string }).body) as { text: string };
    expect(payload.text).toContain("RIS-TEST");
  });

  it("maps Slack 404 response to webhook_invalid", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createTextResponse(404, "invalid_webhook"));
    const configStore = makeConfigStore({
      slack: { webhookUrl: "https://hooks.slack.com/services/T/B/X", verbosity: "critical" },
      channels: [],
    });
    const res = makeMockResponse();
    await handleTestSlackNotification(
      {
        configStore,
        createSlackChannel: ({ webhookUrl }) =>
          new SlackWebhookChannel({
            webhookUrl,
            verbosity: "verbose",
            minSeverity: "info",
            fetchImpl: fetchMock as unknown as typeof fetch,
          }),
      },
      emptyRequest(),
      res,
    );

    expect(res._status).toBe(404);
    expect((res._body as { error: { code: string } }).error.code).toBe("webhook_invalid");
  });

  it("maps Slack 500 response to upstream_error 502", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createTextResponse(500, "internal error"));
    const configStore = makeConfigStore({
      slack: { webhookUrl: "https://hooks.slack.com/services/T/B/X", verbosity: "critical" },
      channels: [],
    });
    const res = makeMockResponse();
    await handleTestSlackNotification(
      {
        configStore,
        createSlackChannel: ({ webhookUrl }) =>
          new SlackWebhookChannel({
            webhookUrl,
            verbosity: "verbose",
            minSeverity: "info",
            fetchImpl: fetchMock as unknown as typeof fetch,
          }),
      },
      emptyRequest(),
      res,
    );

    expect(res._status).toBe(502);
    expect((res._body as { error: { code: string } }).error.code).toBe("upstream_error");
  });

  it("maps AbortError to 504 timeout", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    const configStore = makeConfigStore({
      slack: { webhookUrl: "https://hooks.slack.com/services/T/B/X", verbosity: "critical" },
      channels: [],
    });
    const res = makeMockResponse();
    await handleTestSlackNotification(
      {
        configStore,
        createSlackChannel: ({ webhookUrl }) =>
          new SlackWebhookChannel({
            webhookUrl,
            verbosity: "verbose",
            minSeverity: "info",
            fetchImpl: fetchMock as unknown as typeof fetch,
          }),
      },
      emptyRequest(),
      res,
    );

    expect(res._status).toBe(504);
    expect((res._body as { error: { code: string } }).error.code).toBe("timeout");
  });
});
