# Symphony Design System Cleanup Plan

> Generated from CSS consolidation + component extraction analysis
> Date: 2026-03-21

---

## Overview

The Symphony frontend has a mature but fragmented design system. Two parallel component vocabularies coexist — an older generic layer (`.btn`, `.card`, `.input`) and the newer `mc-*` component-modifier system. Additionally, shell-specific classes duplicate shared primitives, and page-controller logic is reimplemented across views.

**Goal:** Consolidate onto the `mc-*` system, extract shared page-controller utilities, and eliminate duplicate declarations.

**Estimated total effort:** 15-25 hours across 4 phases.

---

## Phase 1: Quick Wins — Remove Duplicates & Tokenize

**Effort:** 1-2 hours
**Risk:** Low (removing unused duplicates, replacing hard-coded values with existing tokens)

### 1.1 Remove exact duplicate CSS declarations

| Action | File                                 | Lines   | Details                                                                                                                               |
| ------ | ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Remove | `frontend/src/styles/components.css` | 448-464 | Delete `.mc-button-ghost`, `.mc-button-ghost:hover`, `.mc-button-ghost.is-active` — duplicates `.mc-button.is-ghost` at lines 344-360 |
| Remove | `frontend/src/styles/components.css` | 724-741 | Delete legacy `.status-chip`, `.filter-chip`, `.event-chip`, `.inline-badge`, `.priority-badge` block — duplicates mc-badge system    |
| Remove | `frontend/src/styles/components.css` | 743-827 | Delete `.status-chip` through `.status-pending_change` — duplicates mc-badge status variants                                          |
| Remove | `frontend/src/styles/primitives.css` | 127-139 | Delete `.status-chip`, `.status-chip-dot` — moved to components.css                                                                   |
| Remove | `frontend/src/styles/primitives.css` | 283-307 | Delete `.filter-chip`, hover, active — moved to components.css                                                                        |
| Remove | `frontend/src/styles/primitives.css` | 588-596 | Delete `@keyframes skeletonPulse` — duplicates animations.css                                                                         |
| Remove | `frontend/src/styles/components.css` | 106-112 | Remove `.mc-log-row` from legacy alias block (keep `.issue-card`, `.attempts-table`, `.event-row` for now)                            |

**Verification:** Run `pnpm run build` and check dashboard renders correctly.

### 1.2 Tokenize hard-coded dimensions

| Action  | File                                            | Current                     | Replace With                                                        |
| ------- | ----------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| Replace | `frontend/src/styles/shell.css:393`             | `height: 32px`              | `height: var(--control-height-sm)`                                  |
| Replace | `frontend/src/styles/shell.css:419-420`         | `width: 32px; height: 32px` | `width: var(--control-height-sm); height: var(--control-height-sm)` |
| Replace | `frontend/src/styles/design-system.css:459-460` | `width: 36px; height: 36px` | `width: var(--control-height-md); height: var(--control-height-md)` |
| Replace | `frontend/src/styles/primitives.css:279`        | `min-height: 44px`          | `min-height: var(--control-height-xl)`                              |
| Replace | `frontend/src/styles/primitives.css:153`        | `width: 360px`              | Keep (toast width — no token equivalent yet)                        |
| Replace | `frontend/src/styles/primitives.css:321`        | `width: 480px`              | Keep (drawer width — no token equivalent yet)                       |

### 1.3 Use existing status tokens in dark badge colors

**File:** `frontend/src/styles/design-system.css:390-405`

Replace hard-coded dark badge colors with `color-mix()` using existing tokens:

```css
/* Before */
[data-theme="dark"] .badge-success {
  background: rgba(47, 158, 68, 0.15);
  color: #4db86a;
}

/* After */
[data-theme="dark"] .badge-success {
  background: color-mix(in srgb, var(--status-running) 15%, transparent);
  color: var(--status-running);
}
```

Apply same pattern to `.badge-warning`, `.badge-danger`, `.badge-info`.

