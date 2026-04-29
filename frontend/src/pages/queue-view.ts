import { createIssueInspector } from "../components/issue-inspector.js";
import { router } from "../router.js";
import { registerPageCleanup } from "../utils/page.js";
import { createQueueWorkbench } from "../features/queue/queue-workbench.js";
import { createQueueBoardRenderer } from "./queue-board.js";
import { createDragStateManager, type DragStateManager } from "./drag-state.js";
import { buildQueueToolbar } from "./queue-toolbar.js";
import { createTweaksPanel } from "./queue-tweaks.js";
import { createBulkToolbar } from "./queue-bulk-toolbar.js";
import { type BoardTweaks, loadTweaks, saveTweaks } from "../state/tweaks";
import { getRuntimeClient } from "../state/runtime-client.js";
import { filterColumn } from "./queue-state.js";

const DEFAULT_NEW_ISSUE_URL = "https://linear.app/";

export function createQueuePage(params?: Record<string, string>): HTMLElement {
  const dragManager: DragStateManager = createDragStateManager();
  // The workbench's `onBulkMove` callback needs `state.columns`, but `state`
  // is destructured from `workbench` *after* construction. Indirect through
  // a getter so the closure resolves at call time, not at construction.
  let getColumns: () => readonly import("../types/runtime.js").WorkflowColumn[] = () => [];
  const workbench = createQueueWorkbench({
    routeId: params?.id,
    deps: {
      onBulkMove: (targetColumnKey, identifiers) => {
        void Promise.all(identifiers.map((id) => dragManager.onDrop(id, targetColumnKey, [...getColumns()])));
      },
    },
  });
  const { state } = workbench;
  getColumns = () => state.columns;
  let tweaks: BoardTweaks = loadTweaks();
  const page = document.createElement("div");
  page.className = "page queue-page fade-in";
  const mainPane = document.createElement("div");
  mainPane.className = "queue-main-pane";
  const toolbar = document.createElement("section");
  toolbar.className = "mc-toolbar queue-toolbar";
  toolbar.setAttribute("aria-label", "Queue filters");
  const layout = document.createElement("section");
  layout.className = "queue-layout";
  const boardWrap = document.createElement("div");
  boardWrap.className = "kanban-board-wrap";
  const board = document.createElement("div");
  board.className = "kanban-board";
  const inspector = createIssueInspector({
    mode: "drawer",
    initialId: params?.id,
    onClose: () => router.navigate("/queue"),
  });
  const pageHeading = document.createElement("h1");
  pageHeading.className = "sr-only";
  pageHeading.textContent = "Board";

  boardWrap.append(board);
  mainPane.append(toolbar, boardWrap);
  layout.append(mainPane, inspector.element);
  page.append(pageHeading, layout);

  let searchInput: HTMLInputElement = document.createElement("input");
  let filterButton: HTMLButtonElement | null = null;
  let lastToolbarKey = "";
  let lastToolbarSearch = state.filters.search;
  let lastInspectorId = "";

  function applyTweaks(patch: Partial<BoardTweaks>): void {
    tweaks = saveTweaks(patch);
    render();
  }

  const boardRenderer = createQueueBoardRenderer({
    board,
    filters: state.filters,
    getUi: () => state.ui,
    getTweaks: () => tweaks,
    getRouteId: () => state.routeId,
    clearFilters: () => workbench.clearFilters(),
    requestRender: renderBoard,
    onOpenIssue: (issueId, fullPage) => workbench.openIssue(issueId, fullPage),
    onToggleColumnCollapse: (columnKey) => workbench.toggleColumnCollapse(columnKey),
    onFocusCard: (columnIndex, cardIndex) => workbench.focusCard(columnIndex, cardIndex),
    onToggleSelect: (issueId, additive) => workbench.toggleSelect(issueId, additive),
    dragManager,
  });

  const tweaksHandle = createTweaksPanel({
    getTweaks: () => tweaks,
    setTweaks: (patch) => applyTweaks(patch),
  });
  page.append(tweaksHandle.panel, tweaksHandle.fab);

  const bulkHandle = createBulkToolbar({
    getColumns: () => state.columns,
    getSelectedCount: () => state.ui.selected.size,
    onBulkMove: (target) => workbench.bulkMove(target),
    onClear: () => workbench.clearSelection(),
  });
  page.append(bulkHandle.element);

  function getRunningCount(): number {
    const snapshot = getRuntimeClient().getAppState().snapshot;
    return snapshot?.counts?.running ?? 0;
  }

  function getFilteredCount(): number {
    let count = 0;
    for (const column of state.columns) {
      count += filterColumn(column, state.filters).length;
    }
    return count;
  }

  function renderToolbar(force = false): void {
    const nextToolbarKey = `${workbench.getToolbarKey()}|${tweaks.groupBy}|${tweaks.cardVariant}`;
    const nextSearch = state.filters.search;
    const searchIsFocused = document.activeElement === searchInput;
    const shouldRebuild =
      force || nextToolbarKey !== lastToolbarKey || (!searchIsFocused && nextSearch !== lastToolbarSearch);
    if (!shouldRebuild) {
      lastToolbarKey = nextToolbarKey;
      lastToolbarSearch = nextSearch;
      return;
    }
    lastToolbarKey = nextToolbarKey;
    lastToolbarSearch = nextSearch;
    const built = buildQueueToolbar({
      toolbar,
      filters: state.filters,
      tweaks,
      columns: state.columns,
      runningCount: getRunningCount(),
      filteredCount: getFilteredCount(),
      newIssueUrl: DEFAULT_NEW_ISSUE_URL,
      onSearchChange: (value) => workbench.setSearchText(value),
      onSetPriority: (priority) => workbench.setPriority(priority),
      onSetModel: (model) => workbench.setModel(model),
      onSetRepo: (repo) => workbench.setRepo(repo),
      onToggleLabel: (label) => workbench.toggleLabel(label),
      onClearFilters: () => workbench.clearFilters(),
      onSetGroupBy: (groupBy) => applyTweaks({ groupBy }),
    });
    searchInput = built.search;
    filterButton = built.firstStageChip();
  }

  function syncInspector(): void {
    const open = Boolean(state.routeId);
    inspector.element.hidden = !open;
    layout.classList.toggle("has-panel", open);
    if (open && state.routeId !== lastInspectorId) {
      inspector.load(state.routeId).catch(() => {});
    }
    lastInspectorId = state.routeId;
  }

  function renderBoard(): void {
    if (!state.hasSnapshot) {
      boardRenderer.renderLoading();
      return;
    }
    boardRenderer.render(state.columns);
  }

  function render(): void {
    renderToolbar();
    renderBoard();
    syncInspector();
    bulkHandle.sync();
  }

  function onKey(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchInput.focus();
      return;
    }
    workbench.handleKeyboard(event, {
      search: searchInput,
      filterButton: filterButton ?? undefined,
    });
  }

  const unsubscribe = workbench.subscribe(render);
  globalThis.addEventListener("keydown", onKey);
  workbench.initialize();
  renderToolbar(true);
  render();
  registerPageCleanup(page, () => {
    inspector.destroy();
    unsubscribe();
    workbench.dispose();
    globalThis.removeEventListener("keydown", onKey);
    tweaksHandle.destroy();
  });
  return page;
}
