import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { RisolutoLogger } from "../core/types.js";
import type { NotificationSeverity } from "../core/notification-types.js";
import { type NotificationChannel, type NotificationEvent, shouldDeliverByMinSeverity } from "./channel.js";
import { toErrorString } from "../utils/type-guards.js";

const execFileAsync = promisify(execFile);

type RunCommand = (command: string, args: string[]) => Promise<void>;

interface DesktopNotificationChannelOptions {
  name: string;
  enabled?: boolean;
  minSeverity?: NotificationSeverity;
  logger?: RisolutoLogger;
  runCommand?: RunCommand;
  platform?: NodeJS.Platform;
}

function escapeAppleScript(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function escapePowerShell(value: string): string {
  return value.replaceAll("'", "''");
}

function buildDesktopTitle(event: NotificationEvent): string {
  return event.title ?? `Risoluto ${event.severity.toUpperCase()}`;
}

function buildDesktopMessage(event: NotificationEvent): string {
  return `${event.issue.identifier}: ${event.message}`;
}

function defaultRunCommand(command: string, args: string[]): Promise<void> {
  return execFileAsync(command, args).then(() => undefined);
}

export class DesktopNotificationChannel implements NotificationChannel {
  readonly name: string;

  private readonly enabled: boolean;

  private readonly platform: NodeJS.Platform;

  private readonly runCommand: RunCommand;

  constructor(private readonly options: DesktopNotificationChannelOptions) {
    this.name = options.name;
    this.enabled = options.enabled ?? true;
    this.platform = options.platform ?? process.platform;
    this.runCommand = options.runCommand ?? defaultRunCommand;
  }

  async notify(event: NotificationEvent): Promise<void> {
    if (!this.enabled) {
      return;
    }
    if (!shouldDeliverByMinSeverity(event.severity, this.options.minSeverity ?? "info")) {
      return;
    }

    const title = buildDesktopTitle(event);
    const message = buildDesktopMessage(event);

    try {
      if (this.platform === "linux") {
        await this.runCommand("notify-send", [title, message]);
        return;
      }
      if (this.platform === "darwin") {
        await this.runCommand("osascript", [
          "-e",
          `display notification "${escapeAppleScript(message)}" with title "${escapeAppleScript(title)}"`,
        ]);
        return;
      }
      if (this.platform === "win32") {
        await this.runCommand("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          buildWindowsNotificationScript(title, message),
        ]);
        return;
      }
      throw new Error(`desktop notifications are not supported on platform ${this.platform}`);
    } catch (error) {
      const errorText = toErrorString(error);
      this.options.logger?.warn(
        {
          channel: this.name,
          eventType: event.type,
          issueIdentifier: event.issue.identifier,
          platform: this.platform,
          error: errorText,
        },
        "desktop notification delivery failed",
      );
      throw error;
    }
  }
}

function buildWindowsNotificationScript(title: string, message: string): string {
  const escapedTitle = escapePowerShell(title);
  const escapedMessage = escapePowerShell(message);
  return [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "$notification = New-Object System.Windows.Forms.NotifyIcon",
    "$notification.Icon = [System.Drawing.SystemIcons]::Information",
    `$notification.BalloonTipTitle = '${escapedTitle}'`,
    `$notification.BalloonTipText = '${escapedMessage}'`,
    "$notification.Visible = $true",
    "$notification.ShowBalloonTip(5000)",
    "Start-Sleep -Milliseconds 5500",
    "$notification.Dispose()",
  ].join("; ");
}
