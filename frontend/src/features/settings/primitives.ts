/**
 * Settings primitives.
 *
 * DOM-factory components consumed by every section in the Settings page.
 * Form rows, toggles, segmented controls, sub-dividers, sticky save bar
 * — built as plain DOM helpers, no React, no JSX.
 *
 * Live state and accent treatments use background tints rather than
 * persistent side-stripe borders, per DESIGN.md.
 */

export type Tone = "primary" | "ghost" | "danger";

export interface FormRowOptions {
  label: string;
  hint?: string | null;
  /**
   * Optional live-state highlight. Renders a subtle tinted background on the
   * row when set, instead of a side-stripe border (DESIGN.md ban).
   * Pass a status token name like `"running"` or a CSS color via `--*`
   * custom property reference, e.g. `"var(--status-running)"`.
   */
  accent?: string | null;
  control: HTMLElement;
}

export function createFormRow({ label, hint, accent, control }: FormRowOptions): HTMLElement {
  const row = document.createElement("div");
  row.className = "settings-row";
  if (accent) {
    row.dataset.accent = "live";
    row.style.setProperty("--row-accent", accent);
  }

  const meta = document.createElement("div");
  meta.className = "settings-row-meta";

  const labelEl = document.createElement("div");
  labelEl.className = "settings-row-label";
  labelEl.textContent = label;
  meta.append(labelEl);

  if (hint) {
    const hintEl = document.createElement("div");
    hintEl.className = "settings-row-hint";
    hintEl.textContent = hint;
    meta.append(hintEl);
  }

  const controlWrap = document.createElement("div");
  controlWrap.className = "settings-row-control";
  controlWrap.append(control);

  row.append(meta, controlWrap);
  return row;
}

export interface SubDividerOptions {
  label: string;
  description?: string | null;
}

export function createSubDivider({ label, description }: SubDividerOptions): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "settings-sub-divider";

  const labelEl = document.createElement("span");
  labelEl.className = "settings-sub-divider-label";
  labelEl.textContent = label;
  wrap.append(labelEl);

  if (description) {
    const descEl = document.createElement("span");
    descEl.className = "settings-sub-divider-desc";
    descEl.textContent = description;
    wrap.append(descEl);
  }

  return wrap;
}

export interface ToggleOptions {
  checked: boolean;
  label?: string;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

export function createToggle({ checked, label, disabled, onChange }: ToggleOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mc-toggle";
  button.setAttribute("role", "switch");
  button.setAttribute("aria-checked", String(checked));
  if (label) {
    button.setAttribute("aria-label", label);
  }
  if (disabled) {
    button.disabled = true;
    button.dataset.disabled = "true";
  }
  button.addEventListener("click", () => {
    if (button.disabled) return;
    const next = button.getAttribute("aria-checked") !== "true";
    button.setAttribute("aria-checked", String(next));
    onChange(next);
  });
  return button;
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface SegmentedOptions<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  ariaLabel?: string;
  onChange: (next: T) => void;
}

export function createSegmented<T extends string>({
  value,
  options,
  ariaLabel,
  onChange,
}: SegmentedOptions<T>): HTMLElement {
  const group = document.createElement("div");
  group.className = "mc-segmented";
  group.setAttribute("role", "radiogroup");
  if (ariaLabel) {
    group.setAttribute("aria-label", ariaLabel);
  }

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.value = option.value;
    button.textContent = option.label;
    if (option.description) {
      button.title = option.description;
    }
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(option.value === value));
    button.addEventListener("click", () => {
      for (const sibling of group.querySelectorAll<HTMLButtonElement>("button")) {
        sibling.setAttribute("aria-checked", String(sibling.dataset.value === option.value));
      }
      onChange(option.value);
    });
    group.append(button);
  }

  return group;
}

export interface TextInputOptions {
  value: string;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  width?: number | string;
  onInput: (value: string) => void;
}