---

## Phase 2: Shell Consolidation — Unify Header onto mc-\* System

**Effort:** 2-4 hours
**Risk:** Medium (touches shell layout and header components)

### 2.1 Unify `.header-action-btn`

**Current state:** Defined in both `components.css:466-490` and `shell.css:418-440` with minor differences.

**Action:**

1. Remove `components.css:466-490` (`.header-action-btn`, hover, svg)
2. Keep `shell.css:418-440` as canonical
3. Refactor to extend `.mc-button.is-icon-only.is-sm`:

```css
/* shell.css — new canonical definition */
.header-action-btn {
  composes: mc-button is-icon-only is-sm;
  /* shell-specific overrides only */
  width: var(--control-height-sm);
  height: var(--control-height-sm);
  border-color: transparent;
  color: var(--text-muted);
}
```

If `composes` isn't available (plain CSS), keep shell.css definition but add comment:

```css
/* Extends mc-button.is-icon-only.is-sm — shell-specific overrides only */
```

### 2.2 Unify `.header-command-trigger`

**Current state:** Defined in `components.css:492-512`, `shell.css:387-406`, and overlaps with `.mc-button.is-command`.

**Action:**

1. Remove `components.css:492-512`
2. Refactor `shell.css:387-406` to use `.mc-button.is-command` as base:

```css
/* shell.css — shell-specific command trigger */
.header-command-trigger {
  /* Inherits from mc-button.is-command via HTML: class="mc-button is-command header-command-trigger" */
  /* Only shell layout overrides here */
  height: var(--control-height-sm);
  font-size: var(--text-ui);
}

.header-command-hint {
  /* Maps to mc-button-hint */
  composes: mc-button-hint;
}
```

### 2.3 Unify `.header-env-badge`

**Current state:** Shell-specific, uses hard-coded color-mix values.

**Action:** Tokenize internal values — replace hard-coded `color-mix(in srgb, var(--status-running) 12%, var(--bg-elevated))` with a semantic token or keep as-is (already using CSS variables).

### 2.4 Update HTML templates

**Files to update:**

- `frontend/src/ui/header.ts` — update class names to use `mc-button is-icon-only is-sm` instead of `header-action-btn`
- `frontend/src/ui/shell.ts` — update command trigger to use `mc-button is-command`

**Verification:** Visual regression test with `agent-browser` screenshots.

---

## Phase 3: Component Extraction — Shared Page-Controller Utilities

**Effort:** 4-8 hours
**Risk:** Medium (new files, refactor existing views)

### 3.1 Extract async page loader

**New file:** `frontend/src/ui/async-resource.ts`

```typescript
interface AsyncResourceOptions<T> {
  load: () => Promise<T>;
  render: (data: T) => string;
  renderLoading?: () => string;
  renderError?: (error: string) => string;
  renderEmpty?: () => string;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  autoLoad?: boolean;
}

export function createAsyncResource<T>(options: AsyncResourceOptions<T>): {
  load: () => Promise<void>;
  getState: () => { data: T | null; error: string | null; loading: boolean };
  render: () => string;
};
```

**Migration targets (8 files):**

- `frontend/src/views/settings-view.ts`
- `frontend/src/views/config-view.ts`
- `frontend/src/views/secrets-view.ts`
- `frontend/src/views/planner-view.ts`
- `frontend/src/views/observability-view.ts`
- `frontend/src/views/runs-view.ts`
- `frontend/src/views/attempt-view.ts`
- `frontend/src/pages/logs-view.ts`

### 3.2 Extract keyboard binding lifecycle

**New file:** `frontend/src/ui/keyboard-scope.ts`

```typescript
interface KeyboardScopeOptions {
  target?: Window | Document | HTMLElement;
  ignoreInputs?: boolean;
  scope?: string; // route/page scope
}

export function registerKeyboardScope(
  handler: (event: KeyboardEvent) => void,
  options?: KeyboardScopeOptions,
): () => void; // returns cleanup function
```

