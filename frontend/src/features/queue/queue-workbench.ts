import { api } from "../../api.js";
import { router, type RouterNavigateDetail } from "../../router.js";
import { getRuntimeClient, type RuntimeClient } from "../../state/runtime-client.js";
import type { AppState } from "../../state/store.js";
import type { RecentEvent, RuntimeIssueView, WorkflowColumn } from "../../types/runtime.js";
import { repoOf } from "../../utils/issues.js";
import { handleQueueKeyboard } from "../../pages/queue-keyboard.js";
import { createFilters, createUiState, type QueueFilters, type QueueUiState } from "../../pages/queue-state.js";

type QueueApi = Pick<typeof api, "postRefresh">;
type QueueRouter = Pick<typeof router, "navigate" | "subscribe">;
type QueueRuntimeClient = Pick<RuntimeClient, "getAppState" | "subscribeState">;

interface QueueWorkbenchDeps {
  api: QueueApi;
  router: QueueRouter;
  runtimeClient: QueueRuntimeClient;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
  onBulkMove?: (targetColumnKey: string, identifiers: readonly string[]) => void;
}

export interface QueueWorkbenchState {
  filters: QueueFilters;
  ui: QueueUiState;
  routeId: string;
  columns: WorkflowColumn[];
  recentEvents: RecentEvent[];
  hasSnapshot: boolean;
}

interface CreateQueueWorkbenchOptions {
  routeId?: string;
  state?: QueueWorkbenchState;
  deps?: Partial<QueueWorkbenchDeps>;
  initialCollapsedColumns?: readonly string[];
}

interface QueueKeyboardBindings {
  search: HTMLInputElement;
  filterButton?: HTMLButtonElement;
}

export interface QueueWorkbench {
  readonly state: QueueWorkbenchState;
  subscribe(listener: () => void): () => void;
  initialize(): void;
  dispose(): void;
  refresh(): Promise<void>;
  clearFilters(): void;
  setSearchText(value: string): void;
  setPriority(priority: string): void;
  setModel(model: string): void;
  setRepo(repo: string): void;
  toggleLabel(label: string): void;
  toggleSelect(issueId: string, additive: boolean): void;
  clearSelection(): void;
  bulkMove(targetColumnKey: string): void;
  focusCard(columnIndex: number, cardIndex: number): void;
  toggleColumnCollapse(columnKey: string): void;
  openIssue(issueId: string, fullPage?: boolean): void;
  handleKeyboard(event: KeyboardEvent, bindings: QueueKeyboardBindings): void;
  getToolbarKey(): string;
}

function issueFingerprint(issue: RuntimeIssueView): string {
  return [
    issue.identifier,
    issue.status,
    String(issue.priority),
    issue.model ?? "",
    issue.workspaceKey ?? "",
    repoOf(issue) ?? "",
    [...(issue.labels ?? [])].sort().join(","),
  ].join(":");
}

function getColumnsFingerprint(columns: WorkflowColumn[]): string {
  return columns
    .map((column) => `${column.key}:${column.count ?? 0}:${(column.issues ?? []).map(issueFingerprint).join(",")}`)
    .join("|");
}

function getAvailableRepos(columns: WorkflowColumn[]): Set<string> {
  const repos = new Set<string>();
  for (const column of columns) {
    for (const issue of column.issues ?? []) {
      const repo = repoOf(issue);
      if (repo) repos.add(repo);
    }
  }
  return repos;
}

function preserveSelected(next: QueueUiState, previous: QueueUiState, columns: WorkflowColumn[]): void {
  const currentIssueIds = new Set(columns.flatMap((column) => (column.issues ?? []).map((issue) => issue.identifier)));
  for (const issueId of previous.selected) {
    if (currentIssueIds.has(issueId)) {
      next.selected.add(issueId);
    }
  }
}

function createQueueWorkbenchState(routeId = ""): QueueWorkbenchState {
  return {
    filters: createFilters(),
    ui: createUiState([]),
    routeId,
    columns: [],
    recentEvents: [],
    hasSnapshot: false,
  };
}

