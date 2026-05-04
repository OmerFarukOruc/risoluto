import { createKanbanCard, type KanbanCardHandle } from "../components/kanban-card";
import { normalizeStageKey } from "../components/kanban-column";
import type { RuntimeIssueView, WorkflowColumn } from "../types/runtime.js";
import { skeletonColumn } from "../ui/skeleton";
import { filterColumn, matchesStatusFilter, repoOf, type QueueFilters, type QueueUiState } from "./queue-state";
import type { BoardTweaks } from "../state/tweaks";
import type { DragStateManager } from "./drag-state";

interface QueueSwimlaneRendererOptions {
  board: HTMLElement;
  filters: QueueFilters;
  getUi: () => QueueUiState;
  getTweaks: () => BoardTweaks;
  getRouteId: () => string;
  onOpenIssue: (issueId: string, fullPage: boolean) => void;
  onFocusCard: (columnIndex: number, cardIndex: number) => void;
  onToggleSelect: (issueId: string, additive: boolean) => void;
  onSeenReposChanged: (next: readonly string[]) => void;
  dragManager?: DragStateManager;
}

interface SwimlaneRendererHandle {
  renderLoading(): void;
  render(columns: WorkflowColumn[]): void;
}

const NO_REPO_KEY = "__no_repo__";
const NO_REPO_LABEL = "No repo";

function attachCellDropTarget(cell: HTMLElement, dragManager: DragStateManager): void {
  cell.addEventListener("dragover", (event) => {
    if (cell.dataset.dropAllowed === "false") {
      cell.classList.remove("is-drag-over");
      cell.classList.add("is-drop-reject");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
      return;
    }
    event.preventDefault();
    cell.classList.remove("is-drop-reject");
    cell.classList.add("is-drag-over");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });
  cell.addEventListener("dragenter", (event) => {
    if (cell.dataset.dropAllowed === "false") {
      cell.classList.add("is-drop-reject");
      return;
    }
    event.preventDefault();
    cell.classList.add("is-drag-over");
  });
  cell.addEventListener("dragleave", (event) => {
    if (!cell.contains(event.relatedTarget as Node)) {
      cell.classList.remove("is-drag-over", "is-drop-reject");
    }
  });
  cell.addEventListener("drop", (event) => {
    cell.classList.remove("is-drag-over", "is-drop-reject");
    if (cell.dataset.dropAllowed === "false") return;
    event.preventDefault();
    const identifier = event.dataTransfer?.getData("text/plain") ?? "";
    const targetColumnKey = cell.dataset.stage ?? "";
    if (!identifier || !targetColumnKey) return;
    dragManager.onDrop(identifier, targetColumnKey, []).catch(() => {});
  });
}

