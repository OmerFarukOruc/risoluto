---
name: surface-harvest-qa
description: >
  Exhaustive QA coverage for the Risoluto desktop UI — tests every route, modal, drawer,
  keyboard shortcut, and state variation at 2560x1440 and 1920x1080. Produces a surface
  manifest, HTML report with embedded screenshots, and detailed issue cards. Use when the
  user says "harvest", "surface coverage", "full QA pass", "test everything in the UI",
  "map all surfaces", or "run exhaustive QA". Not for mobile testing or unit/integration
  tests.
---

# Surface Harvest QA

Exhaustive desktop-only surface coverage for Risoluto. Uses `agent-browser` as the sole automation tool.

## Rules

**Honesty.** Never claim "100% of the app". The strongest truthful claim is: "100% of discovered and modeled desktop surfaces were assigned a terminal status." Terminal statuses are: PASS, FAIL, FLAKY, BLOCKED, SKIP. A surface without one is untested.

**No bulk PASS.** Each PASS requires that you navigated to the surface, verified its content rendered, and confirmed it behaves correctly. Before writing the manifest, count your PASS entries and compare to unique surface IDs in `session.jsonl`. If PASS count exceeds log entries — go back and either test the surface or mark it BLOCKED. Bulk-assigning PASS from a route screenshot is dishonest.

**Execute, don't punt.** You have API keys (`.env.seed`), seed scripts (`scripts/seed-test-data.sh`, `scripts/minimal-seed.sh`), and full CLI access. If a prerequisite is missing, create it via API. If a view needs data, seed it. If a command fails, retry differently. Never say "I can't because the view isn't ready" — make it ready yourself.

**Unblock, don't mark BLOCKED.** BLOCKED is a last resort, not a default. Before marking any surface BLOCKED:
- Need a running issue? Create one via `POST /api/v1/setup/create-test-issue` + `POST /api/v1/refresh`
- Need empty state? Clear filters, search for nonexistent text, or use `network route` to return empty arrays
- Need error state? Use `agent-browser network route "*/api/v1/<endpoint>" --abort` to simulate failures
- Need loading state? Use `agent-browser network route "*/api/v1/<endpoint>" --body '{}' --delay 5000` to slow responses
- Need a subsurface expanded? Click the tab/drawer/button yourself — don't mark it BLOCKED because it wasn't expanded in the default screenshot
- Need different data? Use `eval` to modify DOM state, or call the API to create/modify records

