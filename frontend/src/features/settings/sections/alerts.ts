import { createSectionHeader } from "../primitives.js";

export function buildAlertsSection(): HTMLElement {
  const section = document.createElement("section");
  section.className = "settings-section settings-section-alerts";
  const header = createSectionHeader({
    title: "Alerts",
    sub: "Custom thresholds for queue health, stalled workers, and cost spikes.",
  });
  section.append(header.root);

  const empty = document.createElement("div");
  empty.className = "settings-section-empty";
  empty.textContent = "Alert rules ship in a follow-up. Until then, configure Slack notifications under Notifications.";
  section.append(empty);

  return section;
}
