import type { RuntimeIssueView, WorkflowColumn } from "../types/runtime.js";
import { skeletonColumn } from "../ui/skeleton";
import { filterColumn, matchesStatusFilter, type QueueFilters, type QueueUiState } from "./queue-state";
import type { BoardTweaks } from "../state/tweaks";
import { formatCompactNumber, formatRelativeTime } from "../utils/format";
import { modelInitials, normalizeStatus, repoOf } from "../utils/issues";

function collectAllowedIssues(columns: readonly WorkflowColumn[], filters: QueueFilters): RuntimeIssueView[] {
  const seen = new Set<string>();
  const out: RuntimeIssueView[] = [];
  for (const column of columns) {
    for (const issue of filterColumn(column, filters)) {
      if (seen.has(issue.identifier)) continue;
      seen.add(issue.identifier);
      out.push(issue);
    }
  }
  return out;
}

interface QueueListRendererOptions {
  board: HTMLElement;
  filters: QueueFilters;
  getUi: () => QueueUiState;
  getTweaks: () => BoardTweaks;
  getRouteId: () => string;
  onOpenIssue: (issueId: string, fullPage: boolean) => void;
}

interface ListRendererHandle {
  renderLoading(): void;
  render(columns: WorkflowColumn[]): void;
}

type SortDirection = "asc" | "desc";

interface SortState {
  column: ColumnKey;
  direction: SortDirection;
}

type ColumnKey = "status" | "id" | "title" | "repo" | "model" | "age" | "progress";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  sortable: boolean;
  defaultDirection: SortDirection;
}

const COLUMNS: readonly ColumnDef[] = [
  { key: "status", label: "Status", sortable: true, defaultDirection: "asc" },
  { key: "id", label: "ID", sortable: true, defaultDirection: "asc" },
  { key: "title", label: "Title", sortable: true, defaultDirection: "asc" },
  { key: "repo", label: "Repo", sortable: true, defaultDirection: "asc" },
  { key: "model", label: "Model", sortable: true, defaultDirection: "asc" },
  { key: "age", label: "Age", sortable: true, defaultDirection: "desc" },
  { key: "progress", label: "Progress", sortable: true, defaultDirection: "desc" },
];

const STATUS_RANK: Record<string, number> = {
  running: 0,
  in_progress: 0,
  retrying: 1,
  claimed: 2,
  queued: 3,
  pending: 3,
  blocked: 4,
  in_review: 4,
  review: 4,
  completed: 5,
  done: 5,
  closed: 5,
  cancelled: 6,
  canceled: 6,
  failed: 6,
  timed_out: 6,
  stalled: 6,
  duplicate: 7,
};

function statusRank(issue: RuntimeIssueView): number {
  return STATUS_RANK[normalizeStatus(issue.status)] ?? 99;
}

function compareForKey(left: RuntimeIssueView, right: RuntimeIssueView, key: ColumnKey): number {
  switch (key) {
    case "status": {
      const rankDelta = statusRank(left) - statusRank(right);
      if (rankDelta !== 0) return rankDelta;
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    }
    case "id":
      return left.identifier.localeCompare(right.identifier, undefined, { numeric: true });
    case "title":
      return left.title.localeCompare(right.title);
    case "repo":
      return (repoOf(left) ?? "").localeCompare(repoOf(right) ?? "");
    case "model":
      return (left.model ?? "").localeCompare(right.model ?? "");
    case "age":
      return Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
    case "progress":
      return (left.tokenUsage?.totalTokens ?? 0) - (right.tokenUsage?.totalTokens ?? 0);
  }
}

function buildHeader(sort: SortState, onSort: (key: ColumnKey) => void): HTMLTableSectionElement {
  const thead = document.createElement("thead");
  const row = document.createElement("tr");
  for (const column of COLUMNS) {
    const th = document.createElement("th");
    th.scope = "col";
    th.dataset.column = column.key;
    if (!column.sortable) {
      th.textContent = column.label;
      row.append(th);
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "queue-list-sort";
    button.dataset.column = column.key;
    const isActive = sort.column === column.key;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-sort", isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none");
    const labelEl = document.createElement("span");
    labelEl.textContent = column.label;
    const indicator = document.createElement("span");
    indicator.className = "queue-list-sort-indicator";
    indicator.setAttribute("aria-hidden", "true");
    indicator.textContent = isActive ? (sort.direction === "asc" ? "▲" : "▼") : "";
    button.append(labelEl, indicator);
    button.addEventListener("click", () => onSort(column.key));
    th.append(button);
    row.append(th);
  }
  thead.append(row);
  return thead;
}