export function createQueueWorkbench(options: CreateQueueWorkbenchOptions = {}): QueueWorkbench {
  const state = options.state ?? createQueueWorkbenchState(options.routeId ?? "");
  if (options.initialCollapsedColumns) {
    for (const key of options.initialCollapsedColumns) state.ui.collapsed.add(key);
  }
  const deps: QueueWorkbenchDeps = {
    api,
    router,
    runtimeClient: getRuntimeClient(),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    ...options.deps,
  };
  const listeners = new Set<() => void>();
  let unsubscribeNavigation: (() => void) | null = null;
  let unsubscribeState: (() => void) | null = null;
  let refreshLocked = false;
  let refreshResetTimer: ReturnType<typeof setTimeout> | null = null;

  const emitChange = (): void => {
    listeners.forEach((listener) => listener());
  };

  const syncState = (appState: AppState): void => {
    const columns = appState.snapshot?.workflow_columns ?? [];
    state.columns = columns;
    state.recentEvents = appState.snapshot?.recent_events ?? [];
    state.hasSnapshot = Boolean(appState.snapshot);
    if (state.ui.collapsed.size === 0 && columns.length > 0) {
      const nextUi = createUiState(columns);
      preserveSelected(nextUi, state.ui, columns);
      state.ui = nextUi;
    }
    if (state.filters.repo !== "all" && !getAvailableRepos(columns).has(state.filters.repo)) {
      state.filters.repo = "all";
    }
    emitChange();
  };

  const setRoute = (routeId = ""): void => {
    if (state.routeId === routeId) {
      return;
    }
    state.routeId = routeId;
    emitChange();
  };

  const workbench: QueueWorkbench = {
    state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    initialize(): void {
      if (!unsubscribeNavigation) {
        unsubscribeNavigation = deps.router.subscribe((detail: RouterNavigateDetail) => {
          setRoute(detail.path.startsWith("/queue/") ? (detail.params.id ?? "") : "");
        });
      }
      if (!unsubscribeState) {
        unsubscribeState = deps.runtimeClient.subscribeState(syncState);
      }
      syncState(deps.runtimeClient.getAppState());
    },
    dispose(): void {
      unsubscribeNavigation?.();
      unsubscribeState?.();
      unsubscribeNavigation = null;
      unsubscribeState = null;
      if (refreshResetTimer !== null) {
        deps.clearTimeout(refreshResetTimer);
        refreshResetTimer = null;
      }
      refreshLocked = false;
    },
    async refresh(): Promise<void> {
      if (refreshLocked) {
        return;
      }
      refreshLocked = true;
      try {
        await deps.api.postRefresh();
      } finally {
        refreshResetTimer = deps.setTimeout(() => {
          refreshLocked = false;
          refreshResetTimer = null;
        }, 3_000);
      }
    },
    clearFilters(): void {
      state.filters.search = "";
      state.filters.priority = "all";
      state.filters.model = "all";
      state.filters.repo = "all";
      state.filters.labels.clear();
      emitChange();
    },
    setSearchText(value: string): void {
      if (state.filters.search === value) return;
      state.filters.search = value;
      emitChange();
    },
    setPriority(priority: string): void {
      if (state.filters.priority === priority) return;
      state.filters.priority = priority;
      emitChange();
    },
    setModel(model: string): void {
      if (state.filters.model === model) return;
      state.filters.model = model;
      emitChange();
    },
    setRepo(repo: string): void {
      if (state.filters.repo === repo) return;
      state.filters.repo = repo;
      emitChange();
    },
    toggleLabel(label: string): void {
      if (state.filters.labels.has(label)) {
        state.filters.labels.delete(label);
      } else {
        state.filters.labels.add(label);
      }
      emitChange();
    },
    toggleSelect(issueId: string, additive: boolean): void {
      if (!issueId) return;
      if (!additive) {
        const onlyThis = state.ui.selected.size === 1 && state.ui.selected.has(issueId);
        state.ui.selected.clear();
        if (!onlyThis) state.ui.selected.add(issueId);
        emitChange();
        return;
      }
      if (state.ui.selected.has(issueId)) {
        state.ui.selected.delete(issueId);
      } else {
        state.ui.selected.add(issueId);
      }
      emitChange();
    },
    clearSelection(): void {
      if (state.ui.selected.size === 0) return;
      state.ui.selected.clear();
      emitChange();
    },
    bulkMove(targetColumnKey: string): void {
      const identifiers = [...state.ui.selected];
      if (identifiers.length === 0 || !targetColumnKey) return;
      deps.onBulkMove?.(targetColumnKey, identifiers);
      state.ui.selected.clear();
      emitChange();
    },
    focusCard(columnIndex: number, cardIndex: number): void {
      state.ui.focusedColumn = columnIndex;
      state.ui.focusedCard = cardIndex;
    },
    toggleColumnCollapse(columnKey: string): void {
      if (state.ui.collapsed.has(columnKey)) {
        state.ui.collapsed.delete(columnKey);
        return;
      }
      state.ui.collapsed.add(columnKey);
    },
    openIssue(issueId: string, fullPage = false): void {
      deps.router.navigate(fullPage ? `/issues/${issueId}` : `/queue/${issueId}`);
    },
    handleKeyboard(event: KeyboardEvent, bindings: QueueKeyboardBindings): void {
      handleQueueKeyboard(event, {
        columns: state.columns,
        filters: state.filters,
        ui: state.ui,
        search: bindings.search,
        filterButton: bindings.filterButton,
        onSelect: (issueId, fullPage) => {
          workbench.openIssue(issueId, fullPage);
        },
        onClose: () => {
          if (state.routeId) {
            deps.router.navigate("/queue");
          }
        },
        onClearFilters: () => {
          workbench.clearFilters();
        },
        onRender: emitChange,
      });
    },
    getToolbarKey(): string {
      return JSON.stringify({
        columns: getColumnsFingerprint(state.columns),
        priority: state.filters.priority,
        model: state.filters.model,
        repo: state.filters.repo,
        labels: [...state.filters.labels].sort(),
      });
    },
  };

  return workbench;
}
