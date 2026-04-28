import { createEmptyState } from "../../components/empty-state";
import { createIcon } from "../../ui/icons";

import {
  buildSectionDiffPreview,
  buildUnderlyingPaths,
  ensureSectionDrafts,
  sectionHasUnsavedDrafts,
  SECTION_GROUPS,
  sectionGroups,
  sectionMatchesFilter,
  sectionVisibleInMode,
  SECTION_IDS,
  type SettingsSectionDefinition,
} from "./settings-helpers";
import { createSectionAction, createSettingsField } from "./settings-forms";
import { getValueAtPath } from "./settings-paths";
import type { SettingsState } from "./settings-state";
import type { SettingsMode } from "./settings-types";

interface SettingsRenderOptions {
  onFilter: (value: string) => void;
  onSelectSection: (sectionId: string) => void;
  onToggleDiff: (sectionId: string) => void;
  onTogglePaths: (sectionId: string) => void;
  onSaveSection: (sectionId: string) => void;
  onRevertSection: (sectionId: string) => void;
  /** Called when the user switches between Focused and Advanced modes. */
  onSetMode?: (mode: SettingsMode) => void;
  onDraftChange: (sectionId: string, fieldPath: string, value: string) => void;
  onFocusSection: (sectionId: string) => void;
  /** Called when a field-level action button is clicked (e.g. "Browse" for project slug). */
  onFieldAction?: (sectionId: string, fieldPath: string, actionKind: string) => void;
  /** Called by the unified save bar to save all dirty sections at once. */
  onSaveAllSections?: () => void;
  /** Called by the unified save bar to revert all draft changes. */
  onRevertAll?: () => void;
  /** Returns the IDs of currently dirty sections (used to label and gate the bulk-save bar). */
  dirtySectionIds?: () => string[];
}

/** AbortController for cleaning up event listeners between renders. */
let renderAbortController: AbortController | null = null;

/**
 * When a rail click triggers `scrollIntoView({ behavior: "smooth" })`, the
 * scroll spy would fire on every frame and flash through intermediate sections.
 * While `true`, scroll events are ignored. Cleared via debounce after scroll settles.
 */
let scrollSpySuppressed = false;
let scrollSettleTimer = 0;

