# Build Risoluto's Feature Spine

## Goal

Produce `research/RISOLUTO_FEATURES.md` — the canonical, behavior-level, code-backed inventory of every feature Risoluto ships today. This file is the spine against which future competitor/reference repos are compared (see `.claude/skills/risoluto-researcher/`). **Accuracy is the primary objective; breadth is second; speed is third.** This is a one-off bootstrap job — take as long as needed.

## Context

Risoluto is a local orchestration engine that watches an issue tracker (Linear or GitHub Issues), spins up sandboxed Codex-based AI agents in Docker per issue, and delivers PRs. Inspired by OpenAI Symphony. Strict TypeScript, ESM, pnpm, Node 22+. Runs at http://localhost:4000. The full architecture is in `CLAUDE.md` at the repo root — read it first.

## Your job — one sentence

For every user-observable feature implemented in this codebase, produce an entry in `research/RISOLUTO_FEATURES.md` with (a) a 3–8 item observable-behaviors list and (b) exact code evidence (file:line ranges, class names, function names, commit SHA, shipped version).

## Output file

Write to `research/RISOLUTO_FEATURES.md`. If the `research/` directory does not exist yet, create it locally (it will later become a git submodule backed by a private repo). Do NOT commit this file to the public Risoluto repo.

## Prerequisites — before you start

1. Read `CLAUDE.md` at the repo root end-to-end. The "Architecture at a Glance" table is your map.
2. Read `README.md` — note the "What Ships Today (v0.6.0)" four-quadrant section (Core Engine · Dashboard & API · Integrations · Operations).
3. Read `docs/CONFORMANCE_AUDIT.md` — this is already behavior-level per §5.x spec sections. You will leech from it heavily but NOT copy uncritically; every claim must be re-verified against code.
4. Read `docs/ROADMAP_AND_STATUS.md` — the "Recently Shipped" table and "Open Bundle Summary" name the 11 bundle categories you'll organize the spine by. Memorize them exactly as written.
5. Record the commit SHA and version:
   ```bash
   git rev-parse --short HEAD
   git describe --tags --always
   ```
   Put both at the top of the spine file.

## Structure — mandatory

Organize the spine by Risoluto's **bundle taxonomy** (from `docs/ROADMAP_AND_STATUS.md`). Each bundle is a top-level `##` section. Within each, one `###` per feature.

Use exactly these bundle names:

1. `## Notifications, Chat & Triggers`
2. `## Multi-Agent / Orchestration`
3. `## Persistence / State`
4. `## PR / CI`
5. `## Sandbox / Security`
6. `## Agent Runtime / Execution`
7. `## Dashboard`
8. `## Config`
9. `## Security / Auth`
10. `## Runtime`
11. `## Persistence`

Do not invent new bundles. If a feature doesn't fit, add it to the closest bundle and note the ambiguity in `## Analyst notes` at the bottom.

## Per-entry format — copy verbatim

```markdown
### <Feature title>

- **Description:** 1–3 sentences on what the feature is and what user problem it solves.
- **How it works:** 2–4 sentences on the mechanism (key classes/functions/data flow).
- **Observable behaviors:**
  - <rule / limit / default / UX specific #1>
  - <rule / limit / default / UX specific #2>
  - … (minimum 3, aim for 5–8)
- **Evidence:**
  - Source: `<file>:<lines>` — `<ClassName>` / `<functionName>`
  - Source: `<file>:<lines>` — `<ClassName>` / `<functionName>`
  - … (at least 2 source citations; more if the feature spans files)
- **Shipped in:** <git tag or "default branch @ <date>">
- **Related GitHub issues:** #<n>, #<n> (from roadmap or CHANGELOG — if findable)
```

## Evidence bar — non-negotiable

- **Every observable behavior must trace to code.** If you can't find the implementation, do NOT list the behavior. Drop it or mark it for follow-up.
- **Every source citation is specific.** `src/orchestrator/` is not enough. `src/orchestrator/worker-launcher.ts:L88-L142 — WorkerLauncher.selectCandidate` is. Line ranges are required.
- **Quote sparingly and verbatim.** If the behavior depends on a specific string literal, constant, default, regex, or threshold, quote it inline in the observable-behaviors list.
- **No inferred claims.** If README says "rate limit: 5/min" but code doesn't confirm, drop the "5/min" part. If you can't find the number, say "rate-limited" and flag it in `## Needs follow-up`.

## Workflow — follow in order

### Phase 1 — Docs harvest (breadth)

Skim, don't deep-read:
- `README.md` — enumerate every named capability in the four-quadrant section
- `docs/CONFORMANCE_AUDIT.md` — walk every §. Each bullet is a candidate behavior.
- `docs/ROADMAP_AND_STATUS.md` "Recently Shipped" — every row is a shipped feature with a bundle already assigned
- `CHANGELOG.md` if it exists
- `git log --oneline --grep='^feat' -100` for recent feature commits

