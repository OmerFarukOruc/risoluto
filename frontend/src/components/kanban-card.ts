import type { RuntimeIssueView } from "../types/runtime.js";
import { modelInitials, normalizePriority, normalizeStatus, repoOf, retryCountOf } from "../utils/issues";
import { formatCompactNumber, formatRelativeTime } from "../utils/format";
import { createPulseRing } from "./pulse-ring";
import { createStatusTimelineBar } from "./status-timeline-bar";
import type { BoardCardVariant } from "../state/tweaks";

interface KanbanCardOptions {
  issue: RuntimeIssueView;
  selected: boolean;
  focused: boolean;
  variant: BoardCardVariant;
  onOpen: () => void;
  onFullPage: () => void;
  onFocus: () => void;
  onToggleSelect: (issueId: string, additive: boolean) => void;
  onMove?: (direction: -1 | 1) => void;
}

export interface KanbanCardHandle {
  element: HTMLButtonElement;
  update: (options: KanbanCardOptions) => void;
}

function priLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

const TINT_BY_LABEL: Record<string, string> = {
  bug: "bug",
  feat: "feat",
  feature: "feat",
  ux: "ux",
  perf: "perf",
  performance: "perf",
  security: "security",
};

function tintForLabel(label: string): string {
  return TINT_BY_LABEL[label.toLowerCase()] ?? "default";
}