export function createQueueSwimlaneRenderer(options: QueueSwimlaneRendererOptions): SwimlaneRendererHandle {
  const cardHandles = new Map<string, KanbanCardHandle>();

  function renderLoading(): void {
    options.board.replaceChildren(
      ...Array.from({ length: 2 }, (_, index) => {
        const skeleton = skeletonColumn();
        skeleton.classList.add("queue-swimlane-skeleton", "stagger-item");
        skeleton.style.setProperty("--stagger-index", String(index));
        return skeleton;
      }),
    );
  }

  function render(columns: WorkflowColumn[]): void {
    if (columns.length === 0) {
      renderLoading();
      return;
    }
    const tweaks = options.getTweaks();
    const ui = options.getUi();
    const skipStatusFilter = tweaks.statusFilter === "all";
    const filteredColumns: { column: WorkflowColumn; issues: RuntimeIssueView[] }[] = columns.map((column) => {
      const filtered = filterColumn(column, options.filters);
      return {
        column,
        issues: skipStatusFilter
          ? filtered
          : filtered.filter((issue) => matchesStatusFilter(issue, tweaks.statusFilter)),
      };
    });

    const reposInSnapshot = new Set<string>();
    for (const { issues } of filteredColumns) {
      for (const issue of issues) {
        const repo = repoOf(issue);
        reposInSnapshot.add(repo ?? NO_REPO_KEY);
      }
    }
    const merged = new Set<string>([...tweaks.seenRepos, ...reposInSnapshot]);
    merged.delete(NO_REPO_KEY);
    const repoRows = [...merged].sort((left, right) => left.localeCompare(right));
    if (reposInSnapshot.has(NO_REPO_KEY)) {
      repoRows.push(NO_REPO_KEY);
    }

    const persistedSet = new Set(tweaks.seenRepos);
    const realRepos = [...reposInSnapshot].filter((value) => value !== NO_REPO_KEY);
    const newRepos = realRepos.filter((repo) => !persistedSet.has(repo));
    if (newRepos.length > 0) {
      const next = [...tweaks.seenRepos];
      for (const repo of newRepos) next.push(repo);
      options.onSeenReposChanged(next);
    }

    options.board.classList.toggle("is-compact", tweaks.density === "compact");
    options.board.classList.toggle("is-default", tweaks.density === "default");
    options.board.classList.toggle("is-comfortable", tweaks.density === "comfortable");
    options.board.classList.toggle("is-nolifecycle", !tweaks.showLifecycle);

    const grid = document.createElement("div");
    grid.className = "queue-swimlane-grid";
    grid.style.setProperty("--swimlane-status-count", String(filteredColumns.length));

    const headerRow = document.createElement("div");
    headerRow.className = "queue-swimlane-header-row";
    const corner = document.createElement("div");
    corner.className = "queue-swimlane-corner";
    headerRow.append(corner);
    for (const { column, issues } of filteredColumns) {
      const collapsed = ui.collapsed.has(column.key);
      const header = document.createElement("div");
      header.className = "queue-swimlane-status-header";
      header.dataset.stage = normalizeStageKey(column.key);
      header.dataset.headerStyle = tweaks.headerStyle;
      header.classList.toggle("is-collapsed", collapsed);
      const label = document.createElement("span");
      label.className = "queue-swimlane-status-label";
      label.textContent = column.label;
      const count = document.createElement("span");
      count.className = "queue-swimlane-status-count";
      count.textContent = String(issues.length);
      header.append(label, count);
      headerRow.append(header);
    }
    grid.append(headerRow);

    const nextIssueIds = new Set<string>();
    for (const [rowIndex, repoKey] of repoRows.entries()) {
      const row = document.createElement("div");
      row.className = "queue-swimlane-row";
      row.dataset.repo = repoKey;
      row.style.setProperty("--stagger-index", String(rowIndex));

      const rowLabel = document.createElement("div");
      rowLabel.className = "queue-swimlane-row-label";
      rowLabel.textContent = repoKey === NO_REPO_KEY ? NO_REPO_LABEL : repoKey;
      row.append(rowLabel);

      for (const [columnIndex, { column, issues }] of filteredColumns.entries()) {
        const cell = document.createElement("div");
        cell.className = "queue-swimlane-cell";
        cell.dataset.stage = normalizeStageKey(column.key);
        cell.dataset.repo = repoKey;
        cell.dataset.dropAllowed = "true";

        const cellIssues = issues.filter((issue) => (repoOf(issue) ?? NO_REPO_KEY) === repoKey);
        if (cellIssues.length === 0) {
          row.append(cell);
          continue;
        }
        for (const [cardIndex, issue] of cellIssues.entries()) {
          nextIssueIds.add(issue.identifier);
          const handleKey = `${repoKey}::${issue.identifier}`;
          const existing = cardHandles.get(handleKey);
          const card =
            existing ??
            createKanbanCard({
              issue,
              selected: false,
              focused: false,
              variant: tweaks.cardVariant,
              onOpen: () => undefined,
              onFullPage: () => undefined,
              onFocus: () => undefined,
              onToggleSelect: () => undefined,
            });
          card.update({
            issue,
            selected: options.getRouteId() === issue.identifier,
            focused: ui.focusedColumn === columnIndex && ui.focusedCard === cardIndex,
            variant: tweaks.cardVariant,
            onOpen: () => options.onOpenIssue(issue.identifier, false),
            onFullPage: () => options.onOpenIssue(issue.identifier, true),
            onFocus: () => options.onFocusCard(columnIndex, cardIndex),
            onToggleSelect: options.onToggleSelect,
          });
          card.element.classList.toggle("is-multi-select", ui.selected.has(issue.identifier));
          card.element.style.setProperty("--stagger-index", String(cardIndex));
          if (!existing) cardHandles.set(handleKey, card);
          cell.append(card.element);
        }
        if (options.dragManager) attachCellDropTarget(cell, options.dragManager);
        row.append(cell);
      }
      grid.append(row);
    }

    for (const handleKey of [...cardHandles.keys()]) {
      const identifier = handleKey.split("::")[1];
      if (!nextIssueIds.has(identifier)) cardHandles.delete(handleKey);
    }

    options.board.replaceChildren(grid);
  }

  return { renderLoading, render };
}
