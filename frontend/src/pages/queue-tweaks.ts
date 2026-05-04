import {
  type BoardCardVariant,
  type BoardDensity,
  type BoardHeaderStyle,
  type BoardTweaks,
  type BoardViewMode,
} from "../state/tweaks";
import { getThemePreference, setTheme, type ThemePreference } from "../ui/theme";

export interface TweaksPanelOptions {
  getTweaks: () => BoardTweaks;
  setTweaks: (patch: Partial<BoardTweaks>) => void;
}

export interface TweaksPanelHandle {
  panel: HTMLElement;
  fab: HTMLButtonElement;
  setOpen(open: boolean): void;
  refreshForMode(mode: BoardViewMode): void;
  destroy(): void;
}

interface SegOption<T extends string> {
  value: T;
  label: string;
}

function buildSeg<T extends string>(
  label: string,
  options: ReadonlyArray<SegOption<T>>,
  value: T,
  onSelect: (value: T) => void,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "mc-tweak-row";
  const labelEl = document.createElement("div");
  labelEl.className = "mc-tweak-label";
  labelEl.textContent = label.toUpperCase();
  const seg = document.createElement("div");
  seg.className = "mc-tweak-seg";
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.value = option.value;
    button.textContent = option.label;
    button.setAttribute("aria-pressed", String(option.value === value));
    button.addEventListener("click", () => onSelect(option.value));
    seg.append(button);
  }
  row.append(labelEl, seg);
  return row;
}

function syncSeg(row: HTMLElement, value: string): void {
  const buttons = row.querySelectorAll<HTMLButtonElement>(".mc-tweak-seg button");
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.value === value));
  }
}

function buildToggle(label: string, checked: boolean, onChange: (next: boolean) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "mc-tweak-row";
  const wrap = document.createElement("div");
  wrap.className = "mc-tweak-toggle";
  const text = document.createElement("span");
  text.textContent = label;
  const switchEl = document.createElement("button");
  switchEl.type = "button";
  switchEl.className = "mc-tweak-switch";
  switchEl.setAttribute("role", "switch");
  switchEl.setAttribute("aria-checked", String(checked));
  switchEl.setAttribute("aria-label", label);
  switchEl.addEventListener("click", () => {
    const next = switchEl.getAttribute("aria-checked") !== "true";
    switchEl.setAttribute("aria-checked", String(next));
    onChange(next);
  });
  wrap.append(text, switchEl);
  row.append(wrap);
  return row;
}

const DENSITY_OPTIONS: ReadonlyArray<SegOption<BoardDensity>> = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "comfortable", label: "Comfy" },
];

const HEADER_OPTIONS: ReadonlyArray<SegOption<BoardHeaderStyle>> = [
  { value: "bar", label: "Bar" },
  { value: "accent", label: "Accent" },
  { value: "minimal", label: "Minimal" },
];

const VARIANT_OPTIONS: ReadonlyArray<SegOption<BoardCardVariant>> = [
  { value: "default", label: "Default" },
  { value: "minimal", label: "Minimal" },
  { value: "lifecycle", label: "Lifecycle" },
];

const THEME_OPTIONS: ReadonlyArray<SegOption<"light" | "dark">> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const KANBAN_LIKE_MODES: ReadonlySet<BoardViewMode> = new Set<BoardViewMode>(["kanban", "swimlane"]);

export function createTweaksPanel(options: TweaksPanelOptions): TweaksPanelHandle {
  const tweaks = options.getTweaks();

  const panel = document.createElement("aside");
  panel.className = "mc-tweaks";
  panel.setAttribute("aria-label", "Board tweaks");

  const head = document.createElement("div");
  head.className = "mc-tweaks-head";
  const title = document.createElement("h2");
  title.textContent = "Tweaks";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "mc-tweaks-close";
  close.setAttribute("aria-label", "Hide tweaks");
  close.textContent = "✕";
  head.append(title, close);

  const body = document.createElement("div");
  body.className = "mc-tweaks-body";
  panel.append(head, body);

  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "mc-tweaks-fab";
  fab.setAttribute("aria-label", "Show tweaks");
  fab.innerHTML = "✦ Tweaks";

  let lastMode: BoardViewMode = tweaks.viewMode;

  function buildRowsForMode(mode: BoardViewMode): void {
    body.replaceChildren();
    const current = options.getTweaks();

    const themeRow = buildSeg<"light" | "dark">("Theme", THEME_OPTIONS, resolveCurrentTheme(), (value) => {
      setTheme(value as ThemePreference);
      syncSeg(themeRow, value);
    });
    body.append(themeRow);

    const densityRow = buildSeg<BoardDensity>("Density", DENSITY_OPTIONS, current.density, (value) => {
      options.setTweaks({ density: value });
      syncSeg(densityRow, value);
    });
    body.append(densityRow);

    if (KANBAN_LIKE_MODES.has(mode)) {
      const headerRow = buildSeg<BoardHeaderStyle>("Column header", HEADER_OPTIONS, current.headerStyle, (value) => {
        options.setTweaks({ headerStyle: value });
        syncSeg(headerRow, value);
      });
      const variantRow = buildSeg<BoardCardVariant>("Card content", VARIANT_OPTIONS, current.cardVariant, (value) => {
        options.setTweaks({ cardVariant: value });
        syncSeg(variantRow, value);
      });
      const lifecycleRow = buildToggle("Show lifecycle chip", current.showLifecycle, (next) => {
        options.setTweaks({ showLifecycle: next });
      });
      body.append(headerRow, variantRow, lifecycleRow);
    }
  }

  function applyVisibility(mode: BoardViewMode, open: boolean): void {
    if (mode === "focus") {
      panel.hidden = true;
      fab.hidden = true;
      return;
    }
    panel.hidden = !open;
    fab.hidden = open;
  }

  function setOpen(open: boolean): void {
    applyVisibility(lastMode, open);
    options.setTweaks({ tweaksOpen: open });
  }

  function refreshForMode(mode: BoardViewMode): void {
    if (mode !== lastMode) {
      lastMode = mode;
      buildRowsForMode(mode);
    }
    applyVisibility(mode, options.getTweaks().tweaksOpen);
  }

  buildRowsForMode(tweaks.viewMode);
  applyVisibility(tweaks.viewMode, tweaks.tweaksOpen);

  close.addEventListener("click", () => setOpen(false));
  fab.addEventListener("click", () => setOpen(true));

  const onThemeChange = (): void => {
    const themeRow = body.querySelector<HTMLElement>(".mc-tweak-row");
    if (themeRow) syncSeg(themeRow, resolveCurrentTheme());
  };
  globalThis.addEventListener("theme:change", onThemeChange);

  return {
    panel,
    fab,
    setOpen,
    refreshForMode,
    destroy(): void {
      globalThis.removeEventListener("theme:change", onThemeChange);
      panel.remove();
      fab.remove();
    },
  };
}

function resolveCurrentTheme(): "light" | "dark" {
  const preference = getThemePreference();
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
