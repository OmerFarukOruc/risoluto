/**
 * Persisted board-level visual tweaks. Theme is intentionally NOT stored here —
 * `ui/theme.ts` already owns the `data-theme` attribute and its own storage key.
 * The Tweaks panel reads/writes theme through that module so there is exactly
 * one source of truth.
 */

const STORAGE_KEY = "risoluto:board:tweaks";

export type BoardDensity = "compact" | "default" | "comfortable";
export type BoardGroupBy = "none" | "priority" | "model" | "repo";
export type BoardHeaderStyle = "bar" | "accent" | "minimal";
export type BoardCardVariant = "default" | "minimal" | "lifecycle";

export interface BoardTweaks {
  density: BoardDensity;
  groupBy: BoardGroupBy;
  headerStyle: BoardHeaderStyle;
  cardVariant: BoardCardVariant;
  showLifecycle: boolean;
  tweaksOpen: boolean;
}

export const DEFAULT_TWEAKS: Readonly<BoardTweaks> = Object.freeze({
  density: "default",
  groupBy: "none",
  headerStyle: "bar",
  cardVariant: "default",
  showLifecycle: true,
  tweaksOpen: false,
});

const VALID_DENSITY: ReadonlySet<string> = new Set<BoardDensity>(["compact", "default", "comfortable"]);
const VALID_GROUP_BY: ReadonlySet<string> = new Set<BoardGroupBy>(["none", "priority", "model", "repo"]);
const VALID_HEADER_STYLE: ReadonlySet<string> = new Set<BoardHeaderStyle>(["bar", "accent", "minimal"]);
const VALID_CARD_VARIANT: ReadonlySet<string> = new Set<BoardCardVariant>(["default", "minimal", "lifecycle"]);

function isBoardDensity(value: unknown): value is BoardDensity {
  return typeof value === "string" && VALID_DENSITY.has(value);
}
function isBoardGroupBy(value: unknown): value is BoardGroupBy {
  return typeof value === "string" && VALID_GROUP_BY.has(value);
}
function isBoardHeaderStyle(value: unknown): value is BoardHeaderStyle {
  return typeof value === "string" && VALID_HEADER_STYLE.has(value);
}
function isBoardCardVariant(value: unknown): value is BoardCardVariant {
  return typeof value === "string" && VALID_CARD_VARIANT.has(value);
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
    return { ...DEFAULT_TWEAKS };
  }
  let candidate: Partial<BoardTweaks>;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TWEAKS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_TWEAKS };
    candidate = parsed as Partial<BoardTweaks>;
  } catch {
    return { ...DEFAULT_TWEAKS };
  }
  return {
    density: isBoardDensity(candidate.density) ? candidate.density : DEFAULT_TWEAKS.density,
    groupBy: isBoardGroupBy(candidate.groupBy) ? candidate.groupBy : DEFAULT_TWEAKS.groupBy,
    headerStyle: isBoardHeaderStyle(candidate.headerStyle) ? candidate.headerStyle : DEFAULT_TWEAKS.headerStyle,
    cardVariant: isBoardCardVariant(candidate.cardVariant) ? candidate.cardVariant : DEFAULT_TWEAKS.cardVariant,
    showLifecycle:
      typeof candidate.showLifecycle === "boolean" ? candidate.showLifecycle : DEFAULT_TWEAKS.showLifecycle,
    tweaksOpen: typeof candidate.tweaksOpen === "boolean" ? candidate.tweaksOpen : DEFAULT_TWEAKS.tweaksOpen,
  };
}

export function loadTweaks(): BoardTweaks {
  if (cache === null) {
    cache = readFromStorage();
  }
  return { ...cache };
}

export function saveTweaks(patch: Partial<BoardTweaks>): BoardTweaks {
  const next: BoardTweaks = { ...(cache ?? readFromStorage()), ...patch };
  cache = next;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // quota exhausted or serialization failed — keep in-memory state, return it
    }
  }
  return { ...next };
}

export function resetTweaks(): BoardTweaks {
  cache = { ...DEFAULT_TWEAKS };
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return { ...DEFAULT_TWEAKS };
}

/**
 * For tests: discard the in-memory cache so the next `loadTweaks()` re-reads
 * from `localStorage`. Production code should never need this.
 */
export function resetTweaksCacheForTests(): void {
  cache = null;
}
