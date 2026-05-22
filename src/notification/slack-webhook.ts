import type { RisolutoLogger } from "../core/types.js";
import {
  type NotificationChannel,
  type NotificationEvent,
  type NotificationSeverity,
  type NotificationVerbosity,
  shouldDeliverByMinSeverity,
  shouldDeliverByVerbosity,
} from "./channel.js";
import { deliverWebhookJson } from "./webhook-delivery.js";

const DEFAULT_TIMEOUT_MS = 10_000;

function metadataLines(metadata: Record<string, unknown> | undefined): string[] {
  if (!metadata) {
    return [];
  }
  return Object.entries(metadata)
    .slice(0, 8)
    .map(([key, value]) => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return `${key}: ${String(value)}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    });
}

function slackColorForSeverity(severity: NotificationEvent["severity"]): string {
  return severity === "critical" ? "#d32f2f" : "#1d4ed8";
}

function slackSeverityTag(severity: NotificationEvent["severity"]): string {
  return severity === "critical" ? "CRITICAL" : "INFO";
}

function buildSlackPayload(event: NotificationEvent): Record<string, unknown> {
  const details = [
    `Issue: ${event.issue.identifier}`,
    `Attempt: ${event.attempt ?? "n/a"}`,
    `Type: ${event.type}`,
    `Severity: ${slackSeverityTag(event.severity)}`,
    `At: ${event.timestamp}`,
  ];
  if (event.issue.state) {
    details.push(`State: ${event.issue.state}`);
  }
  const metadata = metadataLines(event.metadata);
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: event.title ?? `Risoluto ${slackSeverityTag(event.severity)} ${event.type}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${event.issue.identifier}* - ${event.issue.title}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: event.message,
      },
    },
    {
      type: "context",
      elements: details.map((line) => ({ type: "mrkdwn", text: line })),
    },
  ];

  if (event.issue.url) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${event.issue.url}|Open issue>`,
      },
    });
  }
  if (metadata.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`${metadata.join("\n")}\`\`\``,
      },
    });
  }

  return {
    text: `[Risoluto ${slackSeverityTag(event.severity)}] ${event.issue.identifier}: ${event.message}`,
    attachments: [
      {
        color: slackColorForSeverity(event.severity),
        blocks,
      },
    ],
  };
}

interface SlackWebhookChannelOptions {
  name?: string;
  webhookUrl: string;
  verbosity: NotificationVerbosity;
  minSeverity?: NotificationSeverity;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  logger?: RisolutoLogger;
}

export class SlackWebhookChannel implements NotificationChannel {
  readonly name: string;

  private readonly timeoutMs: number;

  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SlackWebhookChannelOptions) {
    this.name = options.name ?? "slack_webhook";
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async notify(event: NotificationEvent): Promise<void> {
    if (!shouldDeliverByVerbosity(event, this.options.verbosity)) {
      return;
    }
    if (!shouldDeliverByMinSeverity(event.severity, this.options.minSeverity ?? "info")) {
      return;
    }

    await deliverWebhookJson({
      channelName: this.name,
      url: this.options.webhookUrl,
      payload: buildSlackPayload(event),
      failureLabel: "slack webhook",
      event,
      timeoutMs: this.timeoutMs,
      fetchImpl: this.fetchImpl,
      logger: this.options.logger,
    });
  }
}
