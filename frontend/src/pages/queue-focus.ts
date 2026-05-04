import type { RecentEvent, RuntimeIssueView, WorkflowColumn } from "../types/runtime.js";
import { skeletonColumn } from "../ui/skeleton";
import { matchesStatusFilter, repoOf, uniqueIssues } from "./queue-state";
import type { BoardStatusFilter } from "../state/tweaks";
import { formatCompactNumber, formatRelativeTime } from "../utils/format";
import { modelInitials, normalizeStatus } from "../utils/issues";

interface QueueFocusRendererOptions {
  board: HTMLElement;
  getRouteId: () => string;
  onOpenIssue: (issueId: string, fullPage: boolean) => void;
  getRecentEvents: () => readonly RecentEvent[];
  onSetStatusFilter: (filter: BoardStatusFilter) => void;
}

interface FocusRendererHandle {
  renderLoading(): void;
  render(columns: WorkflowColumn[]): void;
}

function lastFiveLogLines(events: readonly RecentEvent[], identifier: string): RecentEvent[] {
  const matched: RecentEvent[] = [];
  for (let i = events.length - 1; i >= 0 && matched.length < 5; i--) {
    const event = events[i];
    if (event.issue_identifier !== identifier) continue;
    matched.push(event);
  }
  return matched.reverse();
}

function appendMeta(parent: HTMLElement, label: string, value: string | HTMLElement): void {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  if (typeof value === "string") {
    dd.textContent = value;
  } else {
    dd.append(value);
  }
  parent.append(dt, dd);
}

function renderModelMeta(issue: RuntimeIssueView): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "queue-focus-card-model";
  if (!issue.model) {
    wrap.textContent = "—";
    return wrap;
  }
  const avatar = document.createElement("span");
  avatar.className = "mc-avatar";
  avatar.textContent = modelInitials(issue.model);
  avatar.dataset.model = issue.model;
  const name = document.createElement("span");
  name.textContent = issue.model;
  wrap.append(avatar, name);
  return wrap;
}

function buildCardHeader(issue: RuntimeIssueView): HTMLElement {
  const header = document.createElement("header");
  header.className = "queue-focus-card-head";

  const idLine = document.createElement("div");
  idLine.className = "queue-focus-card-idline";
  const id = document.createElement("span");
  id.className = "queue-focus-card-id";
  id.textContent = issue.identifier;
  const repo = document.createElement("span");
  repo.className = "queue-focus-card-repo";
  const repoText = repoOf(issue) ?? "";
  repo.textContent = repoText;
  if (!repoText) repo.hidden = true;
  idLine.append(id, repo);

  const title = document.createElement("h3");
  title.className = "queue-focus-card-title";
  title.textContent = issue.title;

  header.append(idLine, title);
  return header;
}

function buildCardMeta(issue: RuntimeIssueView): HTMLElement {
  const meta = document.createElement("dl");
  meta.className = "queue-focus-card-meta";
  const tokens = issue.tokenUsage?.totalTokens;
  appendMeta(meta, "Model", renderModelMeta(issue));
  appendMeta(meta, "Branch", issue.branchName ?? "—");
  appendMeta(meta, "Tokens", tokens ? formatCompactNumber(tokens).toLowerCase() : "—");
  appendMeta(meta, "Age", formatRelativeTime(issue.updatedAt));
  return meta;
}

function buildCardLog(logLines: readonly RecentEvent[]): HTMLElement {
  const log = document.createElement("section");
  log.className = "queue-focus-card-log";
  const logTitle = document.createElement("h4");
  logTitle.className = "queue-focus-card-log-title";
  logTitle.textContent = "Recent activity";
  const logList = document.createElement("ol");
  logList.className = "queue-focus-card-log-list";
  if (logLines.length === 0) {
    const empty = document.createElement("li");
    empty.className = "queue-focus-card-log-empty";
    empty.textContent = "No events yet for this attempt.";
    logList.append(empty);
  } else {
    for (const event of logLines) {
      const item = document.createElement("li");
      item.className = "queue-focus-card-log-line";
      const time = document.createElement("span");
      time.className = "queue-focus-card-log-time";
      time.textContent = formatRelativeTime(event.at);
      const text = document.createElement("span");
      text.className = "queue-focus-card-log-text";
      text.textContent = event.message || event.event;
      item.append(time, text);
      logList.append(item);
    }
  }
  log.append(logTitle, logList);
  return log;
}

