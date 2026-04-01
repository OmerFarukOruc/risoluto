import { api } from "../api.js";
import { createEmptyState } from "../components/empty-state.js";
import { createPageHeader } from "../components/page-header.js";
import { skeletonBlock } from "../ui/skeleton.js";
import { router } from "../router.js";
import { getValueAtPath } from "./settings-paths.js";

function isSlackConfigured(config: Record<string, unknown>): boolean {
  const webhookUrl = getValueAtPath(config, "notifications.slack.webhook_url");
  const verbosity = getValueAtPath(config, "notifications.slack.verbosity");
  const hasWebhook = typeof webhookUrl === "string" && webhookUrl.length > 0;
  const verbosityActive = typeof verbosity === "string" && verbosity !== "off";
  return hasWebhook && verbosityActive;
}

function renderUnconfiguredState(): HTMLElement {
  return createEmptyState(
    "Notifications not configured yet",
    "Add a Slack webhook URL and choose a verbosity level so Risoluto can notify you when issues complete, fail, or need attention.",
    "Open notification settings",
    () => router.navigate("/settings#notifications"),
    "events",
    { headingLevel: "h2" },
  );
}

function renderConfiguredState(): HTMLElement {
  return createEmptyState(
    "Notifications are configured",
    "Slack messages will be delivered as issues are processed. Delivery history for this page is coming in a future update \u2014 for now, check your Slack channel.",
    "Open board",
    () => router.navigate("/queue"),
    "events",
    { headingLevel: "h2" },
  );
}

function renderErrorState(): HTMLElement {
  return createEmptyState(
    "Could not check notification status",
    "Something went wrong loading the notification configuration. Try refreshing the page, or head to Settings to configure notifications directly.",
    "Open notification settings",
    () => router.navigate("/settings#notifications"),
    "error",
    { headingLevel: "h2" },
  );
}

export function createNotificationsPage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page fade-in";

  const header = createPageHeader(
    "Notifications",
    "Webhook deliveries, system alerts, and operator notifications in one timeline.",
  );

  const body = document.createElement("section");
  body.className = "page-body";
  body.append(skeletonBlock("200px"));

  page.append(header, body);

  void loadNotificationStatus(body);

  return page;
}

async function loadNotificationStatus(body: HTMLElement): Promise<void> {
  try {
    const config = await api.getConfig();
    body.replaceChildren(isSlackConfigured(config) ? renderConfiguredState() : renderUnconfiguredState());
  } catch {
    body.replaceChildren(renderErrorState());
  }
}
