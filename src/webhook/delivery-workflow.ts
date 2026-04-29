import type { Response } from "express";

import type { TypedEventBus } from "../core/event-bus.js";
import type { RisolutoEventMap } from "../core/risoluto-events.js";
import type { RisolutoLogger } from "../core/types.js";
import { toErrorString } from "../utils/type-guards.js";

export interface VerifiedWebhookDelivery {
  deliveryId: string;
  type: string;
  action: string;
  entityId: string | null;
  issueId: string | null;
  issueIdentifier: string | null;
  webhookTimestamp: number | null;
  payloadJson: string | null;
}

export interface VerifiedWebhookDeliveryStore {
  insertVerified(delivery: VerifiedWebhookDelivery): Promise<{ isNew: boolean }>;
}

interface DeliveryLogContext {
  deliveryId: string;
  type: string;
  action: string;
}

class WebhookInboxUnavailableError extends Error {
  constructor() {
    super("webhook inbox persistence is unavailable");
  }
}

function deliveryLogContext(delivery: VerifiedWebhookDelivery): DeliveryLogContext {
  return {
    deliveryId: delivery.deliveryId,
    type: delivery.type,
    action: delivery.action,
  };
}

export class WebhookDeliveryWorkflow {
  constructor(
    private readonly logger: RisolutoLogger,
    private readonly store?: VerifiedWebhookDeliveryStore,
    private readonly eventBus?: Pick<TypedEventBus<RisolutoEventMap>, "emit">,
  ) {}

  respondAccepted(
    res: Response,
    options: {
      delivery: VerifiedWebhookDelivery;
      status?: number;
      body?: unknown;
      eventType?: string;
      recordVerifiedDelivery?: (eventType: string) => void;
      process: () => void | Promise<void>;
      duplicateMessage?: string;
      errorMessage?: string;
    },
  ): void {
    void this.ensureNew(options.delivery)
      .then((isNew) => {
        if (!isNew) {
          res.status(options.status ?? 200).json(options.body ?? { ok: true });
          this.logger.debug(
            deliveryLogContext(options.delivery),
            options.duplicateMessage ?? "duplicate webhook delivery skipped",
          );
          return;
        }

        res.status(options.status ?? 200).json(options.body ?? { ok: true });

        if (options.eventType && options.recordVerifiedDelivery) {
          options.recordVerifiedDelivery(options.eventType);
        }

        return options.process();
      })
      .catch((error) => {
        if (error instanceof WebhookInboxUnavailableError && !res.headersSent) {
          res.status(503).json({
            error: {
              code: "webhook_inbox_unavailable",
              message: "Webhook inbox persistence is unavailable",
            },
          });
          return;
        }

        this.logger.error(
          {
            ...deliveryLogContext(options.delivery),
            error: toErrorString(error),
          },
          options.errorMessage ?? "webhook delivery processing failed",
        );
      });
  }

  async ensureNew(delivery: VerifiedWebhookDelivery): Promise<boolean> {
    if (!this.store) {
      return true;
    }

    try {
      const result = await this.store.insertVerified(delivery);
      return result.isNew;
    } catch (error) {
      this.logger.error(
        {
          ...deliveryLogContext(delivery),
          error: toErrorString(error),
        },
        "webhook inbox insert failed — dropping delivery to preserve durable dedupe",
      );
      this.eventBus?.emit("system.error", {
        message: "Webhook inbox insert failed; delivery was dropped to preserve durable dedupe.",
        context: {
          ...deliveryLogContext(delivery),
          error: toErrorString(error),
        },
      });
      throw new WebhookInboxUnavailableError();
    }
  }
}