Produce a working draft: a flat list of feature candidates with bundle tags. These are hypotheses to verify, not conclusions.

### Phase 2 — Code verification (depth, parallel)

Spawn one `Explore` subagent per top-level `src/` module. Each subagent:
- Lists every file in its module
- Enumerates every exported class, function, type, const
- For each exported symbol: names which feature candidate it implements (from Phase 1), OR flags it as "internal plumbing, not user-facing" with justification, OR flags it as "feature not in Phase 1 draft — needs new entry"
- Returns a structured brief under 300 lines

Modules to parallelize (one subagent each):
- `src/cli/` — entry + service wiring
- `src/orchestrator/` — polling, retry, worker launch, dirty tracking
- `src/agent-runner/` — session lifecycle, docker session, turn state
- `src/agent/` — JSON-RPC wire protocol to Codex
- `src/http/` — server, routes, SSE, dashboard API (50+ endpoints)
- `src/persistence/` — SQLite store, runtime, attempt store
- `src/tracker/`, `src/linear/`, `src/github/` — tracker abstraction + adapters
- `src/git/` — PR + branch automation, merge policy, PR summary
- `src/workspace/` — workspace manager, lifecycle hooks
- `src/docker/` — sandbox spawn, resource limits
- `src/dispatch/` — control/data plane split (remote dispatch)
- `src/codex/`, `src/prompt/`, `src/audit/`, `src/secrets/`, `src/config/` — support modules
- `src/core/` — event bus, signal detection, shared types
- `frontend/src/` — SPA (pages, components, state, router)

**Every subagent uses `colgrep` as its primary search tool** (semantic first, regex fallback).

### Phase 3 — Merge

Main agent merges the Phase 2 briefs:
- Features in BOTH Phase 1 AND Phase 2 → high-confidence entries, write them first
- Features in Phase 1 only → code-verify manually. If you can't find code, drop or mark low-confidence
- Features in Phase 2 only → net-new discoveries (this is the payoff — things docs don't say). Write entries and flag them in `## Analyst notes` as "not surfaced in existing docs"

For each final entry, fill every field. No blanks.

### Phase 4 — Coverage sweep

For every file you touched in Phase 2, every exported symbol must be accounted for as one of:
- **Implementation of a feature** listed in the spine (name which)
- **Internal plumbing / helper** — not user-facing
- **Test fixture / mock**
- **Generated file / build artifact**

Write this accounting into a `## Coverage manifest` table at the end of the spine file (one row per `src/` module + one for `frontend/src/`). This makes coverage gaps visible and is non-negotiable.

### Phase 5 — Final report

At the bottom of the spine file, include:

- `## Summary` — feature count per bundle, total count, high/medium/low confidence split
- `## Coverage manifest` — per-module table (from Phase 4)
- `## Needs follow-up` — every low-confidence entry with a concrete question to resolve
- `## Analyst notes` — anomalies, things docs got wrong, features that don't fit any bundle, features not surfaced in existing docs

## Anti-patterns — do not

- ❌ Copy bullets from `CONFORMANCE_AUDIT.md` without code-verifying each claim
- ❌ Use `(inferred)` as an escape hatch — either verify in code or drop the behavior
- ❌ Group multiple features under one entry because they share a module
- ❌ Skip `frontend/src/` — UI behaviors are features too (dashboard tabs, settings flows, filter bar, live feed drill-down, etc.)
- ❌ Invent bundle names — use the 11 from `docs/ROADMAP_AND_STATUS.md` verbatim
- ❌ Leave `TODO` / `(wip)` markers in the final file
- ❌ Write shorter entries for speed — behavior-level detail is the whole point
- ❌ Assume the README is complete; the point of Phase 2 is to catch what docs miss

## Self-check before declaring done

- [ ] Every bundle section has at least 2 feature entries (if a bundle has zero, you missed it — go again)
- [ ] Every entry has ≥3 observable behaviors, ≥2 source citations with line ranges
- [ ] Every entry cites a class or function name, not just a file path
- [ ] `## Coverage manifest` accounts for every `src/` module AND `frontend/src/`
- [ ] `## Summary` feature count looks sane (Risoluto v0.6.0 ships roughly 60–120 behavior-level features; if your count is <40 or >200, re-calibrate)
- [ ] Commit SHA + version recorded at top of file
- [ ] No entry has a `(inferred)` or `TODO` marker

## Final output

- **Path:** `research/RISOLUTO_FEATURES.md`
- **Length expectation:** 800–2000 lines
- **Time budget:** unbounded. This is a one-off job. Take as long as needed. Speed is the least important axis.
- **When done:** print a terminal summary with feature count per bundle, total count, confidence split, and the path.
