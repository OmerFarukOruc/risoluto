import { createEmptyState } from "../components/empty-state";
import { createIssueInspector } from "../components/issue-inspector.js";
import { router } from "../router.js";
import { registerPageCleanup } from "../utils/page.js";
import { createQueueWorkbench } from "../features/queue/queue-workbench.js";
import { createQueueBoardRenderer } from "./queue-board.js";
import { createQueueSwimlaneRenderer } from "./queue-swimlane.js";
import { createQueueListRenderer } from "./queue-list.js";
import { createQueueFocusRenderer } from "./queue-focus.js";
import { createDragStateManager, type DragStateManager } from "./drag-state.js";
import { buildQueueToolbar } from "./queue-toolbar.js";
import { createTweaksPanel } from "./queue-tweaks.js";
import { createBulkToolbar } from "./queue-bulk-toolbar.js";
import { type BoardTweaks, type BoardViewMode, loadTweaks, saveTweaks } from "../state/tweaks";
import { getRuntimeClient } from "../state/runtime-client.js";
import { filterColumn, matchesStatusFilter } from "./queue-state.js";

const DEFAULT_NEW_ISSUE_URL = "https://linear.app/";

interface BoardRenderer {
  renderLoading(): void;
  render(columns: import("../types/runtime.js").WorkflowColumn[]): void;
}

export function createQueuePage(params?: Record<string, string>): HTMLElement {
  const dragManager: DragStateManager = createDragStateManager();
  let getColumns: () => readonly import("../types/runtime.js").WorkflowColumn[] = () => [];
  let tweaks: BoardTweaks = loadTweaks();
  const workbench = createQueueWorkbench({
    routeId: params?.id,
    initialCollapsedColumns: tweaks.collapsedColumns,
    deps: {
      onBulkMove: (targetColumnKey, identifiers) => {
        void Promise.all(identifiers.map((id) => dragManager.onDrop(id, targetColumnKey, [...getColumns()])));
      },
    },
  });
  const { state } = workbench;
  getColumns = () => state.columns;
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
  let activeRenderer: BoardRenderer | null = null;

  function applyTweaks(patch: Partial<BoardTweaks>): void {
    tweaks = saveTweaks(patch);
    render();
  }

  function persistCollapsed(): void {
    const list = [...state.ui.collapsed].filter((value) => typeof value === "string");
    if (list.length === tweaks.collapsedColumns.length && list.every((key) => tweaks.collapsedColumns.includes(key))) {
      return;
    }
    applyTweaks({ collapsedColumns: list });
  }

  const kanbanRenderer = createQueueBoardRenderer({
    board,
    filters: state.filters,
    getUi: () => state.ui,
    getTweaks: () => tweaks,
    getRouteId: () => state.routeId,
    requestRender: renderBoard,
    onOpenIssue: (issueId, fullPage) => workbench.openIssue(issueId, fullPage),
    onToggleColumnCollapse: (columnKey) => {
      workbench.toggleColumnCollapse(columnKey);
      persistCollapsed();
    },
    onFocusCard: (columnIndex, cardIndex) => workbench.focusCard(columnIndex, cardIndex),
    onToggleSelect: (issueId, additive) => workbench.toggleSelect(issueId, additive),
    dragManager,
  });

  const swimlaneRenderer = createQueueSwimlaneRenderer({
    board,
    filters: state.filters,
    getUi: () => state.ui,
    getTweaks: () => tweaks,
    getRouteId: () => state.routeId,
    onOpenIssue: (issueId, fullPage) => workbench.openIssue(issueId, fullPage),
    onFocusCard: (columnIndex, cardIndex) => workbench.focusCard(columnIndex, cardIndex),
    onToggleSelect: (issueId, additive) => workbench.toggleSelect(issueId, additive),
    onSeenReposChanged: (next) => applyTweaks({ seenRepos: [...next] }),
    dragManager,
  });

  const listRenderer = createQueueListRenderer({
    board,
    filters: state.filters,
    getUi: () => state.ui,
    getTweaks: () => tweaks,
    getRouteId: () => state.routeId,
    onOpenIssue: (issueId, fullPage) => workbench.openIssue(issueId, fullPage),
  });

  const focusRenderer = createQueueFocusRenderer({
    board,
    getRouteId: () => state.routeId,
    onOpenIssue: (issueId, fullPage) => workbench.openIssue(issueId, fullPage),
    getRecentEvents: () => state.recentEvents,
    onSetStatusFilter: (filter) => applyTweaks({ statusFilter: filter }),
  });

  function pickRenderer(mode: BoardViewMode): BoardRenderer {
    switch (mode) {
      case "swimlane":
        return swimlaneRenderer;
      case "list":
        return listRenderer;
      case "focus":
        return focusRenderer;
      default:
        return kanbanRenderer;
    }
  }

  function setActiveMode(mode: BoardViewMode): void {
    const next = pickRenderer(mode);
    if (next === activeRenderer) return;
    activeRenderer = next;
    board.dataset.viewMode = mode;
    boardWrap.dataset.viewMode = mode;
    board.replaceChildren();
  }

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
    const skipStatusFilter = tweaks.statusFilter === "all";
    let count = 0;
    for (const column of state.columns) {
      const filtered = filterColumn(column, state.filters);
      count += skipStatusFilter
        ? filtered.length
        : filtered.filter((issue) => matchesStatusFilter(issue, tweaks.statusFilter)).length;
    }
    return count;
  }

  function renderToolbar(force = false): void {
    const nextToolbarKey = `${workbench.getToolbarKey()}|${tweaks.viewMode}|${tweaks.statusFilter}|${tweaks.cardVariant}`;
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
      onSetViewMode: (mode) => applyTweaks({ viewMode: mode }),
      onSetStatusFilter: (filter) => applyTweaks({ statusFilter: filter }),
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

  function snapshotIsTotallyEmpty(): boolean {
    if (!state.hasSnapshot) return false;
    for (const column of state.columns) {
      if ((column.issues ?? []).length > 0) return false;
    }
    return true;
  }

  function renderWholeBoardEmpty(): void {
    boardWrap.classList.add("is-board-empty");
    board.replaceChildren(
      createEmptyState(
        "No issues yet",
        "Connect a tracker to start syncing work to the board.",
        "Open settings",
        () => router.navigate("/settings"),
        "queue",
        { headingLevel: "h2", actionVariant: "primary" },
      ),
    );
  }

  function renderBoard(): void {
    if (!state.hasSnapshot) {
      setActiveMode(tweaks.viewMode);
      activeRenderer?.renderLoading();
      return;
    }
    if (snapshotIsTotallyEmpty()) {
      renderWholeBoardEmpty();
      return;
    }
    boardWrap.classList.remove("is-board-empty");
    setActiveMode(tweaks.viewMode);
    activeRenderer?.render(state.columns);
  }

  function render(): void {
    tweaksHandle.refreshForMode(tweaks.viewMode);
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
