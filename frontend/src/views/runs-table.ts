import type { AttemptSummary } from "../types";
import { statusChip } from "../ui/status-chip";
import { applyTableRowInteraction, createMonoTableCell, setTableCellLabel } from "../ui/table";
import { formatCompactNumber, formatRelativeTime, formatRunDuration, formatTimestamp } from "../utils/format";
import type { SortableColumn, SortDirection } from "./runs-state";

export interface RunsTableOptions {
  attempts: AttemptSummary[];
  activeAttemptId: string | null;
  compareAttemptIds: string[];
  sortColumn: SortableColumn | null;
  sortDirection: SortDirection;
  onSelect: (attemptId: string) => void;
  onToggleCompare: (attemptId: string) => void;
  onSort: (column: SortableColumn) => void;
  issueIdentifier: string;
}

interface ColumnSpec {
  key: SortableColumn | "compare";
  label: string;
  className: string;
}

const COLUMNS: ColumnSpec[] = [
  { key: "compare", label: "", className: "col-compare" },
  { key: "run", label: "Run", className: "col-run" },
  { key: "status", label: "Status", className: "col-status" },
  { key: "started", label: "Started", className: "col-start" },
  { key: "duration", label: "Duration", className: "col-duration" },
  { key: "model", label: "Model", className: "col-model" },
  { key: "appserver", label: "App-server", className: "col-appserver" },
  { key: "tokens", label: "Tokens", className: "col-tokens" },
];

function tokenBreakdown(attempt: AttemptSummary): string {
  if (!attempt.tokenUsage) {
    return "—";
  }
  return `${formatCompactNumber(attempt.tokenUsage.totalTokens)} · ${formatCompactNumber(attempt.tokenUsage.inputTokens)}/${formatCompactNumber(attempt.tokenUsage.outputTokens)}`;
}

function durationLabel(attempt: AttemptSummary): string {
  return formatRunDuration(attempt.startedAt, attempt.endedAt);
}

function createStartCell(attempt: AttemptSummary): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.textContent = formatRelativeTime(attempt.startedAt);
  cell.title = formatTimestamp(attempt.startedAt);
  return cell;
}

function threadStatusClass(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "is-status-running";
    case "idle":
    case "completed":
      return "is-status-completed";
    case "systemError":
      return "is-status-blocked";
    case "notLoaded":
      return "is-status-queued";
    default:
      return "is-status";
  }
}

function createModelCell(attempt: AttemptSummary): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.className = "text-mono";

  const wrap = document.createElement("span");
  wrap.className = "runs-model-cell";

  const name = document.createElement("span");
  name.className = "runs-model-name";
  name.textContent = attempt.model ?? "—";
  wrap.append(name);

  if (attempt.reasoningEffort) {
    const chip = document.createElement("span");
    chip.className = "runs-reasoning-chip";
    chip.textContent = attempt.reasoningEffort;
    wrap.append(chip);
  }

  cell.append(wrap);
  cell.title = attempt.reasoningEffort
    ? `${attempt.model ?? "—"} · ${attempt.reasoningEffort}`
    : (attempt.model ?? "—");
  return cell;
}

function createAppServerCell(attempt: AttemptSummary): HTMLTableCellElement {
  const cell = document.createElement("td");

  const wrap = document.createElement("div");
  wrap.className = "runs-app-server";

  const provider = document.createElement("strong");
  provider.className = "text-mono";
  provider.textContent = attempt.appServerBadge?.effectiveProvider ?? "—";

  wrap.append(provider);

  if (attempt.appServerBadge?.threadStatus) {
    const status = document.createElement("span");
    status.className = `mc-badge is-sm ${threadStatusClass(attempt.appServerBadge.threadStatus)}`;
    status.textContent = attempt.appServerBadge.threadStatus;
    wrap.append(status);
  }

  cell.append(wrap);
  cell.title = [attempt.appServerBadge?.effectiveProvider ?? "—", attempt.appServerBadge?.threadStatus ?? "—"].join(
    " · ",
  );
  return cell;
}

function createSortableHeader(
  spec: ColumnSpec,
  sortColumn: SortableColumn | null,
  sortDirection: SortDirection,
  onSort: (column: SortableColumn) => void,
): HTMLTableCellElement {
  const th = document.createElement("th");
  th.scope = "col";

  if (spec.key === "compare") {
    th.textContent = spec.label;
    return th;
  }

  const column = spec.key;
  const isSorted = sortColumn === column;

  th.classList.add("runs-sortable");
  if (isSorted) {
    th.classList.add("is-sorted");
    th.setAttribute("aria-sort", sortDirection === "asc" ? "ascending" : "descending");
  } else {
    th.setAttribute("aria-sort", "none");
  }
  th.tabIndex = 0;

  const labelSpan = document.createElement("span");
  labelSpan.className = "runs-sort-label";
  labelSpan.textContent = spec.label;

  const indicator = document.createElement("span");
  indicator.className = "runs-sort-indicator";
  indicator.setAttribute("aria-hidden", "true");
  indicator.textContent = isSorted ? (sortDirection === "asc" ? "↑" : "↓") : "";

  th.append(labelSpan, indicator);

  const activate = (): void => onSort(column);
  th.addEventListener("click", activate);
  th.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  });

  return th;
}