export function renderSettingsLayout(
  rail: HTMLElement,
  content: HTMLElement,
  searchInput: HTMLInputElement,
  state: SettingsState,
  sections: SettingsSectionDefinition[],
  options: SettingsRenderOptions,
): SettingsSectionDefinition[] {
  renderAbortController?.abort();
  renderAbortController = new AbortController();
  const signal = renderAbortController.signal;

  // Sort sections by sidebar group order so content and rail stay aligned.
  const groupOrder = Object.values(SECTION_GROUPS).map((g) => g.id);
  const visibleSections = sections
    .filter(
      (section) =>
        sectionVisibleInMode(section, state.mode) &&
        sectionMatchesFilter(section, state.filter, state.drafts[section.id]),
    )
    .sort((a, b) => {
      const aGroup = groupOrder.indexOf((a.groupId ?? "") as (typeof groupOrder)[number]);
      const bGroup = groupOrder.indexOf((b.groupId ?? "") as (typeof groupOrder)[number]);
      return aGroup - bGroup;
    });
  if (!visibleSections.some((section) => section.id === state.selectedSectionId)) {
    state.selectedSectionId = visibleSections[0]?.id ?? state.selectedSectionId;
  }
  renderRail(rail, visibleSections, state, options, signal);
  renderContent(content, searchInput, visibleSections, state, options, signal);

  // Scroll spy: sync rail highlight with content scroll position.
  // Deferred to next frame because `content` may not be in the DOM yet
  // (renderAsyncState calls renderContent to build nodes, then appends them).
  requestAnimationFrame(() => {
    if (signal.aborted) return;
    const scrollRoot = content.closest<HTMLElement>(".shell-outlet");
    if (!scrollRoot) return;

    let rafId = 0;
    const updateActiveSection = () => {
      const rootTop = scrollRoot.getBoundingClientRect().top;
      const anchor = rootTop + scrollRoot.clientHeight * 0.2;
      let activeId = visibleSections[0]?.id;

      // At bottom of scroll — always select last section
      const atBottom = scrollRoot.scrollHeight - scrollRoot.scrollTop - scrollRoot.clientHeight < 2;
      if (atBottom && visibleSections.length > 0) {
        activeId = visibleSections.at(-1)!.id;
      } else {
        for (const section of visibleSections) {
          const el = document.getElementById(`settings-${section.id}`);
          if (!el) continue;
          if (el.getBoundingClientRect().top <= anchor) {
            activeId = section.id;
          }
        }
      }

      if (activeId && activeId !== state.selectedSectionId) {
        state.selectedSectionId = activeId;
        highlightRailItem(rail, activeId);
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      if (scrollSpySuppressed) {
        // While suppressed, keep resetting the settle timer.
        // Once scroll events stop for 150ms, re-enable spy and do final sync.
        clearTimeout(scrollSettleTimer);
        scrollSettleTimer = window.setTimeout(() => {
          scrollSpySuppressed = false;
          updateActiveSection();
        }, 150);
        return;
      }
      rafId = requestAnimationFrame(updateActiveSection);
    };

    scrollRoot.addEventListener("scroll", onScroll, { signal, passive: true });
    signal.addEventListener("abort", () => {
      cancelAnimationFrame(rafId);
      clearTimeout(scrollSettleTimer);
    });
    // Initial sync
    requestAnimationFrame(updateActiveSection);
  });

  return visibleSections;
}

/** Toggle `.is-selected` on rail buttons to match the active section. */
function highlightRailItem(rail: HTMLElement, sectionId: string): void {
  for (const btn of rail.querySelectorAll<HTMLElement>(".settings-nav-item")) {
    const active = btn.dataset.sectionId === sectionId;
    btn.classList.toggle("is-selected", active);
    if (active) {
      // Scroll within the rail only — avoid scrollIntoView which scrolls
      // all ancestors and fights with the content scroll spy.
      const railRect = rail.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      if (btnRect.top < railRect.top || btnRect.bottom > railRect.bottom) {
        rail.scrollTop += btnRect.top - railRect.top - railRect.height / 2 + btnRect.height / 2;
      }
    }
  }
}

function renderRail(
  rail: HTMLElement,
  sections: SettingsSectionDefinition[],
  state: SettingsState,
  options: SettingsRenderOptions,
  signal: AbortSignal,
): void {
  rail.replaceChildren();

  // ── Mode toggle: Focused / Advanced ───────────────────
  rail.append(createModeToggle(state, options, signal));

  for (const group of Object.values(SECTION_GROUPS)) {
    const groupSections = sections.filter((section) => section.groupId === group.id);
    if (groupSections.length === 0) continue;

    const header = document.createElement("div");
    header.className = "settings-nav-group-header";
    header.append(
      createIcon(group.icon, { size: 14, className: "settings-nav-group-icon" }),
      document.createTextNode(group.label),
    );
    rail.append(header);

    for (const section of groupSections) {
      rail.append(createNavItem(section, state, options, signal));
    }
  }
}

function createModeToggle(state: SettingsState, options: SettingsRenderOptions, signal: AbortSignal): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "settings-mode-toggle";
  wrapper.setAttribute("role", "group");
  wrapper.setAttribute("aria-label", "Settings mode");

  const simpleBtn = document.createElement("button");
  simpleBtn.type = "button";
  simpleBtn.className = "settings-mode-btn";
  simpleBtn.classList.toggle("is-active", state.mode === "focused");
  simpleBtn.setAttribute("aria-pressed", state.mode === "focused" ? "true" : "false");
  simpleBtn.textContent = "Focused";
  simpleBtn.title = "Show the common settings";

  const advancedBtn = document.createElement("button");
  advancedBtn.type = "button";
  advancedBtn.className = "settings-mode-btn";
  advancedBtn.classList.toggle("is-active", state.mode === "advanced");
  advancedBtn.setAttribute("aria-pressed", state.mode === "advanced" ? "true" : "false");
  advancedBtn.textContent = "Advanced";
  advancedBtn.title = "Show all settings and expert options";

  simpleBtn.addEventListener("click", () => options.onSetMode?.("focused"), { signal });
  advancedBtn.addEventListener("click", () => options.onSetMode?.("advanced"), { signal });

  wrapper.append(simpleBtn, advancedBtn);
  return wrapper;
}