export function createTextField({
  value,
  placeholder,
  mono,
  disabled,
  width,
  onInput,
}: TextInputOptions): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.className = mono ? "mc-input is-mono" : "mc-input";
  if (placeholder) input.placeholder = placeholder;
  if (disabled) input.disabled = true;
  if (typeof width === "number") {
    input.style.width = `${width}px`;
  } else if (typeof width === "string") {
    input.style.width = width;
  }
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

export interface NumberInputOptions {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  width?: number | string;
  disabled?: boolean;
  onInput: (value: number) => void;
}

export function createNumberField({
  value,
  min,
  max,
  step,
  width,
  disabled,
  onInput,
}: NumberInputOptions): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.className = "mc-input is-mono";
  input.value = String(value);
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  if (step !== undefined) input.step = String(step);
  if (disabled) input.disabled = true;
  if (typeof width === "number") {
    input.style.width = `${width}px`;
  } else if (typeof width === "string") {
    input.style.width = width;
  }
  input.addEventListener("input", () => {
    const parsed = Number(input.value);
    if (Number.isFinite(parsed)) {
      onInput(parsed);
    }
  });
  return input;
}

export interface SelectFieldOption {
  value: string;
  label: string;
}

export interface SelectFieldOptions {
  value: string;
  options: ReadonlyArray<SelectFieldOption>;
  width?: number | string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function createSelectField({
  value,
  options,
  width,
  disabled,
  onChange,
}: SelectFieldOptions): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "mc-select is-mono";
  if (disabled) select.disabled = true;
  if (typeof width === "number") {
    select.style.width = `${width}px`;
  } else if (typeof width === "string") {
    select.style.width = width;
  }
  for (const option of options) {
    const optionEl = document.createElement("option");
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    if (option.value === value) optionEl.selected = true;
    select.append(optionEl);
  }
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

export interface TextareaFieldOptions {
  value: string;
  rows?: number;
  mono?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onInput: (value: string) => void;
}

export function createTextareaField({
  value,
  rows,
  mono,
  placeholder,
  disabled,
  onInput,
}: TextareaFieldOptions): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.className = mono ? "mc-textarea is-mono" : "mc-textarea";
  textarea.value = value;
  textarea.rows = rows ?? 4;
  if (placeholder) textarea.placeholder = placeholder;
  if (disabled) textarea.disabled = true;
  textarea.addEventListener("input", () => onInput(textarea.value));
  return textarea;
}

export interface SliderFieldOptions {
  value: number;
  min: number;
  max: number;
  step?: number;
  onInput: (value: number) => void;
}

export function createSliderField({ value, min, max, step, onInput }: SliderFieldOptions): {
  wrap: HTMLElement;
  display: HTMLElement;
} {
  const wrap = document.createElement("div");
  wrap.className = "settings-slider";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = String(min);
  slider.max = String(max);
  if (step !== undefined) slider.step = String(step);
  slider.value = String(value);

  const display = document.createElement("span");
  display.className = "settings-slider-value";
  display.textContent = String(value);

  slider.addEventListener("input", () => {
    const parsed = Number(slider.value);
    if (Number.isFinite(parsed)) {
      display.textContent = String(parsed);
      onInput(parsed);
    }
  });

  wrap.append(slider, display);
  return { wrap, display };
}

export interface ChipListOptions {
  values: ReadonlyArray<string>;
  placeholder?: string;
  onChange: (next: string[]) => void;
}