function createCompareCell(
  attempt: AttemptSummary,
  isCompared: boolean,
  onToggleCompare: (attemptId: string) => void,
): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.className = "runs-compare-cell";
  cell.dataset.label = "Compare";

  const label = document.createElement("label");
  label.className = "runs-compare-target";
  label.setAttribute("aria-label", `Compare run #${attempt.attemptNumber ?? "—"}`);
  label.addEventListener("click", (event) => event.stopPropagation());

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = isCompared;
  checkbox.addEventListener("change", () => onToggleCompare(attempt.attemptId));

  label.append(checkbox);
  cell.append(label);
  return cell;
}

export function createRunsTable(options: RunsTableOptions): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "runs-table-wrap mc-panel";
  wrap.setAttribute("role", "region");
  wrap.setAttribute("aria-label", `Run history for ${options.issueIdentifier}`);
  wrap.tabIndex = 0;

  const table = document.createElement("table");
  table.className = "attempts-table runs-table";
  table.setAttribute("aria-label", `Run history for ${options.issueIdentifier}`);

  const colgroup = document.createElement("colgroup");
  for (const spec of COLUMNS) {
    const col = document.createElement("col");
    col.className = spec.className;
    colgroup.append(col);
  }

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const spec of COLUMNS) {
    headRow.append(createSortableHeader(spec, options.sortColumn, options.sortDirection, options.onSort));
  }
  head.append(headRow);

  const body = document.createElement("tbody");
  options.attempts.forEach((attempt) => {
    const row = document.createElement("tr");
    const isActive = options.activeAttemptId === attempt.attemptId;
    const isCompared = options.compareAttemptIds.includes(attempt.attemptId);
    row.className = "runs-row";
    row.dataset.attemptId = attempt.attemptId;
    if (isActive) {
      row.classList.add("is-active");
      row.setAttribute("aria-current", "true");
    }
    if (isCompared) {
      row.classList.add("is-compared");
    }
    if (attempt.endedAt === null) {
      row.classList.add("is-live");
    }
    applyTableRowInteraction(row, () => options.onSelect(attempt.attemptId), {
      keyboard: "enter",
    });

    const compareCell = createCompareCell(attempt, isCompared, options.onToggleCompare);

    const runCell = document.createElement("td");
    runCell.dataset.label = "Run";
    const runWrap = document.createElement("div");
    runWrap.className = "runs-run-cell";
    const runNumber = document.createElement("strong");
    runNumber.className = "text-mono";
    runNumber.textContent = `#${attempt.attemptNumber ?? "—"}`;
    runWrap.append(runNumber);
    if (attempt.endedAt === null) {
      const livePill = document.createElement("span");
      livePill.className = "mc-badge runs-live-pill";
      livePill.textContent = "Live";
      livePill.title = "Current live run";
      runWrap.append(livePill);
    }
    runCell.append(runWrap);

    const statusCell = document.createElement("td");
    statusCell.dataset.label = "Status";
    statusCell.append(statusChip(attempt.status));

    const startCell = setTableCellLabel(createStartCell(attempt), "Started");
    const durationCell = setTableCellLabel(createMonoTableCell(durationLabel(attempt)), "Duration");
    const modelCell = setTableCellLabel(createModelCell(attempt), "Model");
    const appServerCell = setTableCellLabel(createAppServerCell(attempt), "App-server");
    const tokenCell = setTableCellLabel(createMonoTableCell(tokenBreakdown(attempt)), "Tokens");

    row.append(compareCell, runCell, statusCell, startCell, durationCell, modelCell, appServerCell, tokenCell);
    body.append(row);
  });

  table.append(colgroup, head, body);
  wrap.append(table);
  return wrap;
}

/**
 * Update active/compare state on a previously-rendered runs table without
 * rebuilding the tbody. Returns true if the wrap was a runs-table wrap and
 * row count matches the attempts list (so a scoped update was sufficient),
 * false if the caller should fall back to a full rebuild.
 */
export function updateRunsTableState(
  wrap: HTMLElement,
  attempts: AttemptSummary[],
  activeAttemptId: string | null,
  compareAttemptIds: string[],
): boolean {
  const rows = wrap.querySelectorAll<HTMLTableRowElement>("tr.runs-row");
  if (rows.length !== attempts.length) {
    return false;
  }

  for (let index = 0; index < attempts.length; index += 1) {
    const row = rows[index];
    const expectedId = attempts[index].attemptId;
    const attemptId = row.dataset.attemptId;
    if (attemptId !== expectedId) {
      // Row order drifted (e.g. sort column changed) — caller must rebuild.
      return false;
    }
    const isActive = attemptId === activeAttemptId;
    const isCompared = compareAttemptIds.includes(attemptId);
    row.classList.toggle("is-active", isActive);
    row.classList.toggle("is-compared", isCompared);
    if (isActive) {
      row.setAttribute("aria-current", "true");
    } else {
      row.removeAttribute("aria-current");
    }
    const checkbox = row.querySelector<HTMLInputElement>("input[type='checkbox']");
    if (checkbox && checkbox.checked !== isCompared) {
      checkbox.checked = isCompared;
    }
  }
  return true;
}