**Migration targets (7 files):**

- `frontend/src/views/settings-view.ts`
- `frontend/src/views/config-view.ts`
- `frontend/src/views/secrets-view.ts`
- `frontend/src/views/planner-view.ts`
- `frontend/src/views/observability-view.ts`
- `frontend/src/views/runs-view.ts`
- `frontend/src/pages/queue-view.ts`

### 3.3 Extract keyboard command map helper

**New file:** `frontend/src/ui/keyboard-commands.ts`

```typescript
interface CommandMap {
  [key: string]: () => void;
}

export function createKeyboardCommandMap(
  map: CommandMap,
  options?: { preventDefault?: boolean },
): (event: KeyboardEvent) => void;
```

**Migration targets (6 files):**

- `frontend/src/views/settings-keyboard.ts`
- `frontend/src/views/config-keyboard.ts`
- `frontend/src/views/secrets-keyboard.ts`
- `frontend/src/views/planner-keyboard.ts`
- `frontend/src/views/observability-keyboard.ts`
- `frontend/src/pages/queue-keyboard.ts`

### 3.4 Extract modal confirmation renderer

**New file:** `frontend/src/ui/confirm-modal.ts`

```typescript
interface ConfirmModalOptions {
  title: string;
  body: string | (() => string);
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "warning";
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
}

export function renderConfirmModal(options: ConfirmModalOptions): string;
export function openConfirmModal(options: ConfirmModalOptions): void;
```

**Migration targets (4-5 files):**

- `frontend/src/views/config-view.ts` — delete overlay path modal
- `frontend/src/views/secrets-modals.ts` — add/delete secret modals
- `frontend/src/views/planner-view.ts` — execute plan modal

### 3.5 Extract search/chip toolbar primitives

**New file:** `frontend/src/ui/search-toolbar.ts`

```typescript
interface SearchToolbarOptions {
  placeholder?: string;
  value?: string;
  onSearch: (query: string) => void;
  chips?: ChipOption[];
  actions?: string; // HTML for action buttons
}

interface ChipOption {
  label: string;
  value: string;
  active?: boolean;
  onClick: () => void;
}

export function renderSearchToolbar(options: SearchToolbarOptions): string;
export function renderChipFilterGroup(chips: ChipOption[]): string;
```

**Migration targets (4 files):**

- `frontend/src/pages/queue-toolbar.ts`
- `frontend/src/views/settings-sections.ts`
- `frontend/src/pages/logs-view.ts`
- `frontend/src/views/notifications-view.ts`

### 3.6 Extract drawer/overlay primitive

**New file:** `frontend/src/ui/overlay.ts`

```typescript
interface OverlayOptions {
  mode: "drawer" | "modal" | "palette";
  position?: "left" | "right";
  width?: string;
  onClose: () => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}

export function createOverlay(options: OverlayOptions): {
  open: () => void;
  close: () => void;
  render: (content: string) => string;
  isOpen: () => boolean;
};
```

**Migration targets (3 files):**

- `frontend/src/pages/queue-view.ts`
- `frontend/src/views/observability-raw-drawer.ts`
- `frontend/src/ui/command-palette.ts`

### 3.7 Extract async panel state renderer

**New file:** `frontend/src/ui/async-panel.ts`

```typescript
interface AsyncPanelState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

export function renderAsyncPanel<T>(
  state: AsyncPanelState<T>,
  options: {
    renderContent: (data: T) => string;
    renderLoading?: () => string;
    renderError?: (error: string) => string;
    renderEmpty?: () => string;
  },
): string;
```

**Migration targets (8+ files):**

- `frontend/src/views/runs-view.ts`
- `frontend/src/views/attempt-view.ts`
- `frontend/src/views/planner-content.ts`
- `frontend/src/pages/logs-view.ts`
- `frontend/src/pages/overview-view.ts`
- `frontend/src/views/workspaces-view.ts`
- `frontend/src/views/containers-view.ts`
- `frontend/src/views/git-view.ts`