export function createKanbanCard(options: KanbanCardOptions): KanbanCardHandle {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "kanban-card stagger-item";

  const top = document.createElement("div");
  top.className = "kanban-card-top";

  // `kanban-card-identifier` alongside `kanban-card-id` keeps drag-state.ts and
  // legacy E2E selectors working unchanged.
  const identifier = document.createElement("span");
  identifier.className = "kanban-card-id kanban-card-identifier";

  const idSep = document.createElement("span");
  idSep.className = "kanban-card-id-sep";
  idSep.textContent = "·";

  const repo = document.createElement("span");
  repo.className = "kanban-card-repo";

  const pri = document.createElement("span");
  pri.className = "kanban-card-pri";

  top.append(identifier, idSep, repo, pri);

  const title = document.createElement("div");
  title.className = "kanban-card-title";
  const titleSpan = document.createElement("span");
  title.append(titleSpan);

  const desc = document.createElement("div");
  desc.className = "kanban-card-desc";
  const descSpan = document.createElement("span");
  desc.append(descSpan);

  const labelsRow = document.createElement("div");
  labelsRow.className = "kanban-card-labels";

  let timelineEl: HTMLElement = createStatusTimelineBar("queued");
  let lastTimelineStatus = "queued";

  const foot = document.createElement("div");
  foot.className = "kanban-card-foot";

  const avatar = document.createElement("span");
  avatar.className = "mc-avatar";

  const prSpan = document.createElement("span");
  prSpan.className = "kanban-card-foot-pr";
  prSpan.hidden = true;

  const tokensSpan = document.createElement("span");
  tokensSpan.className = "kanban-card-foot-tokens";
  tokensSpan.hidden = true;

  const retriesSpan = document.createElement("span");
  retriesSpan.className = "kanban-card-foot-retries";
  retriesSpan.hidden = true;

  const footSpacer = document.createElement("span");
  footSpacer.className = "kanban-card-foot-spacer";

  const time = document.createElement("span");
  time.className = "kanban-card-foot-time";

  let pulse: HTMLElement | null = null;

  foot.append(avatar, prSpan, tokensSpan, retriesSpan, footSpacer, time);
  card.append(top, title, desc, labelsRow, timelineEl, foot);

  let latest: KanbanCardOptions = options;

  function syncTop(issue: RuntimeIssueView): void {
    identifier.textContent = issue.identifier;
    const repoText = repoOf(issue) ?? "";
    repo.textContent = repoText;
    repo.hidden = !repoText;
    idSep.hidden = !repoText;
    const normalized = normalizePriority(issue.priority);
    pri.dataset.pri = normalized;
    pri.textContent = priLabel(normalized);
  }

  function syncTitleAndDesc(issue: RuntimeIssueView): void {
    titleSpan.textContent = issue.title;
    const text = issue.description ?? issue.message ?? "";
    descSpan.textContent = text;
    desc.hidden = !text;
  }

  function syncLabels(labels: readonly string[]): void {
    if (labels.length === 0) {
      labelsRow.hidden = true;
      labelsRow.replaceChildren();
      return;
    }
    labelsRow.hidden = false;
    const chips = labels.map((label) => {
      const chip = document.createElement("span");
      chip.className = "mc-label";
      chip.dataset.tint = tintForLabel(label);
      chip.textContent = label;
      return chip;
    });
    labelsRow.replaceChildren(...chips);
  }

  function syncTimeline(issue: RuntimeIssueView): void {
    const status = normalizeStatus(issue.status);
    if (status === lastTimelineStatus) return;
    lastTimelineStatus = status;
    const next = createStatusTimelineBar(status);
    timelineEl.replaceWith(next);
    timelineEl = next;
  }

  function syncAvatar(issue: RuntimeIssueView): void {
    avatar.textContent = modelInitials(issue.model);
    avatar.classList.toggle("is-empty", !issue.model);
    if (issue.model) {
      avatar.dataset.model = issue.model;
      avatar.title = issue.model;
    } else {
      delete avatar.dataset.model;
      avatar.removeAttribute("title");
    }
  }

  function syncPullRequest(issue: RuntimeIssueView): void {
    const url = issue.pullRequestUrl ?? "";
    if (!url) {
      prSpan.hidden = true;
      prSpan.textContent = "";
      return;
    }
    const numberMatch = /\/pull\/(\d+)/u.exec(url);
    prSpan.hidden = false;
    const completed = normalizeStatus(issue.status) === "completed";
    prSpan.classList.toggle("is-merged", completed);
    prSpan.classList.toggle("is-open", !completed);
    prSpan.textContent = numberMatch ? `#${numberMatch[1]}` : "PR";
    prSpan.title = url;
  }

  function syncTokens(issue: RuntimeIssueView): void {
    const total = issue.tokenUsage?.totalTokens ?? 0;
    if (!total) {
      tokensSpan.hidden = true;
      tokensSpan.textContent = "";
      return;
    }
    tokensSpan.hidden = false;
    tokensSpan.textContent = `⚡ ${formatCompactNumber(total).toLowerCase()}`;
    tokensSpan.title = `${total.toLocaleString()} tokens`;
  }

  function syncRetries(issue: RuntimeIssueView): void {
    const retries = retryCountOf(issue);
    if (retries <= 0) {
      retriesSpan.hidden = true;
      retriesSpan.textContent = "";
      return;
    }
    retriesSpan.hidden = false;
    retriesSpan.textContent = `⤺ ${retries}`;
    retriesSpan.title = `${retries} ${retries === 1 ? "retry" : "retries"}`;
  }

  function syncTime(issue: RuntimeIssueView): void {
    time.textContent = formatRelativeTime(issue.updatedAt);
  }

  function syncPulse(issue: RuntimeIssueView): void {
    if (normalizeStatus(issue.status) === "running") {
      if (!pulse) {
        pulse = createPulseRing();
        foot.append(pulse);
      }
      return;
    }
    if (pulse) {
      pulse.remove();
      pulse = null;
    }
  }

  function update(next: KanbanCardOptions): void {
    latest = next;
    card.dataset.issueId = next.issue.identifier;
    card.dataset.status = normalizeStatus(next.issue.status);
    card.dataset.variant = next.variant;
    card.setAttribute(
      "aria-label",
      `${next.issue.identifier}: ${next.issue.title}. Press Enter to open or Shift plus Enter for full page.`,
    );
    card.classList.toggle("is-selected", next.selected);
    card.classList.toggle("is-focused", next.focused);

    syncTop(next.issue);
    syncTitleAndDesc(next.issue);
    syncLabels(next.issue.labels ?? []);
    syncTimeline(next.issue);
    syncAvatar(next.issue);
    syncPullRequest(next.issue);
    syncTokens(next.issue);
    syncRetries(next.issue);
    syncTime(next.issue);
    syncPulse(next.issue);
  }

  card.draggable = true;
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("text/plain", card.dataset.issueId ?? "");
    card.classList.add("is-dragging");
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("is-dragging");
  });
  card.addEventListener("click", (event) => {
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      event.preventDefault();
      latest.onToggleSelect(card.dataset.issueId ?? "", true);
      return;
    }
    latest.onOpen();
  });
  card.addEventListener("focus", () => latest.onFocus());
  card.addEventListener("keydown", (event) => {
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      latest.onMove?.(event.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      latest.onFullPage();
      return;
    }
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      latest.onToggleSelect(card.dataset.issueId ?? "", true);
    }
  });

  update(options);
  return { element: card, update };
}
