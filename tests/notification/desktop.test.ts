import { describe, expect, it, vi } from "vitest";

import { DesktopNotificationChannel } from "../../src/notification/desktop.js";
import type { NotificationEvent } from "../../src/notification/channel.js";

function createEvent(overrides?: Partial<NotificationEvent>): NotificationEvent {
  return {
    type: "worker_failed",
    severity: "critical",
    timestamp: "2026-04-04T00:00:00.000Z",
    message: "worker crashed",
    issue: {
      id: "issue-1",
      identifier: "NIN-42",
      title: "Notifications bundle",
      state: "In Progress",
      url: "https://linear.app/example/issue/NIN-42",
    },
    attempt: 2,
    ...overrides,
  };
}

describe("DesktopNotificationChannel", () => {
  it("runs notify-send on linux", async () => {
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const channel = new DesktopNotificationChannel({
      name: "desktop",
      platform: "linux",
      runCommand,
    });

    await channel.notify(createEvent());

    expect(runCommand).toHaveBeenCalledWith("notify-send", expect.arrayContaining(["Risoluto CRITICAL"]));
  });

  it("runs osascript on darwin", async () => {
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const channel = new DesktopNotificationChannel({
      name: "desktop",
      platform: "darwin",
      runCommand,
    });

    await channel.notify(createEvent());

    expect(runCommand).toHaveBeenCalledWith("osascript", expect.any(Array));
  });

  it("runs powershell on win32", async () => {
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const channel = new DesktopNotificationChannel({
      name: "desktop",
      platform: "win32",
      runCommand,
    });

    await channel.notify(createEvent());

    expect(runCommand).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining(["-NoProfile", "-Command", expect.stringContaining("BalloonTipTitle")]),
    );
  });

  it("does not run when minSeverity is higher than the event", async () => {
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const channel = new DesktopNotificationChannel({
      name: "desktop",
      minSeverity: "critical",
      runCommand,
    });

    await channel.notify(createEvent({ severity: "warning" }));

    expect(runCommand).not.toHaveBeenCalled();
  });

  it("throws when the platform is unsupported", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as never;
    const channel = new DesktopNotificationChannel({
      name: "desktop",
      platform: "freebsd",
      logger,
      runCommand: vi.fn(),
    });

    await expect(channel.notify(createEvent())).rejects.toThrow("not supported");
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("throws command failures so the manager can report delivery truthfully", async () => {
    const runCommand = vi.fn().mockRejectedValue(new Error("missing command"));
    const channel = new DesktopNotificationChannel({
      name: "desktop",
      runCommand,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: vi.fn().mockReturnThis(),
      } as never,
    });

    await expect(channel.notify(createEvent())).rejects.toThrow("missing command");
  });
});
