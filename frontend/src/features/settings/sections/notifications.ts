import { api } from "../../../api.js";
import { toast } from "../../../ui/toast.js";
import { createSelectField, createTextField, createToggle } from "../primitives.js";
import type { SettingsWorkbench } from "../workbench.js";
import { buildSectionShell } from "./section-shell.js";
import type { RowDef } from "./section-shell.js";

const VERBOSITY_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "critical", label: "Critical only" },
  { value: "verbose", label: "Verbose" },
];

function createSendTestButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mc-button is-ghost is-sm";
  button.textContent = "Send test";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await api.postNotificationTest();
      toast("Slack test sent", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send Slack test";
      toast(message, "error");
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

export function buildNotificationsSection(wb: SettingsWorkbench): HTMLElement {
  const rows: RowDef[] = [
    {
      path: "notifications.slack.webhookUrl",
      label: "Slack webhook URL",
      hint: "Incoming webhook URL from your Slack app configuration.",
      control: (val, onDraft) =>
        createTextField({
          value: String(val ?? ""),
          placeholder: "https://hooks.slack.com/services/…",
          mono: true,
          onInput: (v) => onDraft(v),
        }),
    },
    {
      path: "notifications.slack.verbosity",
      label: "Verbosity",
      hint: "How much detail to include in Slack notifications.",
      control: (val, onDraft) =>
        createSelectField({
          value: String(val ?? "critical"),
          options: VERBOSITY_OPTIONS,
          onChange: (v) => onDraft(v),
        }),
    },
    {
      path: "notifications.slack.enabled",
      label: "Enable Slack notifications",
      hint: "Send agent lifecycle events to the configured Slack webhook.",
      control: (val, onDraft) => createToggle({ checked: val !== false, onChange: (v) => onDraft(v) }),
    },
  ];

  return buildSectionShell({
    sectionId: "notifications",
    title: "Notifications",
    sub: "Slack alerts for agent lifecycle events.",
    namespace: "notifications",
    rows,
    wb,
    headerAction: createSendTestButton(),
    buildPatch: (drafts) => {
      const patch: Record<string, unknown> = {};
      for (const [path, value] of drafts) {
        const key = path.replace("notifications.", "");
        if (key.startsWith("slack.")) {
          const subKey = key.replace("slack.", "");
          const slack = (patch["slack"] as Record<string, unknown>) ?? {};
          slack[subKey] = value;
          patch["slack"] = slack;
        } else {
          patch[key] = value;
        }
      }
      return patch;
    },
  });
}
