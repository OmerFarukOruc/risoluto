import type { TypedEventBus } from "../core/event-bus.js";
import type { RisolutoEventMap } from "../core/risoluto-events.js";
import type { RisolutoLogger } from "../core/types.js";
import type { NotificationManager } from "../notification/manager.js";

/**
 * Subscribes to `health.transition` events and dispatches a critical
 * notification whenever a probe transitions to `down`. Recovery
 * transitions (`down → ok`) emit an info-level confirmation so operators
 * see the full incident envelope.
 *
 * The bridge is intentionally thin — all alert routing logic lives in
 * `NotificationManager` and the configured channels.
 */
export interface HealthNotificationBridgeDeps {
  eventBus: TypedEventBus<RisolutoEventMap>;
  notificationManager: NotificationManager;
  logger?: RisolutoLogger;
}

export function attachHealthNotificationBridge(deps: HealthNotificationBridgeDeps): () => void {
  const { eventBus, notificationManager, logger } = deps;

  const handler = (event: RisolutoEventMap["health.transition"]) => {
    const { probe, previousStatus, currentStatus, failureKind, detail, checkedAt } = event;

    if (currentStatus === "down") {
      void notificationManager
        .notify({
          type: "health_down",
          severity: "critical",
          timestamp: checkedAt,
          title: `${probe} health: down`,
          message: detail || `${probe} probe transitioned ${previousStatus} → down`,
          source: `health-probe:${probe}`,
          issue: { id: null, identifier: probe, title: `${probe} subsystem`, state: null, url: null },
          attempt: null,
          metadata: { probe, previousStatus, currentStatus, failureKind },
          dedupeKey: `health:${probe}:down`,
        })
        .catch((error: unknown) => {
          logger?.warn(
            { probe, error: error instanceof Error ? error.message : String(error) },
            "health-down notification failed",
          );
        });
      return;
    }

    if (previousStatus === "down" && currentStatus === "ok") {
      void notificationManager
        .notify({
          type: "health_recovered",
          severity: "info",
          timestamp: checkedAt,
          title: `${probe} health: recovered`,
          message: `${probe} probe recovered from down → ok`,
          source: `health-probe:${probe}`,
          issue: { id: null, identifier: probe, title: `${probe} subsystem`, state: null, url: null },
          attempt: null,
          metadata: { probe, previousStatus, currentStatus, failureKind },
          dedupeKey: `health:${probe}:recovered`,
        })
        .catch((error: unknown) => {
          logger?.warn(
            { probe, error: error instanceof Error ? error.message : String(error) },
            "health-recovery notification failed",
          );
        });
    }
  };

  // Defensive: services.test.ts and other suites mock the event bus
  // without `on`/`off`. Skip silently in those cases — production wiring
  // always carries a real `TypedEventBus`.
  if (typeof eventBus.on !== "function") return () => undefined;
  eventBus.on("health.transition", handler);
  return () => {
    if (typeof eventBus.off === "function") eventBus.off("health.transition", handler);
  };
}
