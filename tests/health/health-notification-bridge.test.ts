import { describe, expect, it, vi } from "vitest";

import { TypedEventBus } from "../../src/core/event-bus.js";
import type { RisolutoEventMap } from "../../src/core/risoluto-events.js";
import { attachHealthNotificationBridge } from "../../src/health/health-notification-bridge.js";
import type { NotificationManager } from "../../src/notification/manager.js";

function notificationManagerMock(): {
  notify: ReturnType<typeof vi.fn>;
  port: NotificationManager;
} {
  const notify = vi.fn(async () => ({ deliveredChannels: [], failedChannels: [] }));
  return { notify, port: { notify } as unknown as NotificationManager };
}

describe("attachHealthNotificationBridge", () => {
  it("dispatches a critical notification on transition to down", async () => {
    const eventBus = new TypedEventBus<RisolutoEventMap>();
    const nm = notificationManagerMock();
    attachHealthNotificationBridge({ eventBus, notificationManager: nm.port });

    eventBus.emit("health.transition", {
      probe: "github",
      previousStatus: "ok",
      currentStatus: "down",
      failureKind: "auth_failure",
      detail: "401 unauthorized",
      checkedAt: "2026-04-29T20:00:00.000Z",
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(nm.notify).toHaveBeenCalledTimes(1);
    const event = nm.notify.mock.calls[0][0];
    expect(event.severity).toBe("critical");
    expect(event.type).toBe("health_down");
    expect(event.title).toContain("github");
    expect(event.metadata.failureKind).toBe("auth_failure");
  });

  it("dispatches an info notification on recovery from down → ok", async () => {
    const eventBus = new TypedEventBus<RisolutoEventMap>();
    const nm = notificationManagerMock();
    attachHealthNotificationBridge({ eventBus, notificationManager: nm.port });

    eventBus.emit("health.transition", {
      probe: "docker",
      previousStatus: "down",
      currentStatus: "ok",
      failureKind: "ok",
      detail: "daemon up",
      checkedAt: "2026-04-29T20:01:00.000Z",
    });

    await Promise.resolve();
    expect(nm.notify).toHaveBeenCalledTimes(1);
    expect(nm.notify.mock.calls[0][0].severity).toBe("info");
    expect(nm.notify.mock.calls[0][0].type).toBe("health_recovered");
    expect(nm.notify.mock.calls[0][0].title).toContain("recovered");
  });

  it("ignores transitions that are not into or out of down", async () => {
    const eventBus = new TypedEventBus<RisolutoEventMap>();
    const nm = notificationManagerMock();
    attachHealthNotificationBridge({ eventBus, notificationManager: nm.port });

    eventBus.emit("health.transition", {
      probe: "github",
      previousStatus: "ok",
      currentStatus: "degraded",
      failureKind: "rate_limited",
      detail: "Headroom low",
      checkedAt: "2026-04-29T20:02:00.000Z",
    });

    eventBus.emit("health.transition", {
      probe: "linear",
      previousStatus: "degraded",
      currentStatus: "ok",
      failureKind: "ok",
      detail: "",
      checkedAt: "2026-04-29T20:03:00.000Z",
    });

    await Promise.resolve();
    expect(nm.notify).not.toHaveBeenCalled();
  });

  it("returns an unsubscribe handle that detaches the listener", async () => {
    const eventBus = new TypedEventBus<RisolutoEventMap>();
    const nm = notificationManagerMock();
    const unsubscribe = attachHealthNotificationBridge({ eventBus, notificationManager: nm.port });

    unsubscribe();
    eventBus.emit("health.transition", {
      probe: "docker",
      previousStatus: "ok",
      currentStatus: "down",
      failureKind: "unreachable",
      detail: "daemon refused",
      checkedAt: "2026-04-29T20:04:00.000Z",
    });

    await Promise.resolve();
    expect(nm.notify).not.toHaveBeenCalled();
  });
});