Only BLOCKED when something genuinely cannot be reached (e.g., feature behind a flag you can't set, or requires a real external service response). The goal is zero BLOCKED surfaces.

**Depth over breadth.** A single route tested fully (every subsurface expanded, screenshotted, interactions verified) is worth more than 10 routes screenshotted at top-level. Complete one route before moving to the next. If context gets tight, write the manifest with honest status and stop — the next run picks up via resume.

## Mandatory Artifact Gates

Do not write coverage-summary.md until all gates pass:

| Artifact | Gate |
|---|---|
| Screenshots | ≥1 `.png` per route visited at each viewport |
| session.jsonl | ≥1 line per surface tested (not `[]`) |
| surface-manifest.md | Every seed surface has a terminal status |
| issues.md | Every FAIL has a full issue entry |
| report.html | File exists and > 1KB |

```bash
echo "=== ARTIFACT GATE CHECK ==="
echo "Screenshots (2560): $(find "${RUN_DIR}/2560x1440/screenshots" -name '*.png' 2>/dev/null | wc -l)"
echo "Screenshots (1920): $(find "${RUN_DIR}/1920x1080/screenshots" -name '*.png' 2>/dev/null | wc -l)"
echo "Log entries: $(wc -l < "${RUN_DIR}/2560x1440/logs/session.jsonl" 2>/dev/null || echo 0)"
echo "PASS in manifest: $(grep -c 'PASS' "${RUN_DIR}/surface-manifest.md" 2>/dev/null || echo 0)"
echo "Surfaces in log: $(grep -oP '"surface_id":\s*"SURFACE-\d+"' "${RUN_DIR}/2560x1440/logs/session.jsonl" 2>/dev/null | sort -u | wc -l)"
```

## Core Principles

- **Verify before evidence.** Reproduce findings at least once before screenshotting. Mark unreproducible issues FLAKY with rate.
- **Explore like a user.** Follow workflows end-to-end. Use realistic data ("Fix login timeout bug" not "test123").
- **Check console after every interaction.** `agent-browser errors` after every meaningful action. New errors are findings even if the UI looks fine.
- **Write findings incrementally.** Append to `issues.md` and update `surface-manifest.md` as you go. Never batch to the end.
- **Type like a human in recordings.** Use `type` (character-by-character) during video; `fill` (bulk) outside recordings.

## Tool Reference

Uses `agent-browser` exclusively. See `references/tool-reference.md` for the full command set, screenshot path fallback, and content-wait strategy.

**After any DOM change**: old `@eN` refs are invalid — re-snapshot first.
**For 2+ sequential commands**: use `batch`.

## Session Logging

After every agent-browser action, log it with the helper script:
```bash
bash "${SKILL_DIR}/scripts/log-action.sh" "$LOG" "<phase>" "<surface-id>" "<action>" "<result>" [errors] [screenshot] [note]
```
The log is the resume checkpoint and the honesty check. Never skip it.

---

## Workflow

### Phase 1: Preflight + Auto-Seed

```bash
PORT="${APP_PORT:-4000}"
SKILL_DIR=".claude/skills/surface-harvest-qa"
LOG=""  # set per-viewport in Phase 2/3

agent-browser --version
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
RUN_DIR=".context/surface-harvest/run-${TIMESTAMP}"
mkdir -p "${RUN_DIR}/2560x1440/logs" "${RUN_DIR}/2560x1440/screenshots" "${RUN_DIR}/2560x1440/videos"
mkdir -p "${RUN_DIR}/1920x1080/logs" "${RUN_DIR}/1920x1080/screenshots" "${RUN_DIR}/1920x1080/videos"
ln -sfn "run-${TIMESTAMP}" .context/surface-harvest/latest
: > "${RUN_DIR}/2560x1440/logs/session.jsonl"
: > "${RUN_DIR}/1920x1080/logs/session.jsonl"

curl -sf "http://localhost:${PORT}/api/v1/state" | head -c 100
```

**Auto-seed:** If `.env.seed` exists, source it and run the full seed script. Otherwise run the minimal seed. If setup is incomplete and no API keys are available, mark the run BLOCKED.

```bash
if [[ -f ".env.seed" ]]; then
  set -a; source .env.seed; set +a  # export all vars for child processes
  bash "${SKILL_DIR}/scripts/seed-test-data.sh" "${PORT}"
elif [[ -f "${SKILL_DIR}/scripts/minimal-seed.sh" ]]; then
  bash "${SKILL_DIR}/scripts/minimal-seed.sh" "${PORT}" || {
    echo "BLOCKED: Prerequisites missing and no .env.seed found."; exit 1
  }
fi
```

Read `references/surface-seed.md` and `references/prerequisites.md` to understand the surface inventory and data requirements.

### Phase 2: Per-Route Deep Test

This is the main loop. It merges discovery, state expansion, interaction testing, and adversarial probes into a single depth-first pass per route.

```bash
agent-browser --session shqa-2560 --headed open http://localhost:${PORT}
agent-browser --session shqa-2560 set viewport 2560 1440
agent-browser --session shqa-2560 wait --load networkidle
agent-browser --session shqa-2560 console --clear
LOG="${RUN_DIR}/2560x1440/logs/session.jsonl"
```

Load `references/surface-seed.md` (v1.0.0, ~253 surfaces) as the starting inventory.

**For each route in the seed**, execute this loop:

#### Step 1 — Navigate and verify content

```bash
agent-browser --session shqa-2560 open "http://localhost:${PORT}<route>"
agent-browser --session shqa-2560 wait --load networkidle
agent-browser --session shqa-2560 wait 300
SNAP=$(agent-browser --session shqa-2560 snapshot -i 2>&1)
echo "$SNAP" | head -20  # verify real content, not "Loading..."
```

If the snapshot shows a spinner or empty content, wait longer and re-snapshot. Only proceed when real content is visible.

#### Step 2 — Screenshot default state

```bash
mkdir -p "${RUN_DIR}/2560x1440/screenshots/<route>"
TARGET="${RUN_DIR}/2560x1440/screenshots/<route>/<SURFACE-ID>-default.png"
agent-browser --session shqa-2560 screenshot "${TARGET}"
if [[ ! -f "${TARGET}" ]]; then
  LATEST=$(ls -t docs/archive/screenshots/screenshot-*.png 2>/dev/null | head -1)
  [[ -n "$LATEST" ]] && cp "$LATEST" "${TARGET}"
fi
bash "${SKILL_DIR}/scripts/log-action.sh" "$LOG" "discover" "<SURFACE-ID>" "screenshot default" "success" "0" "screenshots/<route>/<SURFACE-ID>-default.png"
```

#### Step 3 — Expand every subsurface

This is where most of the 253 surfaces live. Don't move to the next route until done.

- Click every **tab/segment control** to reveal hidden panels
- Open every **drawer/modal** (inspector, command palette, shortcuts help)
- Click every **expandable row** (audit entries, attempt details)
- Open every **dropdown/select** to see options
- Click **"New"/"Add" buttons** to reveal creation forms
- Visit every **settings sub-section** via the rail
- Screenshot each expanded state and log it

For each subsurface:
```bash
agent-browser --session shqa-2560 snapshot -i  # get fresh refs
agent-browser --session shqa-2560 click @eN     # expand
agent-browser --session shqa-2560 wait 300
agent-browser --session shqa-2560 screenshot "${TARGET}"
# ... fallback check + log ...
agent-browser --session shqa-2560 errors         # check console
```

If a seed surface is not found in the live app, mark it `[MISSING]` and append to `references/surface-seed.md` immediately. If a new surface is discovered, append it as `[DISCOVERED]` and bump the seed patch version.

#### Step 3b — Automated checks (run on EVERY route)

These deterministic checks catch bugs that visual inspection cannot. Run all four after content loads, before interaction testing.

**axe-core accessibility audit** — inject and run on every page:
```bash
agent-browser --session shqa-2560 eval '
  if (!window.axe) { const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js"; document.head.appendChild(s); await new Promise(r=>s.onload=r); }
  const r=await axe.run(); return JSON.stringify({violations:r.violations.length, items:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length,desc:v.description}))});
'
```
Any violation with impact "critical" or "serious" is a FAIL finding. Log each violation.

**SPA document.title check** — verify title doesn't accumulate suffix:
```bash
agent-browser --session shqa-2560 eval 'document.title'
```
After navigating 3+ routes, the title should be `<page> · Risoluto`, not `<page> · Risoluto · Risoluto · Risoluto`. If it accumulates, file as P1 FAIL.

**Network error audit** — check for 4xx/5xx responses:
```bash
agent-browser --session shqa-2560 eval '
  performance.getEntriesByType("resource").filter(r=>r.responseStatus>=400).map(r=>({url:new URL(r.name).pathname,status:r.responseStatus}))
'
```
Any 429s or 5xx responses are findings.

**Performance (LoAF)** — check for blocking main thread on data-heavy pages (queue, overview, settings):
```bash
agent-browser --session shqa-2560 eval '
  const e=[]; new PerformanceObserver(l=>l.getEntries().forEach(x=>e.push({dur:x.duration,block:x.blockingDuration}))).observe({type:"long-animation-frame",buffered:true}); return JSON.stringify(e.filter(x=>x.block>100));
'
```
Any LoAF with `blockingDuration > 200ms` is a P2 perf finding.

**HTML structure checks** — quick one-liners per route:
```bash
# h1 presence (every page must have one)
agent-browser --session shqa-2560 eval 'document.querySelector("h1")?.textContent || "MISSING"'

# Route announcer updates after navigation (should match page name, not stay "Risoluto")
agent-browser --session shqa-2560 eval 'document.querySelector("[role=status]")?.textContent'

# Nested <main> landmarks (should be 0)
agent-browser --session shqa-2560 eval 'document.querySelectorAll("main main").length'

# <aside role="navigation"> should be <nav> (should be 0)
agent-browser --session shqa-2560 eval 'document.querySelectorAll("aside[role=navigation]").length'

# Duplicate IDs (breaks aria-describedby associations)
agent-browser --session shqa-2560 eval 'const ids=Array.from(document.querySelectorAll("[id]")).map(e=>e.id); JSON.stringify(ids.filter((id,i)=>ids.indexOf(id)!==i))'

# Broken internal links (hrefs pointing to wrong routes)
agent-browser --session shqa-2560 eval 'Array.from(document.querySelectorAll("a[href^=\"/\"]")).filter(a=>!["/","/queue","/settings","/templates","/observability","/notifications","/git","/containers","/workspaces","/audit","/setup","/issues","/attempts"].some(r=>a.getAttribute("href").startsWith(r))).map(a=>({href:a.getAttribute("href"),text:a.textContent.trim().slice(0,30)}))'
```
Flag any non-empty result as a finding.

#### Step 4 — Test interactions

For each interactive element on this route, apply the relevant tests from `references/interaction-taxonomy.md`:

- **Buttons**: click, keyboard Enter/Space, verify action
- **Inputs**: type valid, type empty, type XSS (`<script>alert(1)</script>`), type 10k chars
- **Selects**: open, arrow-nav, select, verify change
- **Filter chips**: toggle, verify filtering, clear all
- **Keyboard shortcuts**: click non-interactive area first, then press key sequence, verify URL/state change
- **Modals**: trigger open, verify focus trap (Tab cycles within), Escape closes
- **Confirm dialogs**: trigger, accept path, dismiss path

After each interaction: `agent-browser --session shqa-2560 errors`

**Deep interaction patterns** (these catch bugs that basic click-and-screenshot misses):
- **Filter chip count verification**: For any chip showing a count (e.g., "Canceled 9"), click it, then verify the displayed item count matches the chip label. Don't just screenshot — count DOM elements.
- **Form save without changes**: On any settings/form page, click Save without editing anything. If a PUT request fires or a success toast appears, that's a dirty-checking bug (P1).
- **Reset/clear button verification**: Read the field value before clicking Reset, read after. If identical, the reset is broken (P1).
- **ARIA state after toggle**: After toggling any chip/button that gets `.is-active` CSS class, verify it also sets `aria-pressed="true"`. Missing ARIA state on toggles is a P2 a11y bug.

#### Step 5 — Force error/empty states (if applicable)

```bash
agent-browser --session shqa-2560 network route "*/api/v1/<endpoint>" --body '{"error":"mock"}'
# Screenshot error state
agent-browser --session shqa-2560 network unroute
```

Not every route needs this. Apply when the seed lists error/empty state surfaces for this route.

#### Step 6 — Move to next route

Update `surface-manifest.md` with all tested surfaces from this route before proceeding.

### Keyboard Shortcut Testing

Most shortcuts are testable with focus management. Do not default to SKIP.

1. Click a non-interactive area to clear focus: `agent-browser --session shqa-2560 click "main"`
2. Press the shortcut: `agent-browser --session shqa-2560 press "g"` then `agent-browser --session shqa-2560 press "o"`
3. Verify via URL or snapshot

**For Ctrl+K** (may not work via automation dispatch): use the workaround `agent-browser eval 'globalThis.dispatchEvent(new CustomEvent("palette:open"))'`. Mark PASS with note if workaround is needed.

**Only SKIP for**: sustained key holds, third-party widget internals (CodeMirror). Drag-drop has a keyboard alternative (see below).

### Mandatory Route Checklist

Every route below MUST be visited during Phase 2. The agent must not skip any route. If a route requires a dynamic ID, resolve it via API first.

| Route | How to get the dynamic ID |
|-------|--------------------------|
| `/` | — |
| `/queue` | — |
| `/queue/:id` | Pick any issue identifier from the board |
| `/issues/:id` | Same identifier |
| `/issues/:id/runs` | Same identifier — pick one with ≥2 attempts for compare mode |
| `/issues/:id/logs` | Same identifier |
| `/attempts/:id` | `curl -sf http://localhost:${PORT}/api/v1/{identifier}/attempts \| python3 -c "import json,sys; print(json.load(sys.stdin)[0]['attempt_id'])"` |
| `/settings` | — |
| `/observability` | — |
| `/notifications` | — |
| `/git` | — |
| `/workspaces` | — |
| `/containers` | — |
| `/templates` | — |
| `/audit` | — |
| `/setup` | — |
| `/unknown` | — |
| `/config`, `/secrets`, `/welcome` | — (alias routes) |

### Testing by Surface Type

The surface seed marks each surface with a `type`. Use the matching recipe below. **Never SKIP a surface if a recipe exists for its type.**

#### type: `sse-event` — Simulate via CustomEvent injection

The frontend dispatches all SSE-driven updates as `window.CustomEvent` on `window`. Bypass the real SSE stream entirely:

| CustomEvent name | Trigger | Where to test |
|---|---|---|
| `risoluto:worker-failed` | `{ detail: { error: "Sandbox timeout", identifier: "NIN-99" } }` | Any page (toast) |
| `risoluto:system-error` | `{ detail: { message: "disk full" } }` | Any page (toast) |
| `risoluto:model-updated` | `{ detail: { identifier: "NIN-99", model: "gpt-5.4" } }` | Any page (toast) |
| `risoluto:issue-lifecycle` | `{ detail: { type: "issue.completed", identifier: "<ID>" } }` | `/issues/:id` |
| `risoluto:agent-event` | `{ detail: { issueId: "x", identifier: "<ID>", type: "turn_completed", message: "QA log", sessionId: "qa", timestamp: new Date().toISOString() } }` | `/issues/:id/logs` (Live mode) |
| `risoluto:notification-created` | `{ detail: { notification: { id: "qa-"+Date.now(), type: "worker_completed", severity: "info", title: "QA", message: "test", read: false, created_at: new Date().toISOString() } } }` | `/notifications` |
| `risoluto:workspace-event` | `{ detail: { identifier: "NIN-99", status: "created" } }` | `/workspaces` |
| `risoluto:audit-mutation` | `{ detail: { tableName: "config", key: "codex.model", operation: "update", actor: "qa", timestamp: new Date().toISOString() } }` | `/audit` |
| `risoluto:webhook-health-changed` | `{ detail: { oldStatus: "ok", newStatus: "degraded" } }` | `/` |
| `risoluto:webhook-received` | `{ detail: { eventType: "issue.update", timestamp: new Date().toISOString() } }` | `/` |
| `risoluto:poll-complete` | `{ detail: { timestamp: new Date().toISOString(), issueCount: 5 } }` | `/observability` |

**Pattern:**
```bash
agent-browser --session shqa-2560 eval 'window.dispatchEvent(new CustomEvent("<name>", <payload>))'
agent-browser --session shqa-2560 wait 500
agent-browser --session shqa-2560 snapshot -i  # verify toast/row/counter appeared
```

#### type: `state-variation` — Force via network mocking or data manipulation

| Variation | Recipe | Cleanup |
|---|---|---|
| **Loading skeleton** | `network route "*/api/v1/<endpoint>" --delay 10000` → navigate → screenshot | `network unroute` |
| **Empty state** | `network route "*/api/v1/<endpoint>" --body '[]'` → navigate → screenshot | `network unroute` |
| **Error state** | `network route "*/api/v1/<endpoint>" --abort` → navigate → screenshot | `network unroute` |
| **Dismissed state** | `eval 'localStorage.removeItem("<key>")'` → mock empty data → navigate | Restore key after |
| **Specific data state** | Call API to create the required data (see Data Preconditions below) | — |

Every page that has a `state-variation` surface MUST be tested with its loading and empty/error states. Use the endpoint that page fetches (usually `*/api/v1/state` for overview/board/containers, or `*/api/v1/<resource>` for detail pages).

#### type: `shortcut` — Test per-page keyboard shortcuts

Clear focus first (`click "main"`), then press the key sequence and verify.

**Board `/queue` shortcuts**: `j`/`k` (navigate cards), `Enter` (open drawer), `Shift+Enter` (open full page), `[`/`]` (move columns), `/` (focus search), `f` (focus filters)

**Runs `/issues/:id/runs` shortcuts**: `j`/`k` (navigate rows), `Space` (toggle compare — needs ≥2 attempts), `Enter` (open attempt), `Backspace` (go back), `Escape` (clear compare)

**Templates `/templates` shortcuts**: `Ctrl+S` (save — make an edit first), `Ctrl+Shift+P` (preview — only works when not dirty)

**Global g+X shortcuts**: All defined in `references/surface-seed.md` under type `shortcut`. Test each by pressing `g`, then the second key, and verifying the URL changed.

**Contextual shortcuts**: `g+r` navigates to run history — must test from a page that has an active issue context (e.g., `/queue/:id`).

#### type: `modal` — Includes dialog-guarded surfaces

For surfaces that trigger native `confirm()` dialogs, override before clicking:
```bash
agent-browser --session shqa-2560 eval 'window.confirm = () => true'
# ... trigger the action ...
agent-browser --session shqa-2560 eval 'delete window.confirm'  # restore
```
This covers: unsaved template guards, credential reset, workspace delete, template delete.

#### Drag-drop surfaces — Use keyboard alternative

Kanban card drag-drop is testable via `Alt+ArrowUp`/`Alt+ArrowDown` keyboard shortcuts:
```bash
agent-browser --session shqa-2560 click "main"
agent-browser --session shqa-2560 press "j"              # focus a card
agent-browser --session shqa-2560 press "Alt+ArrowDown"   # move to next column
agent-browser --session shqa-2560 wait 300
# Verify: card moved in snapshot
```

### Data Precondition Recipes

When a surface requires specific data that doesn't exist yet, create it via API or browser injection.

| Precondition | Recipe |
|---|---|
| Getting-started card visible | `eval 'localStorage.removeItem("risoluto-empty-state-dismissed")'` + mock empty state via `network route` |
| Issue with 0 attempts | `POST /api/v1/setup/create-test-issue` — navigate before orchestrator processes it |
| Pending model/template change | `POST /api/v1/<identifier>/model` with `{"model":"gpt-5.4"}` — then check cancel button on issue page |
| Compare mode (runs page) | Find an issue with ≥2 attempts: `GET /api/v1/<identifier>/attempts` — use `Space` on two rows |
| Diff preview in settings | `PUT /api/v1/config/overlay` with any config change — settings page shows diff section |
| Empty notifications | `network route "*/api/v1/notifications" --body '[]'` |
| No repos configured | `network route "*/api/v1/git/*" --abort` |
| Empty workspaces | `network route "*/api/v1/workspaces" --body '[]'` |
| Empty template editor | Navigate to `/templates` without clicking any template |
| Contextual g+r shortcut | Navigate to `/queue/:id` first so the router has an active issue context |

Always `network unroute` after screenshotting mocked states.

### Phase 3: 1920x1080 Layout Pass

Close the 2560 session and start fresh:

```bash
agent-browser --session shqa-2560 close
agent-browser --session shqa-1920 --headed open http://localhost:${PORT}
agent-browser --session shqa-1920 set viewport 1920 1080
agent-browser --session shqa-1920 console --clear
```

For each route:
```bash
agent-browser --session shqa-1920 open "http://localhost:${PORT}<route>"
agent-browser --session shqa-1920 wait --load networkidle
agent-browser --session shqa-1920 wait 300
agent-browser --session shqa-1920 snapshot -i 2>&1 | head -10  # verify content

TARGET="${RUN_DIR}/1920x1080/screenshots/<route>/<route>-1920x1080.png"
mkdir -p "$(dirname "$TARGET")"
agent-browser --session shqa-1920 screenshot "${TARGET}"
if [[ ! -f "${TARGET}" ]]; then
  LATEST=$(ls -t docs/archive/screenshots/screenshot-*.png 2>/dev/null | head -1)
  [[ -n "$LATEST" ]] && cp "$LATEST" "${TARGET}"
fi

# Check horizontal overflow
OVERFLOW=$(agent-browser --session shqa-1920 eval 'document.documentElement.scrollWidth > document.documentElement.clientWidth')
[[ "$OVERFLOW" == *"true"* ]] && echo "FAIL: Overflow on <route> at 1920x1080"

bash "${SKILL_DIR}/scripts/log-action.sh" "${RUN_DIR}/1920x1080/logs/session.jsonl" \
  "layout-check" "ROUTE-<route>" "viewport 1920x1080" "success" "0" "screenshots/<route>/<route>-1920x1080.png"
```

Focus on: overflow, truncation, sidebar behavior, table column squeezing, modal fit.

### Phase 4: Report + Cleanup

1. **Run artifact gate check** (see above). If any gate fails, go back.
2. **Write `surface-manifest.md`** — every seed surface gets its own row with status for both viewports.
3. **Write `issues.md`** — each FAIL gets: severity, surface, reproduction steps, expected/actual, console error + stack, root cause hypothesis, fix location, evidence paths, viewport tag.
4. **Write `coverage-summary.md`** — run metadata, aggregate stats, per-route breakdown, adversarial results, self-healing log, blocked coverage with unblock guidance. See `references/output-format.md` for the full spec.
5. **Generate report.html**: `bash "${SKILL_DIR}/scripts/generate-report.sh" "${RUN_DIR}"`
6. **Close sessions**: `agent-browser --session shqa-1920 close 2>/dev/null`

## Self-Healing

When a step fails: log it, retry once with adjusted strategy (stale ref → re-snapshot; timeout → longer wait; dialog → `dialog accept`/`dismiss`; console error → log as finding and continue). If retry fails, mark BLOCKED with diagnostic context and move on. Never silently swallow failures.

## Recovery from Interrupted Sessions

1. Check for existing `session.jsonl` and `surface-manifest.md` in the run directory
2. Identify surfaces with terminal status — skip them
3. Resume from the first untested surface
4. Continue logging to the same `session.jsonl`

## What Not To Do

- Do not assign PASS to surfaces you haven't individually visited
- Do not collapse a whole route into one surface
- Do not skip hidden UI (drawers, modals, expandable rows, settings sub-sections)
- Do not silently ignore unreachable states — mark BLOCKED with reason
- Do not add mobile checks — desktop only
- Do not read source code to determine pass/fail — all findings from browser observation
- Do not screenshot pages showing "Loading..." or spinners — wait for content
- Do not write `[]` as the session log — use the log-action.sh helper
- Do not stop and ask the user to prepare data — seed it yourself
