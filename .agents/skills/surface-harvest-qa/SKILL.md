---
name: surface-harvest-qa
description: Build an exhaustive desktop-only surface inventory for a web app, then run systematic interaction coverage across every discovered surface. Use when the user asks to map all pages, states, dialogs, menus, forms, and flows of an app; wants a very long list of all app surfaces; wants exhaustive QA or "test every interaction"; or wants to combine dogfood-style exploration, ui-test-style structured coverage, and expect-style adversarial browser testing into one workflow. Prefer this skill whenever breadth of UI coverage matters more than a small targeted smoke test.
---

# Surface Harvest QA

Create a complete-enough surface model of the app before claiming broad coverage.

This skill intentionally combines the strengths of three existing skills:

- `dogfood` pattern: breadth-first exploration, repro-first evidence, human-readable issue capture
- `ui-test` pattern: explicit planning rounds, structured assertions, explicit skipped gaps
- `expect` pattern: adversarial browser testing against realistic user behavior

For this skill, the default target is:

- desktop only
- headed browsers
- `2560x1440`
- no mobile or responsive passes unless the user explicitly asks

## Honesty Rule

Never claim "100% of the app" in the abstract.

The strongest truthful claim is:

`100% of discovered and modeled desktop surfaces were assigned a status: PASS, FAIL, BLOCKED, or SKIPPED.`

If a state cannot be reached from the UI, requires special seed data, depends on a hidden feature flag, or needs a different account role, mark it `BLOCKED` with the reason. Do not silently omit it.

## Tool Split

Use each tool for what it is best at:

- `agent-browser`: discover routes, menus, dialogs, drawers, tabs, forms, and collect screenshots/videos for repro
- `browse`: run structured step-by-step assertions with explicit pass/fail markers and coverage accounting
- `expect-cli`: run adversarial end-to-end checks on high-risk or high-value surface clusters

If these tools disagree, prefer the more reproducible evidence source:

1. deterministic browser state or DOM/eval result
2. before/after accessibility snapshots
3. screenshots and video
4. plain-language impression

## Desktop Baseline

Always start sessions in headed desktop mode.

### `browse` setup

```bash
browse env local
browse --headed open http://localhost:3000
browse viewport 2560 1440
```

### `agent-browser` setup

```bash
agent-browser --session surface-harvest --headed open http://localhost:3000
agent-browser --session surface-harvest set viewport 2560 1440
```

### `expect-cli` setup

```bash
expect --headed -u http://localhost:3000 -m "..." -y
```

`expect-cli` exposes `--headed`, but its help output does not expose a viewport flag. Treat it as headed desktop verification, not as the source of truth for pixel-exact `2560x1440` coverage.

## Required Outputs

Create these artifacts inside a working directory such as `.context/surface-harvest/` or another user-requested output path:

- `surface-manifest.md`
- `coverage-summary.md`
- `issues.md`
- `screenshots/`
- `videos/`

Use the template at `templates/surface-manifest-template.md`.

## What Counts As A Surface

A surface is any user-reachable UI state or interaction boundary that deserves independent coverage. Include at minimum:

- routes and top-level pages
- authenticated and unauthenticated entry points
- tabs, accordions, drawers, popovers, dropdowns, menus, tooltips, and modals
- create, edit, duplicate, archive, delete, confirm, cancel flows
- search, sort, filter, pagination, bulk actions
- empty, loading, success, validation, error, retry, and disabled states
- row actions, context menus, inline edits, detail panels
- file upload, download, date pickers, rich text editors, keyboard shortcuts
- toast-triggering actions and background refresh states
- permission- or role-gated surfaces
- 404, forbidden, offline, and broken-request states if reachable

Do not treat a page as one surface. Split it into meaningful sub-surfaces.

## Workflow

## Phase 1: Build the surface graph

Start breadth-first. Do not jump into deep testing before the inventory exists.

1. Open the app in headed desktop mode.
2. Identify all top-level navigation entries and entry URLs.
3. Visit each top-level section.
4. On each page, snapshot interactive elements and record:
   - links
   - buttons
   - inputs
   - tablists
   - menus
   - dialogs
   - inline actions
5. Expand hidden surfaces by interacting with:
   - overflow menus
   - "more" buttons
   - tabs
   - dropdowns
   - row kebabs
   - drawers and modals
6. Add every newly revealed surface to the manifest immediately.

Useful `agent-browser` commands:

```bash
agent-browser --session surface-harvest snapshot -i
agent-browser --session surface-harvest screenshot --annotate .context/surface-harvest/screenshots/home.png
agent-browser --session surface-harvest console
agent-browser --session surface-harvest errors
```

## Phase 2: Expand each surface into a state matrix

For each surface, explicitly model the states that need coverage.

Use this default matrix where relevant:

- `default`
- `hover/focus`
- `empty`
- `loading`
- `populated`
- `invalid`
- `submitting`
- `success`
- `error`
- `destructive-confirm`
- `cancelled`
- `permission-denied`

