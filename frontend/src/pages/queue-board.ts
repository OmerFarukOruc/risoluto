import { createKanbanCard, type KanbanCardHandle } from "../components/kanban-card";
import {
  createKanbanColumn,
  applyColumnStage,
  setDropAllowed,
  type KanbanColumnHandle,
} from "../components/kanban-column";
import type { RuntimeIssueView, WorkflowColumn } from "../types/runtime.js";
import { skeletonColumn } from "../ui/skeleton";
import { filterColumn, matchesStatusFilter, type QueueFilters, type QueueUiState } from "./queue-state";
import type { BoardTweaks } from "../state/tweaks";
import type { DragStateManager } from "./drag-state";

interface QueueBoardRendererOptions {
  board: HTMLElement;
  filters: QueueFilters;
  getUi: () => QueueUiState;
  getTweaks: () => BoardTweaks;
  getRouteId: () => string;
  requestRender: () => void;
  onOpenIssue: (issueId: string, fullPage: boolean) => void;
  onToggleColumnCollapse: (columnKey: string) => void;
  onFocusCard: (columnIndex: number, cardIndex: number) => void;
  onToggleSelect: (issueId: string, additive: boolean) => void;
  dragManager?: DragStateManager;
}

const ATTENTION_LANE_KEYS = new Set(["review", "in_review", "blocked", "retrying"]);
const LIVE_LANE_KEYS = new Set(["in_progress"]);
const TERMINAL_LANE_KEYS = new Set(["done", "completed", "closed", "cancelled", "canceled", "duplicate"]);

function makeMoveHandler(
  options: QueueBoardRendererOptions,
  issueId: string,
  columnKey: string,
  getCurrentColumns: () => WorkflowColumn[],
): (direction: -1 | 1) => void {
  return (direction: -1 | 1) => {
    options.dragManager!.moveByOffset(issueId, columnKey, direction, getCurrentColumns()).catch(() => {});
  };
}

function hasRunningIssue(issues: readonly RuntimeIssueView[]): boolean {
  return issues.some((issue) => issue.status?.toLowerCase() === "running");
}