### 3.8 Extract placeholder admin page scaffold

**New file:** `frontend/src/ui/placeholder-page.ts`

```typescript
interface PlaceholderPageOptions {
  title: string;
  subtitle?: string;
  icon?: string;
  summaryItems?: SummaryItem[];
  emptyStateTitle?: string;
  emptyStateBody?: string;
  topControls?: string;
}

export function renderPlaceholderPage(options: PlaceholderPageOptions): string;
```

**Migration targets (4 files):**

- `frontend/src/views/workspaces-view.ts`
- `frontend/src/views/containers-view.ts`
- `frontend/src/views/git-view.ts`
- `frontend/src/views/notifications-view.ts`

---

## Phase 4: Structural Cleanup — Rail Items, Tokens, Deprecate Old DS

**Effort:** 6-10 hours
**Risk:** High (affects navigation, theming, and many components)

### 4.1 Unify rail items onto `.mc-rail-item`

**Current state:** `.sidebar-item`, `.settings-rail-item`, `.config-rail-item` all reimplement rail-item behavior.

**Action:**

1. **Refactor `.sidebar-item`** (shell.css:116-228):
   - Keep only shell-specific overrides (expanded/collapsed behavior, group integration)
   - Base styling should use `.mc-rail-item.is-lg` via HTML composition: `class="sidebar-item mc-rail-item is-lg has-icon"`

2. **Refactor `.settings-rail-item`** (primitives.css:471-497):
   - Convert to `.mc-rail-item.is-settings` modifier
   - Remove standalone definition

3. **Refactor `.config-rail-item`** (primitives.css:499-517):
   - Convert to `.mc-rail-item.is-config` modifier
   - Remove standalone definition

**Files to update:**

- `frontend/src/ui/sidebar.ts`
- `frontend/src/views/settings-view.ts`
- `frontend/src/views/config-view.ts`

### 4.2 Rationalize token ownership

**Problem:** `tokens.css` overrides foundational tokens from `design-system.css`, creating "same name, two meanings" confusion.

**Action:**

1. **Rename typography overrides** in `tokens.css`:
   - `--text-xs` → keep in `design-system.css` (remove override)
   - `--text-sm` → keep in `design-system.css` (remove override)
   - App-specific sizes should use new names: `--text-2xs`, `--text-xxs`, `--text-ui`, `--text-sm-plus`

2. **Fix `--border-strong` alias:**

   ```css
   /* Before (misleading) */
   --border-strong: var(--border-subtle);

   /* After (accurate) */
   --border-emphasis: var(--border-subtle);
   ```

   Then grep for all `--border-strong` usage and replace with `--border-emphasis`.

3. **Document token hierarchy:**
   - `design-system.css` = foundational tokens (never override)
   - `tokens.css` = app-specific extensions (new names only)

### 4.3 Deprecate old generic DS vocabulary

**Files affected:** `design-system.css`

**Action:**

1. Add deprecation comments to old classes:

   ```css
   /* @deprecated — use .mc-button.is-primary instead */
   .btn-primary { ... }
   ```

2. Create a migration checklist:

