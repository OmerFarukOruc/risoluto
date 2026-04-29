import type { HealthCheckStatus, HealthProbeResult, RuntimeSnapshot } from "../types/runtime.js";
import { formatRelativeTime } from "../utils/format";

interface ChecklistRow {
  root: HTMLElement;
  dot: HTMLElement;
  value: HTMLElement;
}

interface SystemHealthChecklist {
  root: HTMLElement;
  update: (snapshot: NonNullable<RuntimeSnapshot> | null) => void;
}

/**
 * Compact checklist showing real-signal probe status straight from
 * `snapshot.health_checks`. Webhook stays on the legacy
 * `webhook_health` field — no backend probe is needed because that's
 * a passive observer of inbound deliveries.
 *
 * Row tooltips compose a forensic line:
 *   "<status> · last success Xm ago · last failure Ys ago · N/M failed · <failureKind>: <detail>"
 *
 * — so an operator can hover a red row and see exactly what broke,
 * when, and how recently.
 */
export function createSystemHealthChecklist(): SystemHealthChecklist {
  const root = document.createElement("div");
  root.className = "system-health-checklist";

  const rows: Record<RowKey, ChecklistRow> = {
    webhook: createRow("Webhook"),
    github: createRow("GitHub"),
    linearApi: createRow("Linear API"),
    docker: createRow("Docker"),
  };
  for (const key of ROW_KEYS) {
    root.append(rows[key].root);
  }

  function update(snapshot: NonNullable<RuntimeSnapshot> | null): void {
    if (!snapshot) {
      for (const key of ROW_KEYS) setRow(rows[key], { text: "—", tone: "muted", title: "" });
      return;
    }

    setRow(rows.webhook, deriveWebhookRow(snapshot));

    const checks = snapshot.health_checks;
    if (checks?.github) {
      setRow(rows.github, fromProbe("GitHub", checks.github));
    } else {
      setRow(rows.github, { text: "Unknown", tone: "muted", title: "Health probe not yet run" });
    }
    if (checks?.linear) {
      setRow(rows.linearApi, fromProbe("Linear API", checks.linear));
    } else {
      setRow(rows.linearApi, { text: "Unknown", tone: "muted", title: "Health probe not yet run" });
    }
    if (checks?.docker) {
      setRow(rows.docker, fromProbe("Docker", checks.docker));
    } else {
      setRow(rows.docker, { text: "Unknown", tone: "muted", title: "Health probe not yet run" });
    }
  }

  return { root, update };
}

const ROW_KEYS = ["webhook", "github", "linearApi", "docker"] as const;
type RowKey = (typeof ROW_KEYS)[number];

type Tone = "ok" | "warn" | "err" | "muted";

interface RowState {
  text: string;
  tone: Tone;
  title: string;
}

function deriveWebhookRow(snapshot: NonNullable<RuntimeSnapshot>): RowState {
  const status = snapshot.webhook_health?.status;
  if (status === "connected") return { text: "Connected", tone: "ok", title: "Webhook receiving deliveries" };
  if (status === "degraded") return { text: "Degraded", tone: "warn", title: "Webhook delivery delayed" };
  if (status === "disconnected")
    return { text: "Disconnected", tone: "err", title: "Webhook not receiving deliveries" };
  return { text: "Unknown", tone: "muted", title: "" };
}

function fromProbe(label: string, probe: HealthProbeResult): RowState {
  const text = renderText(probe);
  const tone = renderTone(probe.status);
  const title = renderTooltip(label, probe);
  return { text, tone, title };
}

function renderText(probe: HealthProbeResult): string {
  switch (probe.status) {
    case "ok":
      return "OK";
    case "slow":
      return "Slow";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
    case "unknown":
    default:
      return "Unknown";
  }
}

function renderTone(status: HealthCheckStatus): Tone {
  switch (status) {
    case "ok":
      return "ok";
    case "slow":
    case "degraded":
      return "warn";
    case "down":
      return "err";
    case "unknown":
    default:
      return "muted";
  }
}

function renderTooltip(label: string, probe: HealthProbeResult): string {
  const lines: string[] = [];
  lines.push(`${label}: ${probe.status}`);
  if (probe.detail) lines.push(probe.detail);
  if (probe.failure_kind && probe.failure_kind !== "ok") lines.push(`Kind: ${probe.failure_kind}`);
  if (probe.last_success_at) lines.push(`Last success ${formatRelativeTime(probe.last_success_at)}`);
  if (probe.last_failure_at) lines.push(`Last failure ${formatRelativeTime(probe.last_failure_at)}`);
  if (probe.window_ok + probe.window_failed > 0) {
    lines.push(`Window: ${probe.window_ok} ok / ${probe.window_failed} failed`);
  }
  if (probe.subprobes.length > 1) {
    lines.push(""); // blank line separator
    for (const sub of probe.subprobes) {
      const detailFragment = sub.detail ? ` — ${sub.detail}` : "";
      lines.push(`• ${sub.name}: ${sub.status}${detailFragment}`);
    }
  }
  return lines.join("\n");
}

function createRow(label: string): ChecklistRow {
  const root = document.createElement("div");
  root.className = "system-health-checklist-row";

  const dot = document.createElement("span");
  dot.className = "system-health-checklist-dot";
  dot.setAttribute("aria-hidden", "true");

  const labelEl = document.createElement("span");
  labelEl.className = "system-health-checklist-label";
  labelEl.textContent = label;

  const value = document.createElement("span");
  value.className = "system-health-checklist-value";

  root.append(dot, labelEl, value);
  return { root, dot, value };
}

function setRow(row: ChecklistRow, state: RowState): void {
  row.value.textContent = state.text;
  row.value.dataset.tone = state.tone;
  row.dot.dataset.tone = state.tone;
  if (state.title) row.root.title = state.title;
  else row.root.removeAttribute("title");
}