export function createQueueBoardRenderer(options: QueueBoardRendererOptions): {
  renderLoading: () => void;
  render: (columns: WorkflowColumn[]) => void;
} {
  const columnHandles = new Map<string, KanbanColumnHandle>();
  const cardHandles = new Map<string, KanbanCardHandle>();
  let currentColumns: WorkflowColumn[] = [];

  if (options.dragManager) {
    options.board.addEventListener("kanban-drop", (event) => {
      const { identifier, targetColumnKey } = (event as CustomEvent<{ identifier: string; targetColumnKey: string }>)
        .detail;
      options.dragManager!.onDrop(identifier, targetColumnKey, currentColumns).catch(() => {});
    });

    options.board.addEventListener("dragstart", (event) => {
      const card = (event.target as HTMLElement).closest(".kanban-card");
      const sourceSection = card?.closest(".kanban-column") as HTMLElement | null;
      const sourceColumnKey = sourceSection?.dataset.stage ?? null;
      if (!sourceColumnKey) return;
      options.dragManager!.onDragStart((card as HTMLElement).dataset.issueId ?? "", sourceColumnKey, {
        sourceEl: card as HTMLElement,
        x: event.clientX,
        y: event.clientY,
      });
      // Update forbidden state on all column handles
      for (const [key, handle] of columnHandles) {
        setDropAllowed(handle, options.dragManager!.canDrop(sourceColumnKey, key));
      }
    });

    options.board.addEventListener("dragend", () => {
      options.dragManager!.onDragEnd();
      for (const handle of columnHandles.values()) {
        setDropAllowed(handle, true);
      }
    });
  }

  function renderLoading(): void {
    options.board.replaceChildren(
      ...Array.from({ length: 3 }, (_, index) => {
        const column = skeletonColumn();
        column.classList.add("stagger-item");
        column.style.setProperty("--stagger-index", String(index));
        return column;
      }),
    );
  }

  function getColumnHandle(key: string): KanbanColumnHandle {
    const existing = columnHandles.get(key);
    if (existing) return existing;
    const handle = createKanbanColumn(() => {
      options.onToggleColumnCollapse(key);
      options.requestRender();
    });
    columnHandles.set(key, handle);
    return handle;
  }

  function render(columns: WorkflowColumn[]): void {
    if (columns.length === 0) {
      renderLoading();
      return;
    }
    const tweaks = options.getTweaks();
    options.board.classList.toggle("is-compact", tweaks.density === "compact");
    options.board.classList.toggle("is-default", tweaks.density === "default");
    options.board.classList.toggle("is-comfortable", tweaks.density === "comfortable");
    options.board.classList.toggle("is-nolifecycle", !tweaks.showLifecycle);

    currentColumns = columns;
    const nextIssueIds = new Set<string>();
    const ui = options.getUi();
    const skipStatusFilter = tweaks.statusFilter === "all";
    const sections = columns.map((column, columnIndex) => {
      const filtered = filterColumn(column, options.filters);
      const list = skipStatusFilter
        ? filtered
        : filtered.filter((issue) => matchesStatusFilter(issue, tweaks.statusFilter));
      const handle = getColumnHandle(column.key);
      applyColumnStage(handle, column.key);
      handle.section.dataset.kind = column.kind;
      handle.section.dataset.headerStyle = tweaks.headerStyle;
      handle.section.dataset.hasRunning = String(hasRunningIssue(column.issues ?? []));
      handle.section.classList.toggle("is-collapsed", ui.collapsed.has(column.key));
      handle.section.classList.toggle("is-empty", list.length === 0 && !ui.collapsed.has(column.key));
      handle.section.classList.toggle("is-focused", ui.focusedColumn === columnIndex);
      handle.section.classList.toggle("is-gate", column.kind === "gate");
      handle.section.classList.toggle("is-attention-lane", ATTENTION_LANE_KEYS.has(column.key));
      handle.section.classList.toggle("is-live-lane", LIVE_LANE_KEYS.has(column.key));
      handle.section.classList.toggle("is-terminal-lane", TERMINAL_LANE_KEYS.has(column.key) || column.terminal);
      handle.section.style.setProperty("--stagger-index", String(columnIndex));
      handle.label.textContent = column.label;
      handle.count.textContent = String(list.length);
      // Show collapse toggle on all columns
      const collapsed = ui.collapsed.has(column.key);
      handle.toggle.hidden = false;
      handle.toggle.textContent = collapsed ? "Show lane" : "Hide lane";
      handle.toggle.title = `${collapsed ? "Show" : "Hide"} ${column.label} lane`;
      handle.toggle.setAttribute("aria-label", handle.toggle.title);
      handle.toggle.setAttribute("aria-expanded", String(!collapsed));

      if (list.length === 0) {
        handle.body.replaceChildren();
        return handle.section;
      }

      const cards = list.map((issue, cardIndex) => {
        nextIssueIds.add(issue.identifier);
        const existing = cardHandles.get(issue.identifier);
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
          onMove: options.dragManager
            ? makeMoveHandler(options, issue.identifier, column.key, () => currentColumns)
            : undefined,
          onFocus: () => {
            options.onFocusCard(columnIndex, cardIndex);
          },
          onToggleSelect: options.onToggleSelect,
        });
        card.element.classList.toggle("is-multi-select", ui.selected.has(issue.identifier));
        if (!existing) {
          cardHandles.set(issue.identifier, card);
        }
        card.element.style.setProperty("--stagger-index", String(cardIndex));
        return card.element;
      });
      handle.body.replaceChildren(...cards);
      return handle.section;
    });

    for (const [issueId] of cardHandles) {
      if (!nextIssueIds.has(issueId)) {
        cardHandles.delete(issueId);
      }
    }

    options.board.replaceChildren(...sections);
  }

  return { renderLoading, render };
}