| Old Class           | New Replacement                    | Migration                                 |
| ------------------- | ---------------------------------- | ----------------------------------------- |
| `.btn`              | `.mc-button`                       | `class="mc-button"`                       |
| `.btn-primary`      | `.mc-button.is-primary`            | `class="mc-button is-primary"`            |
| `.btn-secondary`    | `.mc-button` (default)             | `class="mc-button"`                       |
| `.btn-ghost`        | `.mc-button.is-ghost`              | `class="mc-button is-ghost"`              |
| `.btn-icon`         | `.mc-button.is-icon-only`          | `class="mc-button is-icon-only"`          |
| `.card`             | `.mc-panel` or `.surface-standard` | `class="mc-panel"`                        |
| `.card-interactive` | `.mc-panel` + hover styles         | add `.is-interactive` if needed           |
| `.card-highlight`   | `.surface-primary`                 | `class="surface-primary"`                 |
| `.card-warning`     | `.mc-container` + status           | `class="mc-container is-status-retrying"` |
| `.card-empty`       | `.mc-empty-state`                  | `class="mc-empty-state"`                  |
| `.input`            | `.mc-input`                        | `class="mc-input"`                        |
| `.select`           | `.mc-select`                       | `class="mc-select"`                       |
| `.textarea`         | `.mc-input`                        | `class="mc-input"`                        |
| `.status-dot-*`     | `.mc-badge.has-dot` + status       | `class="mc-badge has-dot is-status-*"`    |
| `.badge`            | `.mc-badge`                        | `class="mc-badge"`                        |
| `.pill`             | `.mc-chip`                         | `class="mc-chip"`                         |
| `.badge-success`    | `.mc-badge.is-status-running`      | status semantic                           |
| `.badge-warning`    | `.mc-badge.is-status-retrying`     | status semantic                           |
| `.badge-danger`     | `.mc-badge.is-status-blocked`      | status semantic                           |
| `.badge-info`       | `.mc-badge.is-status-queued`       | status semantic                           |

3. **Grep for usage** of old classes in TypeScript files and update to new classes.

4. **After migration complete:** Remove old class definitions from `design-system.css`.

### 4.4 Consolidate reduced-motion handling

**Current state:** Fragmented across 4 files.

**Action:**

1. Move all `@media (prefers-reduced-motion: reduce)` blocks to `animations.css`
2. Keep only local animation definitions in their original files
3. Central policy file: `animations.css`

---

## Execution Order

```
Phase 1 (1-2h) ──► Phase 2 (2-4h) ──► Phase 3 (4-8h) ──► Phase 4 (6-10h)
   Low risk           Medium risk         Medium risk         High risk
   CSS only           Shell + CSS         New files + TS      Navigation + tokens
```

**Recommended approach:**

1. Do Phase 1 immediately — safe, no behavior change
2. Do Phase 2 after Phase 1 is verified — shell consolidation
3. Do Phase 3 incrementally — extract one utility at a time, migrate callers
4. Do Phase 4 last — requires careful testing of navigation and theming

---

## Verification Checklist

After each phase:

- [ ] `pnpm run build` succeeds
- [ ] `pnpm test` passes
- [ ] Dashboard renders correctly (visual check)
- [ ] Light/dark theme toggle works
- [ ] All keyboard shortcuts still function
- [ ] Sidebar expand/collapse works
- [ ] No LSP diagnostics errors on changed files

---

## Files Summary

### Files to modify:

- `frontend/src/styles/components.css` — remove duplicates, legacy aliases
- `frontend/src/styles/primitives.css` — remove moved classes, tokenize values
- `frontend/src/styles/shell.css` — unify onto mc-\* system
- `frontend/src/styles/design-system.css` — deprecate old classes, fix dark badges
- `frontend/src/styles/tokens.css` — rationalize token ownership
- `frontend/src/styles/animations.css` — centralize reduced-motion
- `frontend/src/ui/header.ts` — update class names
- `frontend/src/ui/shell.ts` — update class names
- `frontend/src/ui/sidebar.ts` — refactor onto mc-rail-item
- 6 keyboard files — refactor onto command map helper
- 8 view/page files — refactor onto async resource helper

### New files to create:

- `frontend/src/ui/async-resource.ts`
- `frontend/src/ui/keyboard-scope.ts`
- `frontend/src/ui/keyboard-commands.ts`
- `frontend/src/ui/confirm-modal.ts`
- `frontend/src/ui/search-toolbar.ts`
- `frontend/src/ui/overlay.ts`
- `frontend/src/ui/async-panel.ts`
- `frontend/src/ui/placeholder-page.ts`