export function createChipList({ values, placeholder, onChange }: ChipListOptions): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "settings-chips";
  let current: string[] = [...values];

  const renderChips = (): void => {
    const existing = wrap.querySelectorAll(".settings-chip");
    for (const node of existing) node.remove();
    for (const value of current) {
      const chip = document.createElement("span");
      chip.className = "settings-chip mc-chip is-sm";
      chip.textContent = value;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "settings-chip-remove";
      remove.setAttribute("aria-label", `Remove ${value}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        current = current.filter((entry) => entry !== value);
        onChange([...current]);
        renderChips();
      });
      chip.append(remove);
      wrap.insertBefore(chip, input);
    }
  };

  const input = document.createElement("input");
  input.type = "text";
  input.className = "settings-chip-input mc-input is-mono";
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    const trimmed = input.value.trim();
    if (trimmed.length === 0) return;
    if (current.includes(trimmed)) {
      input.value = "";
      return;
    }
    current = [...current, trimmed];
    input.value = "";
    onChange([...current]);
    renderChips();
  });

  wrap.append(input);
  renderChips();
  return wrap;
}

export interface SectionHeaderOptions {
  title: string;
  sub?: string;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  action?: HTMLElement;
}

export interface SectionHeaderHandle {
  root: HTMLElement;
  searchInput: HTMLInputElement | null;
  focusSearch(): void;
}

export function createSectionHeader({
  title,
  sub,
  searchPlaceholder,
  onSearch,
  action,
}: SectionHeaderOptions): SectionHeaderHandle {
  const root = document.createElement("header");
  root.className = "settings-section-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "settings-section-header-text";

  const titleEl = document.createElement("h2");
  titleEl.className = "settings-section-title";
  titleEl.textContent = title;
  titleWrap.append(titleEl);

  if (sub) {
    const subEl = document.createElement("p");
    subEl.className = "settings-section-sub";
    subEl.textContent = sub;
    titleWrap.append(subEl);
  }

  root.append(titleWrap);

  const tools = document.createElement("div");
  tools.className = "settings-section-header-tools";

  let searchInput: HTMLInputElement | null = null;
  if (onSearch) {
    searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "settings-section-search mc-input is-mono";
    searchInput.placeholder = searchPlaceholder ?? "Filter fields";
    searchInput.setAttribute("aria-label", `Filter ${title} fields`);
    searchInput.addEventListener("input", () => onSearch(searchInput!.value));
    tools.append(searchInput);
  }

  if (action) {
    tools.append(action);
  }

  if (tools.childNodes.length > 0) {
    root.append(tools);
  }

  return {
    root,
    searchInput,
    focusSearch(): void {
      searchInput?.focus();
      searchInput?.select();
    },
  };
}

export interface SaveBarOptions {
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  saveLabel?: string;
  discardLabel?: string;
}

export interface SaveBarHandle {
  root: HTMLElement;
  setDirty(dirty: boolean): void;
  setSaving(saving: boolean): void;
  setError(message: string | null): void;
}

export function createSaveBar({ onSave, onDiscard, saveLabel, discardLabel }: SaveBarOptions): SaveBarHandle {
  const root = document.createElement("div");
  root.className = "settings-save-bar";
  root.dataset.dirty = "false";

  const errorEl = document.createElement("div");
  errorEl.className = "settings-save-bar-error";
  errorEl.hidden = true;
  root.append(errorEl);

  const status = document.createElement("span");
  status.className = "settings-save-bar-status";
  status.textContent = "Unsaved changes";
  root.append(status);

  const discardBtn = document.createElement("button");
  discardBtn.type = "button";
  discardBtn.className = "mc-button is-ghost is-sm";
  discardBtn.textContent = discardLabel ?? "Discard";
  discardBtn.addEventListener("click", () => onDiscard());
  root.append(discardBtn);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "mc-button is-primary is-sm";
  saveBtn.textContent = saveLabel ?? "Save changes";
  saveBtn.addEventListener("click", async () => {
    if (saveBtn.disabled) return;
    await onSave();
  });
  root.append(saveBtn);

  return {
    root,
    setDirty(dirty: boolean): void {
      root.dataset.dirty = String(dirty);
      root.hidden = !dirty;
    },
    setSaving(saving: boolean): void {
      saveBtn.disabled = saving;
      discardBtn.disabled = saving;
      saveBtn.textContent = saving ? "Saving…" : (saveLabel ?? "Save changes");
    },
    setError(message: string | null): void {
      errorEl.hidden = !message;
      errorEl.textContent = message ?? "";
    },
  };
}
