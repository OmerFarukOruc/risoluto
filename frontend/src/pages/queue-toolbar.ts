import type { RuntimeIssueView, WorkflowColumn } from "../types/runtime.js";
import { type QueueFilters, repoOf, uniqueIssues } from "./queue-state";
import type { BoardStatusFilter, BoardTweaks, BoardViewMode } from "../state/tweaks";
import { createIcon, type IconName } from "../ui/icons";

interface QueueToolbarOptions {
  toolbar: HTMLElement;
  filters: QueueFilters;
  tweaks: BoardTweaks;
  columns: WorkflowColumn[];
  runningCount: number;
  filteredCount: number;
  newIssueUrl?: string | null;
  onSearchChange: (value: string) => void;
  onSetPriority: (priority: string) => void;
  onSetModel: (model: string) => void;
  onSetRepo: (repo: string) => void;
  onToggleLabel: (label: string) => void;
  onClearFilters: () => void;
  onSetViewMode: (mode: BoardViewMode) => void;
  onSetStatusFilter: (filter: BoardStatusFilter) => void;
}

interface BuiltToolbar {
  search: HTMLInputElement;
  firstStageChip: () => HTMLButtonElement | null;
}

const PRIORITY_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["all", "All priorities"],
  ["urgent", "Urgent"],
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
];

const VIEW_MODES: ReadonlyArray<{ value: BoardViewMode; label: string; icon: IconName }> = [
  { value: "kanban", label: "Kanban board", icon: "viewKanban" },
  { value: "swimlane", label: "Swimlane (status × repo)", icon: "viewSwimlane" },
  { value: "list", label: "List", icon: "viewList" },
  { value: "focus", label: "Focus on running", icon: "viewFocus" },
];

const STATUS_PILLS: ReadonlyArray<{ value: BoardStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "claimed", label: "Claimed" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

function uniqueValues<T>(
  items: readonly RuntimeIssueView[],
  extract: (issue: RuntimeIssueView) => T | T[] | null | undefined,
): T[] {
  const set = new Set<T>();
  for (const issue of items) {
    const value = extract(issue);
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) set.add(entry);
    } else {
      set.add(value);
    }
  }
  return [...set].sort((left, right) => String(left).localeCompare(String(right)));
}

function popoverButton(label: string, active: boolean, onOpen: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mc-button is-ghost is-sm";
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-pressed", String(active));
  button.classList.toggle("is-active", active);
  const labelEl = document.createElement("span");
  labelEl.textContent = `${label} ▾`;
  button.append(labelEl);
  button.addEventListener("click", () => onOpen());
  return button;
}

function dismissPopover(node: HTMLElement | null): void {
  if (!node) return;
  node.remove();
}

function openPopover(
  anchor: HTMLElement,
  items: ReadonlyArray<{ label: string; active: boolean; onSelect: () => void }>,
): HTMLElement {
  const existing = document.querySelector<HTMLElement>(".mc-popover");
  dismissPopover(existing);
  const popover = document.createElement("div");
  popover.className = "mc-popover";
  popover.setAttribute("role", "menu");
  for (const item of items) {
    const entry = document.createElement("button");
    entry.type = "button";
    entry.className = "mc-popover-item";
    entry.classList.toggle("is-active", item.active);
    entry.setAttribute("role", "menuitemradio");
    entry.setAttribute("aria-checked", String(item.active));
    const tick = document.createElement("span");
    tick.className = "mc-popover-item-tick";
    tick.textContent = item.active ? "✓" : "";
    const text = document.createElement("span");
    text.textContent = item.label;
    entry.append(tick, text);
    entry.addEventListener("click", (event) => {
      event.stopPropagation();
      item.onSelect();
      dismissPopover(popover);
    });
    popover.append(entry);
  }
  document.body.append(popover);
  const rect = anchor.getBoundingClientRect();
  popover.style.left = `${rect.left}px`;
  popover.style.top = `${rect.bottom + 4}px`;
  const closeOutside = (event: MouseEvent): void => {
    if (popover.contains(event.target as Node) || anchor.contains(event.target as Node)) return;
    dismissPopover(popover);
    document.removeEventListener("mousedown", closeOutside);
    document.removeEventListener("keydown", closeOnEsc);
  };
  const closeOnEsc = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      dismissPopover(popover);
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEsc);
    }
  };
  document.addEventListener("mousedown", closeOutside);
  document.addEventListener("keydown", closeOnEsc);
  return popover;
}