function createNavItem(
  section: SettingsSectionDefinition,
  state: SettingsState,
  options: SettingsRenderOptions,
  signal: AbortSignal,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "settings-nav-item";
  button.classList.toggle("is-selected", section.id === state.selectedSectionId);

  const topRow = document.createElement("span");
  topRow.className = "settings-nav-top";

  const title = document.createElement("span");
  title.className = "settings-nav-title";
  title.textContent = section.title;

  topRow.append(title);

  if (section.startHere) {
    const badge = document.createElement("span");
    badge.className = "settings-start-here";
    badge.textContent = "Start here";
    topRow.append(badge);
  }

  const hasOverrides = section.prefixes.some((prefix) => getValueAtPath(state.overlay, prefix) !== undefined);
  if (hasOverrides) {
    const modifiedBadge = document.createElement("span");
    modifiedBadge.className = "settings-nav-badge-modified";
    modifiedBadge.setAttribute("role", "img");
    modifiedBadge.setAttribute("aria-label", "Has saved overrides");
    modifiedBadge.title = "Has saved overrides";
    topRow.append(modifiedBadge);
  }

  if (sectionHasUnsavedDrafts(section, state.drafts[section.id], state.effective)) {
    const unsavedBadge = document.createElement("span");
    unsavedBadge.className = "settings-nav-badge-unsaved";
    unsavedBadge.setAttribute("role", "img");
    unsavedBadge.setAttribute("aria-label", "Has unsaved changes");
    unsavedBadge.title = "Has unsaved changes";
    topRow.append(unsavedBadge);
  }

  const desc = document.createElement("span");
  desc.className = "settings-nav-desc";
  desc.textContent =
    section.description.length > 44 ? `${section.description.slice(0, 44)}\u2026` : section.description;

  button.append(topRow, desc);
  button.dataset.sectionId = section.id;
  button.addEventListener(
    "click",
    () => {
      options.onSelectSection(section.id);
      highlightRailItem(button.closest(".settings-rail") ?? button.parentElement!, section.id);
      // Suppress scroll spy until the smooth-scroll settles so intermediate
      // sections don't flash in the rail.
      scrollSpySuppressed = true;
      clearTimeout(scrollSettleTimer);
      const target = document.getElementById(`settings-${section.id}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    { signal },
  );
  return button;
}

function renderContent(
  content: HTMLElement,
  searchInput: HTMLInputElement,
  sections: SettingsSectionDefinition[],
  state: SettingsState,
  options: SettingsRenderOptions,
  signal: AbortSignal,
): void {
  content.replaceChildren();
  const toolbar = document.createElement("section");
  toolbar.className = "mc-toolbar settings-toolbar";
  searchInput.value = state.filter;
  searchInput.addEventListener("input", () => options.onFilter(searchInput.value), { signal });
  toolbar.append(searchInput);
  if (showCoachingCopy()) {
    const hint = document.createElement("span");
    hint.className = "text-secondary";
    hint.textContent =
      "Search sections, fields, and values. Press / to focus search. Cmd/Ctrl+Enter saves the current section.";
    toolbar.append(hint);
  }
  const helpToggle = createCoachingToggle(signal);
  toolbar.append(helpToggle);
  content.append(toolbar);
  if (state.error) {
    const error = document.createElement("div");
    error.className = "settings-error";
    error.setAttribute("role", "alert");
    error.textContent = state.error;
    content.append(error);
  }
  if (!sections.length) {
    content.append(
      createEmptyState(
        "No matching settings",
        "Nothing matches that search. Try a broader term like provider, sandbox, or tracker.",
        "Clear search",
        () => options.onFilter(""),
      ),
    );
    return;
  }

  for (const section of sections) {
    content.append(buildSectionCard(section, state, options, signal));
  }

  const bulkBar = buildBulkActionsBar(state, options, signal);
  if (bulkBar) {
    content.append(bulkBar);
  }
}

/**
 * Sticky bottom toolbar that surfaces Save-all / Revert-all when there are
 * dirty sections. Only visible when `dirtySectionIds` and the bulk handlers
 * are wired (the legacy /settings entrypoint omits them).
 */
function buildBulkActionsBar(
  state: SettingsState,
  options: SettingsRenderOptions,
  signal: AbortSignal,
): HTMLElement | null {
  const dirty = options.dirtySectionIds?.() ?? [];
  if (dirty.length === 0 || (!options.onSaveAllSections && !options.onRevertAll)) {
    return null;
  }

  const bar = document.createElement("div");
  bar.className = "settings-bulk-actions";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "Bulk save actions");

  const summary = document.createElement("span");
  summary.className = "settings-bulk-summary";
  summary.textContent =
    dirty.length === 1 ? "1 section has unsaved changes" : `${dirty.length} sections have unsaved changes`;

  const actions = document.createElement("div");
  actions.className = "settings-bulk-actions-buttons";

  const isSaving = state.savingSectionId !== null;

  if (options.onRevertAll) {
    const revert = createSectionAction("Revert all");
    revert.disabled = isSaving;
    revert.addEventListener("click", () => options.onRevertAll?.(), { signal });
    actions.append(revert);
  }
  if (options.onSaveAllSections) {
    const saveAll = createSectionAction(`Save all (${dirty.length})`, true);
    saveAll.disabled = isSaving;
    saveAll.title = `Save all ${dirty.length} dirty sections`;
    saveAll.addEventListener("click", () => options.onSaveAllSections?.(), { signal });
    actions.append(saveAll);
  }

  bar.append(summary, actions);
  return bar;
}

function buildSectionCard(
  section: SettingsSectionDefinition,
  state: SettingsState,
  options: SettingsRenderOptions,
  signal: AbortSignal,
): HTMLElement {
  const stack = document.createElement("div");
  stack.className = "settings-stack";

  const drafts = ensureSectionDrafts(state.drafts, section, state.effective);
  const card = document.createElement("section");
  card.className = "mc-panel settings-card";
  card.id = `settings-${section.id}`;
  card.setAttribute("aria-labelledby", `settings-heading-${section.id}`);

  card.append(buildSectionHeader(section));

  const allGroups = sectionGroups(section);
  // In Focused mode, hide expert-tier groups entirely
  const groups = state.mode === "focused" ? allGroups.filter((g) => g.tier !== "expert") : allGroups;
  let prevTier: string | undefined;
  groups.forEach((group, index) => {
    card.append(createGroupElement(section, group, drafts, state, options, index === 0, prevTier));
    prevTier = group.tier ?? (group.advanced ? "expert" : "essential");
  });

  if (!isCredentialOnlySection(section)) {
    card.append(buildSectionActions(section, state, options, signal));
  }

  // Developer tools: only in Advanced mode
  if (state.mode === "advanced") {
    card.append(buildDevTools(section, drafts, state, options, signal));
  }

  stack.append(card);
  return stack;
}

/**
 * Credential-only sections (e.g. Credentials) manage state via their inline
 * delete + add modal. The standard Revert/Save bar is dead UI here — the
 * "Save credentials" button never has a draft to flush.
 */
function isCredentialOnlySection(section: SettingsSectionDefinition): boolean {
  return section.fields.length > 0 && section.fields.every((field) => field.kind === "credential");
}

/**
 * Run native HTML5 form validation across every required input/select/textarea
 * inside a settings section card before save. Returns false if any field
 * fails — and surfaces the validation UI by calling reportValidity() on the
 * first invalid control. Prevents silently saving an empty required field
 * (e.g. tracker.project_slug).
 */
function validateSectionRequiredFields(sectionId: string): boolean {
  const card = document.getElementById(`settings-${sectionId}`);
  if (!card) return true;
  const required = card.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input[required], select[required], textarea[required]",
  );
  for (const control of required) {
    if (!control.checkValidity()) {
      control.reportValidity();
      return false;
    }
  }
  return true;
}

function buildSectionHeader(section: SettingsSectionDefinition): HTMLElement {
  const header = document.createElement("div");
  header.className = "settings-section-header";

  const titleRow = document.createElement("div");
  titleRow.className = "settings-section-title-row";

  const title = document.createElement("h2");
  title.id = `settings-heading-${section.id}`;
  title.className = "settings-section-title";
  title.textContent = section.title;

  const badge = document.createElement("span");
  badge.className = "settings-section-badge";
  badge.textContent = section.badge;

  titleRow.append(title, badge);

  const desc = document.createElement("p");
  desc.className = "settings-section-desc";
  desc.textContent = section.description;

  const nextStep = createNextStepHint(section.id);

  header.append(titleRow, desc);
  if (nextStep) {
    header.append(nextStep);
  }
  return header;
}

function buildSectionActions(
  section: SettingsSectionDefinition,
  state: SettingsState,
  options: SettingsRenderOptions,
  signal: AbortSignal,
): HTMLElement {
  const actions = document.createElement("div");
  actions.className = "form-actions settings-actions";
  const isSaving = state.savingSectionId === section.id;

  const revert = createSectionAction("Revert");
  revert.disabled = isSaving;
  revert.addEventListener("click", () => options.onRevertSection(section.id), { signal });

  const saveLabel = isSaving ? "Saving…" : section.saveLabel;
  const save = createSectionAction(saveLabel, true);
  save.disabled = isSaving;
  // Cmd+S shadows the browser Save Page on most platforms; only advertise
  // Cmd+Enter as the documented shortcut even though both are wired.
  save.title = `${section.saveLabel} (Cmd/Ctrl+Enter)`;
  if (isSaving) {
    save.setAttribute("aria-busy", "true");
  }
  save.addEventListener(
    "click",
    () => {
      if (!validateSectionRequiredFields(section.id)) return;
      options.onSaveSection(section.id);
    },
    { signal },
  );

  const shortcut = document.createElement("kbd");
  shortcut.className = "settings-actions-shortcut";
  shortcut.setAttribute("aria-hidden", "true");
  shortcut.textContent = "⌘↵";

  actions.append(revert, save, shortcut);
  // The Save button itself flips to "Saving\u2026" + aria-busy while in flight,
  // so a separate .settings-saving-indicator span would be redundant.

  return actions;
}

function buildDevTools(
  section: SettingsSectionDefinition,
  drafts: Record<string, string>,
  state: SettingsState,
  options: SettingsRenderOptions,
  signal: AbortSignal,
): HTMLElement {
  const devTools = document.createElement("details");
  devTools.className = "settings-dev-tools";
  devTools.open = state.expandedDiffs.has(section.id) || state.expandedPaths.has(section.id);

  const devSummary = document.createElement("summary");
  devSummary.textContent = "Developer tools";
  devTools.append(devSummary);

  const devBody = document.createElement("div");
  devBody.className = "settings-dev-body";

  const devActions = document.createElement("div");
  devActions.className = "settings-dev-actions";

  const pathToggle = createSectionAction(state.expandedPaths.has(section.id) ? "Hide paths" : "View config paths");
  pathToggle.addEventListener("click", () => options.onTogglePaths(section.id), { signal });

  const diffToggle = createSectionAction(state.expandedDiffs.has(section.id) ? "Hide diff" : "Show diff");
  diffToggle.addEventListener("click", () => options.onToggleDiff(section.id), { signal });

  devActions.append(pathToggle, diffToggle);
  devBody.append(devActions);

  if (state.expandedPaths.has(section.id)) {
    const paths = document.createElement("div");
    paths.className = "settings-paths";
    buildUnderlyingPaths(section).forEach((path) => {
      const chip = document.createElement("span");
      chip.className = "mc-badge";
      chip.textContent = path;
      paths.append(chip);
    });
    devBody.append(paths);
  }

  if (state.expandedDiffs.has(section.id)) {
    const diff = document.createElement("pre");
    diff.className = "config-code settings-diff";
    diff.textContent = buildSectionDiffPreview(section, drafts, state.effective, state.overlay);
    devBody.append(diff);
  }

  devTools.append(devBody);
  return devTools;
}

function createGroupElement(
  section: SettingsSectionDefinition,
  group: ReturnType<typeof sectionGroups>[number],
  drafts: Record<string, string>,
  state: SettingsState,
  options: SettingsRenderOptions,
  first: boolean,
  prevTier?: string,
): HTMLElement {
  const tier = group.tier ?? (group.advanced ? "expert" : "essential");

  // Expert tier → collapsible <details> with persisted open state
  if (tier === "expert") {
    const details = document.createElement("details");
    details.className = "settings-group-collapsed";
    const key = `${section.id}:${group.id}`;
    details.open = state.openExperts.has(key);
    details.addEventListener("toggle", () => {
      if (details.open) state.openExperts.add(key);
      else state.openExperts.delete(key);
    });

    const summary = document.createElement("summary");
    summary.textContent = group.title;
    summary.setAttribute("aria-label", group.title);
    if (group.description) {
      summary.dataset.description = group.description;
    }
    details.append(summary, createGroupGrid(section, group, drafts, state, options));
    return details;
  }

  const wrapper = document.createElement("section");
  wrapper.className = "settings-group";

  // Standard tier → add a dashed separator if previous group was essential
  if (tier === "standard" && prevTier === "essential") {
    const sep = document.createElement("hr");
    sep.className = "settings-tier-separator";
    wrapper.append(sep);
  }

  if (group.title !== "Settings") {
    const heading = document.createElement("div");
    heading.className = "settings-group-heading";
    if (first) {
      heading.classList.add("is-first");
    }

    const title = document.createElement("h3");
    title.textContent = group.title;
    heading.append(title);

    if (group.description) {
      const desc = document.createElement("p");
      desc.className = "settings-group-desc";
      appendDescriptionWithLinks(desc, group.description);
      heading.append(desc);
    }
    wrapper.append(heading);
  }

  wrapper.append(createGroupGrid(section, group, drafts, state, options));
  return wrapper;
}

function createGroupGrid(
  section: SettingsSectionDefinition,
  group: ReturnType<typeof sectionGroups>[number],
  drafts: Record<string, string>,
  state: SettingsState,
  options: SettingsRenderOptions,
): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "form-grid settings-grid";

  group.fields.forEach((field) => {
    const actionKind = field.actionKind;
    const hintId = `settings-hint-${field.path.replaceAll(".", "-")}`;
    grid.append(
      createSettingsField(field, {
        value: drafts[field.path] ?? "",
        hintId,
        onInput: (value) => options.onDraftChange(section.id, field.path, value),
        onFocus: () => options.onFocusSection(section.id),
        onAction:
          actionKind && options.onFieldAction
            ? () => options.onFieldAction?.(section.id, field.path, actionKind)
            : undefined,
      }),
    );
  });

  return grid;
}

/**
 * Render a group description that may contain bare https?:// URLs as a mix
 * of text nodes and anchor elements. Preserves newlines (CSS handles via
 * white-space: pre-line on .settings-group-desc).
 *
 * URL detection is greedy on non-whitespace then trims trailing sentence
 * punctuation, so "Visit https://api.example.com/foo. Then..." links to
 * the full URL without swallowing the period.
 */
function appendDescriptionWithLinks(target: HTMLElement, description: string): void {
  const urlPattern = /https?:\/\/\S+/g;
  const trailingPunctuation = /[.,;:!?)\]]+$/;
  let cursor = 0;
  for (const match of description.matchAll(urlPattern)) {
    const start = match.index;
    let raw = match[0];
    const trail = raw.match(trailingPunctuation);
    if (trail) raw = raw.slice(0, raw.length - trail[0].length);

    if (start > cursor) {
      target.append(document.createTextNode(description.slice(cursor, start)));
    }
    const link = document.createElement("a");
    link.href = raw;
    link.textContent = raw;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "settings-group-desc-link";
    target.append(link);
    cursor = start + raw.length;
  }
  if (cursor < description.length) {
    target.append(document.createTextNode(description.slice(cursor)));
  }
}

/**
 * Coaching copy (toolbar hint, per-section next-step lines) is shown for the
 * first N visits, then suppressed so returning operators stop reading
 * tutorial text every time they bump a value. The on-demand toggle
 * (createCoachingToggle) lets a returning operator re-enable it without
 * clearing localStorage.
 */
const COACHING_VISIT_THRESHOLD = 3;
const COACHING_OVERRIDE_KEY = "risoluto.settings.coachingOverride";

function showCoachingCopy(): boolean {
  try {
    if (localStorage.getItem(COACHING_OVERRIDE_KEY) === "on") return true;
    const visits = Number.parseInt(localStorage.getItem("risoluto.settings.visitCount") ?? "0", 10);
    return !Number.isFinite(visits) || visits <= COACHING_VISIT_THRESHOLD;
  } catch {
    return true;
  }
}

function readCoachingOverride(): boolean {
  try {
    return localStorage.getItem(COACHING_OVERRIDE_KEY) === "on";
  } catch {
    return false;
  }
}

function writeCoachingOverride(on: boolean): void {
  try {
    if (on) localStorage.setItem(COACHING_OVERRIDE_KEY, "on");
    else localStorage.removeItem(COACHING_OVERRIDE_KEY);
  } catch {
    // localStorage unavailable; toggle is session-only
  }
}

/**
 * On-demand coaching toggle. After the visit-count threshold expires, the
 * toolbar hint and next-step hints disappear. This "?" button lets a
 * returning operator re-enable them on demand and persists the choice.
 */
function createCoachingToggle(signal: AbortSignal): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "settings-coaching-toggle";
  const isOn = readCoachingOverride();
  button.classList.toggle("is-active", isOn);
  button.setAttribute("aria-pressed", isOn ? "true" : "false");
  button.setAttribute("aria-label", isOn ? "Hide coaching hints" : "Show coaching hints");
  button.title = isOn ? "Hide coaching hints" : "Show keyboard shortcuts and next-step hints";
  button.textContent = "?";
  button.addEventListener(
    "click",
    () => {
      writeCoachingOverride(!readCoachingOverride());
      window.dispatchEvent(new CustomEvent("risoluto:settings-coaching-changed"));
    },
    { signal },
  );
  return button;
}

function createNextStepHint(sectionId: string): HTMLElement | null {
  if (!showCoachingCopy()) {
    return null;
  }
  const text =
    sectionId === SECTION_IDS.TRACKER
      ? "Next: choose a model provider and sign-in method."
      : sectionId === SECTION_IDS.MODEL_PROVIDER_AUTH
        ? "Next: review sandbox defaults so runs use the safety level you expect."
        : null;

  if (!text) {
    return null;
  }

  const hint = document.createElement("p");
  hint.className = "settings-next-step";
  hint.textContent = text;
  return hint;
}