function buildLinkButton(label: string, href: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "mc-button is-ghost is-sm";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function buildCardFooter(issue: RuntimeIssueView, onOpen: (fullPage: boolean) => void): HTMLElement {
  const footer = document.createElement("footer");
  footer.className = "queue-focus-card-foot";
  const open = document.createElement("button");
  open.type = "button";
  open.className = "mc-button is-ghost is-sm";
  open.textContent = "Open detail";
  open.addEventListener("click", () => onOpen(false));
  footer.append(open);
  if (issue.url) footer.append(buildLinkButton("Open in tracker", issue.url));
  if (issue.pullRequestUrl) footer.append(buildLinkButton("View PR", issue.pullRequestUrl));
  return footer;
}

function buildExpandedCard(
  issue: RuntimeIssueView,
  logLines: readonly RecentEvent[],
  selected: boolean,
  onOpen: (fullPage: boolean) => void,
): HTMLElement {
  const card = document.createElement("article");
  card.className = "queue-focus-card stagger-item";
  card.dataset.issueId = issue.identifier;
  card.dataset.status = normalizeStatus(issue.status);
  card.classList.toggle("is-selected", selected);
  card.append(buildCardHeader(issue), buildCardMeta(issue), buildCardLog(logLines), buildCardFooter(issue, onOpen));
  return card;
}

export function createQueueFocusRenderer(options: QueueFocusRendererOptions): FocusRendererHandle {
  function renderLoading(): void {
    const skeleton = skeletonColumn();
    skeleton.classList.add("queue-focus-skeleton");
    options.board.replaceChildren(skeleton);
  }

  function renderEmpty(allIssues: readonly RuntimeIssueView[]): void {
    const queued = allIssues.filter((issue) => matchesStatusFilter(issue, "queued")).length;
    const blocked = allIssues.filter((issue) => matchesStatusFilter(issue, "blocked")).length;
    const wrap = document.createElement("div");
    wrap.className = "queue-focus-empty";
    const headline = document.createElement("p");
    headline.className = "queue-focus-empty-headline";
    headline.textContent = "Nothing running.";
    const counters = document.createElement("p");
    counters.className = "queue-focus-empty-counts";
    const queuedBtn = document.createElement("button");
    queuedBtn.type = "button";
    queuedBtn.className = "queue-focus-empty-link";
    queuedBtn.textContent = `Queue: ${queued}`;
    queuedBtn.addEventListener("click", () => options.onSetStatusFilter("queued"));
    const sep = document.createElement("span");
    sep.textContent = " · ";
    sep.setAttribute("aria-hidden", "true");
    const blockedBtn = document.createElement("button");
    blockedBtn.type = "button";
    blockedBtn.className = "queue-focus-empty-link";
    blockedBtn.textContent = `Blocked: ${blocked}`;
    blockedBtn.addEventListener("click", () => options.onSetStatusFilter("blocked"));
    counters.append(queuedBtn, sep, blockedBtn);
    wrap.append(headline, counters);
    options.board.replaceChildren(wrap);
  }

  function render(columns: WorkflowColumn[]): void {
    if (columns.length === 0) {
      renderLoading();
      return;
    }
    const issues = uniqueIssues(columns);
    const running = issues.filter((issue) => matchesStatusFilter(issue, "running"));
    if (running.length === 0) {
      renderEmpty(issues);
      return;
    }
    const events = options.getRecentEvents();
    const cards = running.map((issue, index) => {
      const lines = lastFiveLogLines(events, issue.identifier);
      const card = buildExpandedCard(issue, lines, options.getRouteId() === issue.identifier, (fullPage) =>
        options.onOpenIssue(issue.identifier, fullPage),
      );
      card.style.setProperty("--stagger-index", String(index));
      return card;
    });
    const wrap = document.createElement("div");
    wrap.className = "queue-focus-stack";
    wrap.append(...cards);
    options.board.replaceChildren(wrap);
  }

  return { renderLoading, render };
}