function buildFilterChips(
  filters: QueueFilters,
  onClear: (token: { kind: "priority" | "model" | "repo" | "label"; value: string }) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "queue-toolbar-filterchips";
  const tokens: { kind: "priority" | "model" | "repo" | "label"; value: string; label: string }[] = [];
  if (filters.priority !== "all") {
    tokens.push({ kind: "priority", value: filters.priority, label: `priority: ${filters.priority}` });
  }
  if (filters.model !== "all") {
    tokens.push({ kind: "model", value: filters.model, label: `model: ${filters.model}` });
  }
  if (filters.repo !== "all") {
    tokens.push({ kind: "repo", value: filters.repo, label: `repo: ${filters.repo}` });
  }
  for (const label of filters.labels) {
    tokens.push({ kind: "label", value: label, label: `#${label}` });
  }
  for (const token of tokens) {
    const chip = document.createElement("span");
    chip.className = "mc-filter-chip";
    const text = document.createElement("span");
    text.textContent = token.label;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "mc-filter-chip-clear";
    close.setAttribute("aria-label", `Clear ${token.label}`);
    close.textContent = "✕";
    close.addEventListener("click", () => onClear({ kind: token.kind, value: token.value }));
    chip.append(text, close);
    wrap.append(chip);
  }
  return wrap;
}

function buildViewModeSegmented(current: BoardViewMode, onSelect: (mode: BoardViewMode) => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "mc-viewmode-seg";
  wrap.setAttribute("role", "tablist");
  wrap.setAttribute("aria-label", "Board view mode");
  for (const option of VIEW_MODES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mc-viewmode-seg-btn";
    button.dataset.mode = option.value;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(option.value === current));
    button.setAttribute("aria-label", option.label);
    button.title = option.label;
    button.classList.toggle("is-active", option.value === current);
    button.append(createIcon(option.icon, { size: 16 }));
    button.addEventListener("click", () => onSelect(option.value));
    wrap.append(button);
  }
  return wrap;
}

function buildStatusPills(current: BoardStatusFilter, onSelect: (filter: BoardStatusFilter) => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "mc-status-pills";
  wrap.setAttribute("role", "tablist");
  wrap.setAttribute("aria-label", "Status filter");
  for (const pill of STATUS_PILLS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mc-status-pill";
    button.dataset.value = pill.value;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(pill.value === current));
    button.classList.toggle("is-active", pill.value === current);
    button.textContent = pill.label;
    button.addEventListener("click", () => onSelect(pill.value));
    wrap.append(button);
  }
  return wrap;
}

