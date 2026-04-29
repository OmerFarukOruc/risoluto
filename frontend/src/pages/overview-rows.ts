import { router } from "../router";
import type { RuntimeIssueView } from "../types/runtime.js";
import { formatElapsedMmSs, formatRelativeTime } from "../utils/format";
import { createOutcomeBadge, formatDurationCompact, STATUS_TO_OUTCOME } from "../components/outcome-badge";
import { createPulseRing } from "../components/pulse-ring";
import { flashDiff } from "../utils/diff";

const LIVE_STATUSES = new Set(["running", "retrying"]);
const ACTIVE_STATUSES = new Set(["running", "retrying", "claimed"]);

function formatAttentionStatus(status: string): string {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "retrying":
      return "Retrying";
    case "running":
      return "Running";
    case "claimed":
      return "Claimed";
    case "queued":
      return "Queued";
    default:
      return status.replaceAll("_", " ");
  }
}

/**
 * Creates an issue row for the attention or terminal list.
 * Terminal rows include an outcome badge and optional duration.
 */
export function issueRow(issue: RuntimeIssueView, target: "attention" | "terminal"): HTMLButtonElement {
  const row = document.createElement("button");
  row.type = "button";
  row.className = target === "attention" ? "overview-attention-item" : "overview-terminal-item";
  row.dataset.status = issue.status;

  const meta = document.createElement("div");
  meta.className = "overview-row-meta";

  const ident = document.createElement("strong");
  ident.className = "text-mono";
  ident.textContent = issue.identifier;

  const liveElapsed =
    target === "attention" && ACTIVE_STATUSES.has(issue.status) ? formatElapsedMmSs(issue.startedAt) : null;
  const time = document.createElement("span");
  time.className = "overview-small overview-row-time";
  time.textContent = liveElapsed ?? formatRelativeTime(issue.updatedAt);

  const metaTail = document.createElement("div");
  metaTail.className = "overview-row-meta-tail";

  meta.append(ident);

  if (target === "attention") {
    if (LIVE_STATUSES.has(issue.status)) {
      const pulse = createPulseRing({
        color: issue.status === "retrying" ? "var(--status-retrying)" : "var(--status-running)",
        size: 6,
      });
      meta.append(pulse);
    }
    const status = document.createElement("span");
    status.className = "overview-row-status";
    status.dataset.status = issue.status;
    status.textContent = formatAttentionStatus(issue.status);
    meta.append(status);
  }

  metaTail.append(time);
  meta.append(metaTail);

  const titleDiv = document.createElement("div");
  titleDiv.className = "overview-row-title";
  titleDiv.textContent = issue.title;

  row.append(meta, titleDiv);

  if (target === "terminal") {
    const footer = document.createElement("div");
    footer.className = "overview-row-footer";

    const outcome = STATUS_TO_OUTCOME[issue.status];
    if (outcome) {
      footer.append(createOutcomeBadge(outcome, { iconSize: 12 }));
    }

    if (issue.startedAt) {
      const elapsed = Date.parse(issue.updatedAt) - Date.parse(issue.startedAt);
      if (elapsed > 0) {
        const dur = document.createElement("span");
        dur.className = "overview-small";
        dur.textContent = formatDurationCompact(elapsed);
        footer.append(dur);
      }
    }

    row.append(footer);
  }

  row.addEventListener("click", () => router.navigate(`/queue/${issue.identifier}`));

  return row;
}

/**
 * Compact single-line row for the sidebar "Finished recently" peek list.
 * Dot · ID · status badge. No title, no duration, no outcome card. Click
 * navigates to the issue detail.
 */
export function finishedPeekRow(issue: RuntimeIssueView): HTMLButtonElement {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "overview-finished-peek-row";
  row.dataset.status = issue.status;

  const dot = document.createElement("span");
  dot.className = "overview-finished-peek-dot";
  dot.dataset.status = issue.status;
  dot.setAttribute("aria-hidden", "true");

  const ident = document.createElement("strong");
  ident.className = "overview-finished-peek-id";
  ident.textContent = issue.identifier;

  const status = document.createElement("span");
  status.className = "overview-row-status";
  status.dataset.status = issue.status;
  status.textContent = formatTerminalStatus(issue.status);

  row.append(dot, ident, status);
  row.addEventListener("click", () => router.navigate(`/queue/${issue.identifier}`));
  return row;
}

function formatTerminalStatus(status: string): string {
  switch (status) {
    case "completed":
      return "Done";
    case "closed":
      return "Closed";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "failed":
      return "Failed";
    default:
      return status.replaceAll("_", " ");
  }
}

/** WeakMap fingerprint cache — avoids DOM thrash when list content is unchanged. */
const listFingerprints = new WeakMap<HTMLElement, string>();

/**
 * Fills a container with new items, applying flash diff animation.
 * Skips DOM mutation when the fingerprint is unchanged.
 */
export function fillList(container: HTMLElement, items: HTMLElement[]): void {
  const fingerprint = items.map((el) => el.textContent ?? "").join("\0");
  if (listFingerprints.get(container) === fingerprint) return;
  listFingerprints.set(container, fingerprint);
  container.replaceChildren(...items);
  for (const item of items) {
    flashDiff(item);
  }
}