function buildRow(
  issue: RuntimeIssueView,
  selected: boolean,
  onOpen: (fullPage: boolean) => void,
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.className = "queue-list-row stagger-item";
  tr.dataset.issueId = issue.identifier;
  tr.dataset.status = normalizeStatus(issue.status);
  tr.classList.toggle("is-selected", selected);
  tr.tabIndex = 0;

  const statusCell = document.createElement("td");
  statusCell.className = "queue-list-status";
  const statusDot = document.createElement("span");
  statusDot.className = "queue-list-status-dot";
  const statusText = document.createElement("span");
  statusText.className = "queue-list-status-text";
  statusText.textContent = issue.status;
  statusCell.append(statusDot, statusText);

  const idCell = document.createElement("td");
  idCell.className = "queue-list-id";
  idCell.textContent = issue.identifier;

  const titleCell = document.createElement("td");
  titleCell.className = "queue-list-title";
  titleCell.textContent = issue.title;
  titleCell.title = issue.title;

  const repoCell = document.createElement("td");
  repoCell.className = "queue-list-repo";
  repoCell.textContent = repoOf(issue) ?? "";

  const modelCell = document.createElement("td");
  modelCell.className = "queue-list-model";
  if (issue.model) {
    const avatar = document.createElement("span");
    avatar.className = "mc-avatar";
    avatar.textContent = modelInitials(issue.model);
    avatar.dataset.model = issue.model;
    avatar.title = issue.model;
    const name = document.createElement("span");
    name.className = "queue-list-model-name";
    name.textContent = issue.model;
    modelCell.append(avatar, name);
  }

  const ageCell = document.createElement("td");
  ageCell.className = "queue-list-age";
  ageCell.textContent = formatRelativeTime(issue.updatedAt);

  const progressCell = document.createElement("td");
  progressCell.className = "queue-list-progress";
  const tokens = issue.tokenUsage?.totalTokens ?? 0;
  progressCell.textContent = tokens > 0 ? `${formatCompactNumber(tokens).toLowerCase()} tok` : "";

  tr.append(statusCell, idCell, titleCell, repoCell, modelCell, ageCell, progressCell);

  tr.addEventListener("click", (event) => {
    onOpen(event.shiftKey);
  });
  tr.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen(event.shiftKey);
    }
  });

  return tr;
}

export function createQueueListRenderer(options: QueueListRendererOptions): ListRendererHandle {
  let sort: SortState = { column: "status", direction: "asc" };

  function renderLoading(): void {
    const skeleton = skeletonColumn();
    skeleton.classList.add("queue-list-skeleton");
    options.board.replaceChildren(skeleton);
  }

  function renderEmpty(): void {
    const wrap = document.createElement("div");
    wrap.className = "queue-list-empty";
    wrap.textContent = "No issues match current filter.";
    options.board.replaceChildren(wrap);
  }

  function render(columns: WorkflowColumn[]): void {
    if (columns.length === 0) {
      renderLoading();
      return;
    }
    const tweaks = options.getTweaks();
    const ui = options.getUi();
    const allowed = collectAllowedIssues(columns, options.filters);
    const issues =
      tweaks.statusFilter === "all"
        ? allowed
        : allowed.filter((issue) => matchesStatusFilter(issue, tweaks.statusFilter));

    const sorted = [...issues].sort((left, right) => {
      const cmp = compareForKey(left, right, sort.column);
      return sort.direction === "asc" ? cmp : -cmp;
    });

    if (sorted.length === 0) {
      renderEmpty();
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "queue-list-wrap";
    const table = document.createElement("table");
    table.className = "mc-table queue-list-table";

    const onSort = (key: ColumnKey): void => {
      const column = COLUMNS.find((c) => c.key === key);
      if (!column?.sortable) return;
      sort =
        sort.column === key
          ? { column: key, direction: sort.direction === "asc" ? "desc" : "asc" }
          : { column: key, direction: column.defaultDirection };
      render(columns);
    };

    table.append(buildHeader(sort, onSort));

    const tbody = document.createElement("tbody");
    for (const [index, issue] of sorted.entries()) {
      const row = buildRow(issue, options.getRouteId() === issue.identifier, (fullPage) =>
        options.onOpenIssue(issue.identifier, fullPage),
      );
      row.style.setProperty("--stagger-index", String(index));
      row.classList.toggle("is-multi-select", ui.selected.has(issue.identifier));
      tbody.append(row);
    }
    table.append(tbody);
    wrap.append(table);
    options.board.replaceChildren(wrap);
  }

  return { renderLoading, render };
}
