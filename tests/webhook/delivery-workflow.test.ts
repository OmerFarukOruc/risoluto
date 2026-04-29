import { describe, expect, it, vi } from "vitest";

import { WebhookDeliveryWorkflow } from "../../src/webhook/delivery-workflow.js";
import { createMockLogger, makeMockResponse } from "../helpers.js";

describe("WebhookDeliveryWorkflow", () => {
  it("records new deliveries before acknowledging and runs the processor", async () => {
    const logger = createMockLogger();
    const insertVerified = vi.fn().mockResolvedValue({ isNew: true });
    const recordVerifiedDelivery = vi.fn();
    const process = vi.fn();
    const res = makeMockResponse();
    const workflow = new WebhookDeliveryWorkflow(logger, { insertVerified });

    workflow.respondAccepted(res, {
      delivery: {
        deliveryId: "delivery-1",
        type: "Issue",
        action: "update",
        entityId: "entity-1",
        issueId: "issue-1",
        issueIdentifier: "ENG-1",
        webhookTimestamp: Date.now(),
        payloadJson: '{"ok":true}',
      },
      eventType: "Issue:update",
      recordVerifiedDelivery,
      process,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(insertVerified).toHaveBeenCalledOnce();
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ ok: true });
    expect(recordVerifiedDelivery).toHaveBeenCalledWith("Issue:update");
    expect(process).toHaveBeenCalledOnce();
  });

  it("skips duplicate deliveries without recording or processing", async () => {
    const logger = createMockLogger();
    const insertVerified = vi.fn().mockResolvedValue({ isNew: false });
    const recordVerifiedDelivery = vi.fn();
    const process = vi.fn();
    const workflow = new WebhookDeliveryWorkflow(logger, { insertVerified });

    workflow.respondAccepted(makeMockResponse(), {
      delivery: {
        deliveryId: "delivery-dup",
        type: "issues",
        action: "opened",
        entityId: null,
        issueId: "7",
        issueIdentifier: "acme/app#7",
        webhookTimestamp: null,
        payloadJson: '{"action":"opened"}',
      },
      eventType: "issues:opened",
      recordVerifiedDelivery,
      process,
      duplicateMessage: "duplicate github webhook delivery skipped",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(recordVerifiedDelivery).not.toHaveBeenCalled();
    expect(process).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      { deliveryId: "delivery-dup", type: "issues", action: "opened" },
      "duplicate github webhook delivery skipped",
    );
  });

  it("ensureNew returns true when no store is configured", async () => {
    const workflow = new WebhookDeliveryWorkflow(createMockLogger());

    await expect(
      workflow.ensureNew({
        deliveryId: "delivery-free",
        type: "Trigger",
        action: "re_poll",
        entityId: null,
        issueId: null,
        issueIdentifier: null,
        webhookTimestamp: null,
        payloadJson: '{"action":"re_poll"}',
      }),
    ).resolves.toBe(true);
  });

  it("returns 503 before acknowledgement when durable inbox insert fails", async () => {
    const logger = createMockLogger();
    const eventBus = { emit: vi.fn() };
    const process = vi.fn();
    const res = makeMockResponse();
    const workflow = new WebhookDeliveryWorkflow(
      logger,
      {
        insertVerified: vi.fn().mockRejectedValue(new Error("sqlite busy")),
      },
      eventBus,
    );

    workflow.respondAccepted(res, {
      delivery: {
        deliveryId: "delivery-error",
        type: "Issue",
        action: "update",
        entityId: "entity-1",
        issueId: "issue-1",
        issueIdentifier: "ENG-1",
        webhookTimestamp: Date.now(),
        payloadJson: '{"ok":true}',
      },
      process,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(res._status).toBe(503);
    expect(res._body).toEqual({
      error: {
        code: "webhook_inbox_unavailable",
        message: "Webhook inbox persistence is unavailable",
      },
    });
    expect(process).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      {
        deliveryId: "delivery-error",
        type: "Issue",
        action: "update",
        error: "sqlite busy",
      },
      "webhook inbox insert failed — dropping delivery to preserve durable dedupe",
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      "system.error",
      expect.objectContaining({
        message: expect.stringContaining("Webhook inbox insert failed"),
        context: expect.objectContaining({ deliveryId: "delivery-error", error: "sqlite busy" }),
      }),
    );
  });
});
