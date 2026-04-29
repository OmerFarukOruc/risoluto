import {
  type BoardCardVariant,
  type BoardDensity,
  type BoardGroupBy,
  type BoardHeaderStyle,
  type BoardTweaks,
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

const GROUP_OPTIONS: ReadonlyArray<SegOption<BoardGroupBy>> = [
  { value: "none", label: "None" },
  { value: "priority", label: "Pri" },
  { value: "model", label: "Model" },
  { value: "repo", label: "Repo" },
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

export function createTweaksPanel(options: TweaksPanelOptions): TweaksPanelHandle {
  const tweaks = options.getTweaks();

  const panel = document.createElement("aside");
  panel.className = "mc-tweaks";
  panel.setAttribute("aria-label", "Board tweaks");
  panel.hidden = !tweaks.tweaksOpen;

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

  const themeRow = buildSeg<"light" | "dark">("Theme", THEME_OPTIONS, resolveCurrentTheme(), (value) => {
    setTheme(value as ThemePreference);
    syncSeg(themeRow, value);
  });
  const densityRow = buildSeg<BoardDensity>("Density", DENSITY_OPTIONS, tweaks.density, (value) => {
    options.setTweaks({ density: value });
    syncSeg(densityRow, value);
  });
  const groupRow = buildSeg<BoardGroupBy>("Group by", GROUP_OPTIONS, tweaks.groupBy, (value) => {
    options.setTweaks({ groupBy: value });
    syncSeg(groupRow, value);
  });
  const headerRow = buildSeg<BoardHeaderStyle>("Column header", HEADER_OPTIONS, tweaks.headerStyle, (value) => {
    options.setTweaks({ headerStyle: value });
    syncSeg(headerRow, value);
  });
  const variantRow = buildSeg<BoardCardVariant>("Card content", VARIANT_OPTIONS, tweaks.cardVariant, (value) => {
    options.setTweaks({ cardVariant: value });
    syncSeg(variantRow, value);
  });
  const lifecycleRow = buildToggle("Show lifecycle chip", tweaks.showLifecycle, (next) => {
    options.setTweaks({ showLifecycle: next });
  });

  body.append(themeRow, densityRow, groupRow, headerRow, variantRow, lifecycleRow);
  panel.append(head, body);

  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "mc-tweaks-fab";
  fab.setAttribute("aria-label", "Show tweaks");
  fab.innerHTML = "✦ Tweaks";
  fab.hidden = tweaks.tweaksOpen;

  function setOpen(open: boolean): void {
    panel.hidden = !open;
    fab.hidden = open;
    options.setTweaks({ tweaksOpen: open });
  }

  close.addEventListener("click", () => setOpen(false));
  fab.addEventListener("click", () => setOpen(true));

  const onThemeChange = (): void => {
    syncSeg(themeRow, resolveCurrentTheme());
  };
  globalThis.addEventListener("theme:change", onThemeChange);

  return {
    panel,
    fab,
    setOpen,
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