export function buildQueueToolbar(options: QueueToolbarOptions): BuiltToolbar {
  const {
    toolbar,
    filters,
    tweaks,
    columns,
    runningCount,
    filteredCount,
    newIssueUrl,
    onSearchChange,
    onSetPriority,
    onSetModel,
    onSetRepo,
    onToggleLabel,
    onClearFilters,
    onSetViewMode,
    onSetStatusFilter,
  } = options;
  toolbar.replaceChildren();

  const allIssues = uniqueIssues(columns);
  const models = uniqueValues(allIssues, (issue) => issue.model);
  const repos = uniqueValues(allIssues, (issue) => repoOf(issue));
  const labels = uniqueValues(allIssues, (issue) => issue.labels ?? []);

  const viewModeSeg = buildViewModeSegmented(tweaks.viewMode, onSetViewMode);

  const titleBlock = document.createElement("div");
  titleBlock.className = "queue-toolbar-title";
  const titleMain = document.createElement("span");
  titleMain.className = "queue-toolbar-title-primary";
  titleMain.textContent = "Board";
  const titleMeta = document.createElement("span");
  titleMeta.className = "queue-toolbar-title-meta";
  titleMeta.textContent = `${filteredCount} ${filteredCount === 1 ? "issue" : "issues"} · ${runningCount} running`;
  titleBlock.append(titleMain, titleMeta);

  const search = Object.assign(document.createElement("input"), {
    className: "mc-input",
    placeholder: "Search issues, labels, descriptions…",
  });
  search.setAttribute("aria-label", "Search issues");
  search.value = filters.search;

  const searchHint = document.createElement("kbd");
  searchHint.className = "mc-button-hint queue-search-hint";
  searchHint.textContent = "⌘K";
  searchHint.title = "Press ⌘K or / to focus search";
  searchHint.setAttribute("aria-hidden", "true");

  const searchWrap = document.createElement("div");
  searchWrap.className = "queue-toolbar-search";
  searchWrap.append(search, searchHint);
  search.addEventListener("input", () => onSearchChange(search.value));

  const filtersGroup = document.createElement("div");
  filtersGroup.className = "queue-toolbar-filters";

  const priorityBtn = popoverButton(
    `Priority${filters.priority !== "all" ? `: ${filters.priority}` : ""}`,
    filters.priority !== "all",
    () => {
      openPopover(
        priorityBtn,
        PRIORITY_OPTIONS.map(([value, label]) => ({
          label,
          active: filters.priority === value,
          onSelect: () => onSetPriority(value),
        })),
      );
    },
  );

  const modelBtn = popoverButton(
    `Model${filters.model !== "all" ? `: ${filters.model}` : ""}`,
    filters.model !== "all",
    () => {
      const items = [
        { label: "All models", active: filters.model === "all", onSelect: () => onSetModel("all") },
        ...models.map((model) => ({
          label: model,
          active: filters.model === model,
          onSelect: () => onSetModel(model),
        })),
      ];
      openPopover(modelBtn, items);
    },
  );

  const repoBtn =
    repos.length > 0 || filters.repo !== "all"
      ? popoverButton(`Repo${filters.repo !== "all" ? `: ${filters.repo}` : ""}`, filters.repo !== "all", () => {
          const items = [
            { label: "All repos", active: filters.repo === "all", onSelect: () => onSetRepo("all") },
            ...repos.map((repo) => ({
              label: repo,
              active: filters.repo === repo,
              onSelect: () => onSetRepo(repo),
            })),
          ];
          // The ternary above guarantees repoBtn is the very button this
          // closure was attached to — non-null at call time.
          openPopover(repoBtn as HTMLButtonElement, items);
        })
      : null;

  const labelsBtn = popoverButton(
    `Labels${filters.labels.size > 0 ? ` (${filters.labels.size})` : ""}`,
    filters.labels.size > 0,
    () => {
      const items = labels.map((label) => ({
        label: `#${label}`,
        active: filters.labels.has(label),
        onSelect: () => onToggleLabel(label),
      }));
      if (items.length === 0) {
        items.push({ label: "No labels in snapshot", active: false, onSelect: () => undefined });
      }
      openPopover(labelsBtn, items);
    },
  );

  filtersGroup.append(priorityBtn, modelBtn);
  if (repoBtn) {
    filtersGroup.append(repoBtn);
  }
  filtersGroup.append(labelsBtn);

  const chipsWrap = buildFilterChips(filters, ({ kind, value }) => {
    if (kind === "priority") onSetPriority("all");
    else if (kind === "model") onSetModel("all");
    else if (kind === "repo") onSetRepo("all");
    else if (kind === "label") onToggleLabel(value);
  });
  if (chipsWrap.children.length > 0) {
    const clearAll = document.createElement("button");
    clearAll.type = "button";
    clearAll.className = "mc-button is-ghost is-sm";
    clearAll.textContent = "Clear";
    clearAll.addEventListener("click", () => onClearFilters());
    chipsWrap.append(clearAll);
  }

  const utility = document.createElement("div");
  utility.className = "queue-toolbar-utility";

  const statusPills = tweaks.viewMode === "focus" ? null : buildStatusPills(tweaks.statusFilter, onSetStatusFilter);

  if (newIssueUrl) {
    const newIssue = document.createElement("a");
    newIssue.className = "mc-button is-primary is-sm queue-toolbar-newissue";
    newIssue.href = newIssueUrl;
    newIssue.target = "_blank";
    newIssue.rel = "noopener noreferrer";
    newIssue.textContent = "+ New issue";
    utility.append(newIssue);
  }

  toolbar.append(viewModeSeg, titleBlock, searchWrap, filtersGroup, chipsWrap);
  if (statusPills) {
    toolbar.append(statusPills);
  }
  toolbar.append(utility);
  return {
    search,
    firstStageChip: () => filtersGroup.querySelector<HTMLButtonElement>("button"),
  };
}