Not every surface needs every state, but every surface needs a deliberate decision. If a state does not apply, mark it `N/A`.

## Phase 3: Plan execution like `ui-test`, but desktop only

Do three planning rounds before execution.

### Round 1: Functional

For each surface, write action -> expected result checks.

### Round 2: Adversarial

Re-read Round 1 and add:

- empty inputs
- long inputs
- special characters
- double clicks
- rapid repeated actions
- cancel mid-flow
- back/forward navigation
- refresh persistence
- stale state and race-condition probes

### Round 3: Desktop coverage gaps

Re-read Rounds 1-2 and add:

- keyboard-only navigation
- visible focus states
- console errors
- failed network reactions if observable
- visual regressions at desktop width
- modal focus trap and escape handling

Do not add mobile checks in this round unless the user explicitly asks.

Merge the three rounds into one numbered test list and assign every test to a surface ID from the manifest.

## Phase 4: Run structured checks with `browse`

Use `browse` for systematic assertion accounting. For each surface cluster:

1. capture before state
2. perform exactly one interaction
3. capture after state
4. emit a status marker

Marker format:

```text
STEP_PASS|<surface-id>|<evidence>
STEP_FAIL|<surface-id>|<expected> -> <actual>|<screenshot-path>
STEP_SKIP|<surface-id>|<reason>
STEP_BLOCKED|<surface-id>|<reason>
```

Failure screenshot rule:

```bash
mkdir -p .context/surface-harvest/screenshots
browse screenshot .context/surface-harvest/screenshots/<surface-id>.png
```

Every surface in the manifest must end with one terminal status:

- `PASS`
- `FAIL`
- `BLOCKED`
- `SKIPPED`

No silent omissions.

## Phase 5: Run adversarial `expect-cli` sweeps on high-risk clusters

After the structured pass, run `expect-cli` against the clusters most likely to hide coupled regressions:

- auth and onboarding
- creation/edit/delete flows
- settings and preference saves
- dense tables with row actions
- search/filter/sort experiences
- billing, permissions, or destructive actions

Write adversarial prompts, not shallow smoke prompts.

Good:

```bash
expect --headed -u http://localhost:3000 -m "On the projects area, create a record with valid data, then edit it with invalid data, cancel once mid-flow, retry with valid data, use search and sort to find it, open row actions, attempt delete then cancel, then confirm delete and verify the row disappears without console errors" -y
```

Bad:

```bash
expect --headed -u http://localhost:3000 -m "Check that the projects page works" -y
```

Do not let `expect-cli` replace the manifest. It validates clusters; it does not define coverage.

## Phase 6: Close coverage gaps explicitly

At the end, compute:

- total surfaces discovered
- passed
- failed
- blocked
- skipped
- pass rate across executable surfaces
- coverage rate across discovered surfaces

If coverage is not complete, list the exact missing surfaces and why:

- missing credentials
- missing seed data
- unreachable feature flag
- backend error prevented setup
- step budget exhausted

## Manifest Discipline

Every manifest entry must include:

- `surface_id`
- `parent_surface`
- `entry_url`
- `entry_action`
- `surface_type`
- `auth_role`
- `states`
- `interactions`
- `evidence_paths`
- `status`
- `notes`

If a surface creates another surface, record the edge. Example:

- `projects-table` -> opens -> `project-row-menu`
- `project-row-menu` -> opens -> `project-delete-confirm`

This is how you avoid pretending a page-level smoke test equals full coverage.

## Good Default Heuristics

- Prefer breadth before depth on the first pass.
- Split large pages into sub-surfaces before testing.
- Revisit clusters that spawn multiple child surfaces.
- When you see a data table, assume there are at least these surfaces:
  - empty state
  - populated table
  - row menu
  - sort
  - filter
  - pagination
  - detail or edit flow
- When you see a form, assume there are at least these surfaces:
  - pristine
  - invalid
  - submitting
  - success
  - server-error
  - cancel/reset

## Reporting Format

`coverage-summary.md` should contain:

```markdown
# Coverage Summary

- Target: <url>
- Mode: headed desktop
- Viewport: 2560x1440
- Total surfaces: <n>
- Passed: <n>
- Failed: <n>
- Blocked: <n>
- Skipped: <n>
- Coverage rate: <percent>
- Executable pass rate: <percent>

## Missing or blocked coverage
- <surface-id>: <reason>

## Highest-risk failures
- <surface-id>: <one-line summary>
```

`issues.md` should contain reproducible findings with:

- issue id
- affected surface id
- reproduction steps
- expected result
- actual result
- evidence paths

## Never Do This

- Do not claim "everything works" because top-level pages loaded.
- Do not collapse a whole route into one checkbox.
- Do not skip hidden UI such as row menus, drawers, or confirmation dialogs.
- Do not silently ignore states you could not reach.
- Do not add mobile checks when the user asked for desktop only.
- Do not let `expect-cli` be the only source of coverage accounting.

