/**
 * Persisted board-level visual tweaks. Theme is intentionally NOT stored here —
 * `ui/theme.ts` already owns the `data-theme` attribute and its own storage key.
 * The Tweaks panel reads/writes theme through that module so there is exactly
 * one source of truth.
 */

const STORAGE_KEY = "risoluto:board:tweaks";

export type BoardDensity = "compact" | "default" | "comfortable";
export type BoardHeaderStyle = "bar" | "accent" | "minimal";
export type BoardCardVariant = "default" | "minimal" | "lifecycle";
export type BoardViewMode = "kanban" | "swimlane" | "list" | "focus";
export type BoardStatusFilter = "all" | "running" | "queued" | "claimed" | "blocked" | "done";

export interface BoardTweaks {
  viewMode: BoardViewMode;
  statusFilter: BoardStatusFilter;
  collapsedColumns: string[];
  seenRepos: string[];
  density: BoardDensity;
  headerStyle: BoardHeaderStyle;
  cardVariant: BoardCardVariant;
  showLifecycle: boolean;
  tweaksOpen: boolean;
}

export const DEFAULT_TWEAKS: Readonly<BoardTweaks> = Object.freeze({
  viewMode: "kanban",
  statusFilter: "all",
  collapsedColumns: [] as string[],
  seenRepos: [] as string[],
  density: "default",
  headerStyle: "bar",
  cardVariant: "default",
  showLifecycle: true,
  tweaksOpen: false,
});

const VALID_DENSITY: ReadonlySet<string> = new Set<BoardDensity>(["compact", "default", "comfortable"]);
const VALID_HEADER_STYLE: ReadonlySet<string> = new Set<BoardHeaderStyle>(["bar", "accent", "minimal"]);
const VALID_CARD_VARIANT: ReadonlySet<string> = new Set<BoardCardVariant>(["default", "minimal", "lifecycle"]);
const VALID_VIEW_MODE: ReadonlySet<string> = new Set<BoardViewMode>(["kanban", "swimlane", "list", "focus"]);
const VALID_STATUS_FILTER: ReadonlySet<string> = new Set<BoardStatusFilter>([
  "all",
  "running",
  "queued",
  "claimed",
  "blocked",
  "done",
]);

function isBoardDensity(value: unknown): value is BoardDensity {
  return typeof value === "string" && VALID_DENSITY.has(value);
}
function isBoardHeaderStyle(value: unknown): value is BoardHeaderStyle {
  return typeof value === "string" && VALID_HEADER_STYLE.has(value);
}
function isBoardCardVariant(value: unknown): value is BoardCardVariant {
  return typeof value === "string" && VALID_CARD_VARIANT.has(value);
}
function isBoardViewMode(value: unknown): value is BoardViewMode {
  return typeof value === "string" && VALID_VIEW_MODE.has(value);
}
function isBoardStatusFilter(value: unknown): value is BoardStatusFilter {
  return typeof value === "string" && VALID_STATUS_FILTER.has(value);
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

let cache: BoardTweaks | null = null;

function readFromStorage(): BoardTweaks {
  const storage = getStorage();
  if (!storage) {
    return cloneDefault();
  }
  let candidate: Partial<BoardTweaks>;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefault();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return cloneDefault();
    candidate = parsed as Partial<BoardTweaks>;
  } catch {
    return cloneDefault();
  }
  return {
    viewMode: isBoardViewMode(candidate.viewMode) ? candidate.viewMode : DEFAULT_TWEAKS.viewMode,
    statusFilter: isBoardStatusFilter(candidate.statusFilter) ? candidate.statusFilter : DEFAULT_TWEAKS.statusFilter,
    collapsedColumns: sanitizeStringArray(candidate.collapsedColumns),
    seenRepos: sanitizeStringArray(candidate.seenRepos),
    density: isBoardDensity(candidate.density) ? candidate.density : DEFAULT_TWEAKS.density,
    headerStyle: isBoardHeaderStyle(candidate.headerStyle) ? candidate.headerStyle : DEFAULT_TWEAKS.headerStyle,
    cardVariant: isBoardCardVariant(candidate.cardVariant) ? candidate.cardVariant : DEFAULT_TWEAKS.cardVariant,
    showLifecycle:
      typeof candidate.showLifecycle === "boolean" ? candidate.showLifecycle : DEFAULT_TWEAKS.showLifecycle,
    tweaksOpen: typeof candidate.tweaksOpen === "boolean" ? candidate.tweaksOpen : DEFAULT_TWEAKS.tweaksOpen,
  };
}

function cloneDefault(): BoardTweaks {
  return {
    ...DEFAULT_TWEAKS,
    collapsedColumns: [...DEFAULT_TWEAKS.collapsedColumns],
    seenRepos: [...DEFAULT_TWEAKS.seenRepos],
  };
}

function cloneTweaks(source: BoardTweaks): BoardTweaks {
  return {
    ...source,
    collapsedColumns: [...source.collapsedColumns],
    seenRepos: [...source.seenRepos],
  };
}

export function loadTweaks(): BoardTweaks {
  if (cache === null) {
    cache = readFromStorage();
  }
  return cloneTweaks(cache);
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
  return true;
}

function tweaksEqual(left: BoardTweaks, right: BoardTweaks): boolean {
  return (
    left.viewMode === right.viewMode &&
    left.statusFilter === right.statusFilter &&
    left.density === right.density &&
    left.headerStyle === right.headerStyle &&
    left.cardVariant === right.cardVariant &&
    left.showLifecycle === right.showLifecycle &&
    left.tweaksOpen === right.tweaksOpen &&
    arraysEqual(left.collapsedColumns, right.collapsedColumns) &&
    arraysEqual(left.seenRepos, right.seenRepos)
  );
}

export function saveTweaks(patch: Partial<BoardTweaks>): BoardTweaks {
  const base = cache ?? readFromStorage();
  const next: BoardTweaks = {
    ...base,
    ...patch,
    collapsedColumns: patch.collapsedColumns ? sanitizeStringArray(patch.collapsedColumns) : [...base.collapsedColumns],
    seenRepos: patch.seenRepos ? sanitizeStringArray(patch.seenRepos) : [...base.seenRepos],
  };
  if (cache && tweaksEqual(cache, next)) {
    return cloneTweaks(cache);
  }
  cache = next;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // quota exhausted or serialization failed — keep in-memory state, return it
    }
  }
  return cloneTweaks(next);
}

export function resetTweaks(): BoardTweaks {
  cache = cloneDefault();
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return cloneDefault();
}

/**
 * For tests: discard the in-memory cache so the next `loadTweaks()` re-reads
 * from `localStorage`. Production code should never need this.
 */
export function resetTweaksCacheForTests(): void {
  cache = null;
}
