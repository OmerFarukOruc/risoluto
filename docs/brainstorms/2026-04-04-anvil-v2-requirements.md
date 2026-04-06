---
date: 2026-04-04
topic: anvil-v2
---

# Anvil v2 — Solo-Spec Factory with Pluggable Review Backends

## Problem Frame

Risoluto currently ships features through `anvil-risoluto` (Codex, checked in) and
a personal `/anvil` (Claude, in dotfiles) that bundle multiple issues into one
integration branch and one PR. Battle-tested over three runs (remove-workflow-md,
v1 UI/UX polish, CI/CD pipeline #374), but the bundled model has three recurring
failure modes:

1. **Coarse rollback blast radius** — reverting one unit requires unwinding all
   its siblings on the integration branch.
2. **Reviewer fatigue** — 18-unit PRs drown reviewers and obscure per-unit context.
3. **Conflict amplification** — siblings touching adjacent files compound merge pain.

Operator pain is also felt upstream: work items live as GitHub issues, which forces
`gh` CLI round-trips for every create/edit/query, offers no schema enforcement on
issue bodies, and lacks any structured observability trail per work item.

Anvil v2 inverts the execution model and replaces the intake medium entirely:

- **One spec → one worktree → one branch → one PR.** No bundling.
- **Specs are the new source of truth**, stored locally under `.anvil/specs/<slug>/`
  with a strict schema (`spec.json`), rich context (`spec.md`), and a full event log
  (`history.jsonl`). GitHub issues are retired as work tracking.
- **The factory always succeeds.** It grinds through review rounds, quality gates,
  and verification until a perfect PR is ready. Unrecoverable stalls pause the run
  and wait for human input — there is no `failed` state.
- **Review diversity is decoupled from any single model.** A pluggable `ReviewBackend`
  interface supports Claude subagents, Codex app-server, OpenCode SDK, and future LLMs.
- **UI verification is mandatory and real.** Any spec touching the frontend runs a
  6-layer battery (Playwright + `/expect` + `/ui-test` + `/dogfood` + console sweep
  + Impeccable advisory) before push is allowed.
- **Parallelism is external.** Omer opens multiple Claude Code sessions, each runs
  `anvil run <slug>` against a different spec. The skill itself is single-spec and
  makes no attempt at in-session orchestration or subagent fanout.

## Architecture Overview

```text
╔════════════════════════════════════════════════════════════════════════╗
║  LAYER 1 — SPEC CREATION   (separate design, out of scope)             ║
║                                                                        ║
║   feature idea ─┐                                                      ║
║   bug report  ──┼──▶  research / brainstorm / validate / enrich        ║
║   research    ──┘                         │                            ║
║                                           ▼                            ║
║                         .anvil/specs/<slug>/                           ║
║                             spec.json   (schema-enforced, ready)       ║
║                             spec.md     (rich context)                 ║
║                             history.jsonl (append-only event log)     ║
║                             attachments/                               ║
╚══════════════════════════════════╤═════════════════════════════════════╝
                                   │   anvil run <slug>
                                   ▼
╔════════════════════════════════════════════════════════════════════════╗
║  LAYER 2 — ANVIL FACTORY   (this design)                               ║
║                                                                        ║
║   create worktree at  ../worktrees-risoluto/<slug>                     ║
║   create branch       feat/<slug>   from main                          ║
║   init run state      .anvil/runs/<slug>/   (lives in main repo)       ║
║                                                                        ║
║   10 phases: preflight → intake → brainstorm → plan → review →         ║
║              audit → finalize → execute → verify → docs/tests          ║
║              closeout → final push                                     ║
║                                                                        ║
║   Guarantee: always succeeds (or pauses), no `failed` state            ║
╚══════════════════════════════════╤═════════════════════════════════════╝
                                   │
                                   ▼
                      git push + gh pr create → PR open
```

## Requirements

### Spec Store (Layer 1 output, Layer 2 input)

- **R1.** The spec store lives at `.anvil/specs/<slug>/` with exactly four artifacts:
  `spec.json` (machine-readable, schema-enforced), `spec.md` (rich human context),
  `history.jsonl` (append-only event log), and `attachments/` (screenshots, snippets,
  references — optional).
- **R2.** `spec.json` conforms to a strict v1 schema with at minimum:
  `schema_version`, `id` (stable slug), `title`, `type` (`feature`|`bugfix`), `status`
  (`draft`|`ready`|`in-progress`|`done`), `created_at`, `updated_at`, `created_by`,
  `source` (provenance: type + origin URL + research_slug), `scope.areas`,
  `scope.risk`, `scope.complexity`, `scope.touches_ui`, `scope.touches_tests`,
  `scope.touches_docs`, `dependencies.requires`, `dependencies.unlocks`,
  `dependencies.file_overlap`, `acceptance_criteria` (array of `{id, text, verified}`),
  and a `run` linkage block populated by anvil during execution.
- **R3.** Every entry in `spec.acceptance_criteria` must include enough detail for
  Phase 8 Verify to map it to a concrete runnable check (test command, screenshot
  assertion, CLI invocation, file assertion, or equivalent). The "verifiable DoD"
  constraint is load-bearing — specs that cannot map every AC to a check must not
  reach `ready` status.
- **R4.** `spec.md` is rich freeform markdown with required sections: Problem,
  Prior Art (when sourced from research), Design Sketch, Affected Modules,
  Open Questions. `spec.md` never replaces `spec.json` as the schema source;
  they complement each other.
- **R5.** `history.jsonl` records every meaningful mutation as a single JSON line with
  `ts`, `event`, `actor`, and event-specific fields. Events include at minimum:
  `created`, `field_updated`, `status_changed`, `run_phase`, `review_round`,
  `pause_triggered`, `pause_resolved`, `run_complete`. Append-only; never rewritten.
- **R6.** Spec `schema_version` is versioned. When anvil reads a spec with an older
  version, it runs a forward migration chain and rewrites `spec.json` in place.
  Old specs never rot.
- **R7.** GitHub issues are **not** used as work tracking. All work lives in the
  spec store. PR descriptions may link to spec paths but no issue sync is performed.
  Existing Epic #9 becomes historical and is not updated by anvil runs.

### Anvil Factory (Layer 2 pipeline)

- **R8.** The factory runs a fixed 10-phase pipeline per spec: `preflight`, `intake`,
  `brainstorm`, `plan`, `review`, `audit`, `finalize`, `execute`, `verify`,
  `docs-tests-closeout`, `final-push`. Phase routing is unconditional except for
  reopen loops (audit → review, verify → execute, docs-tests incomplete → verify).
- **R9.** Each `anvil run <slug>` invocation creates a fresh run record at
  `.anvil/runs/<slug>/` (or `<slug>-N/` if a prior run exists). Run records are
  immutable history once sealed; re-running a spec always starts fresh state.
- **R10.** Run state is written to the main repo at `.anvil/runs/<slug>/`. Worktrees
  hold code only; they contain no `.anvil/` directory. Agents working inside the
  worktree receive `ANVIL_STATE_DIR` and `ANVIL_WORKTREE_DIR` environment variables
  so they know where each lives.
- **R11.** Worktrees live at `../worktrees-risoluto/<slug>/` as a sibling directory
  to the main repo. Created at Phase 0 preflight, destroyed at Phase 10 push cleanup.
- **R12.** Phase state is recorded in `.anvil/runs/<slug>/status.json` with fields:
  `schema_version`, `phase`, `phase_status`, `active`, `review_round`, `audit_round`,
  `verify_cycle`, `pending_phases`, `gate_results`, `claim_counts`, `paused_sub`
  (new field: substate for paused runs with `trigger` + `unblocker` + `since_ts`),
  `integration_branch`, `push_status`, `next_required_action`, `updated_at`.
- **R13.** Every phase refreshes `handoff.md` (fresh-session resume note) and
  appends to `pipeline.log` (narrative timeline). `closeout.md` is refreshed at
  every meaningful checkpoint (execute-ready, verify-ready, push-ready, sealed).
- **R14.** Phase 10 final push is the ONLY phase that may `git push`. No
  intermediate phase invokes push under any circumstance.
- **R15.** On successful push, the factory creates a PR via `gh pr create` with a
  body generated from `spec.md` + `status.json` + verification evidence (see R32).

### Pluggable Review Backends

- **R16.** Review backend selection is driven by `.anvil/config.json` under the
  `review.backends` array. Each entry declares `name`, `rounds`
  (`odd`|`even`|`any`|explicit list), `priority`, `enabled`, and backend-specific
  config (model, port, timeout, etc.).
- **R17.** All backends implement a shared `ReviewBackend` interface:
  `name: string`, `available(): Promise<boolean>`, `review(opts): Promise<ReviewResult>`.
  `ReviewResult` returns `score` (0-10), `verdict` (`GO`|`CONDITIONAL_GO`|`NO_GO`),
  `settled`, `contested`, `open`, `outputPath`.
- **R18.** Three backends ship with v1: Claude subagent (native Agent tool, always
  available, zero deps), Codex app-server (JSON-RPC over stdio), OpenCode SDK
  (HTTP REST over dynamic port). Any backend may be disabled via config; at least
  one must remain enabled.
- **R19.** If a scheduled backend's `available()` returns false, the dispatcher falls
  back to `config.review.fallback` (default: `claude-subagent`). Silent fallback is
  acceptable for availability failures.
- **R20.** If a backend's `review()` throws or crashes mid-round, the dispatcher
  **does not** silently swap backends. Cross-model diversity is load-bearing; a
  runtime crash pauses the run with a `paused_sub` describing the error.
- **R21.** The review loop caps at 10 rounds per `config.review.max_rounds`. The
  audit phase may reopen review up to 2 times.

### UI Verification Battery (Phase 8 Verify)

- **R22.** When `spec.scope.touches_ui === true`, Phase 8 runs a mandatory 6-layer
  battery in order: (1) Playwright smoke + visual, (2) `/expect`, (3) `/ui-test`,
  (4) `/dogfood`, (5) agent-browser console sweep, (6) `/critique` + `/audit`
  (advisory only).
- **R23.** Layers 1-5 are blocking: failure in any of them reopens Phase 7 Execute
  (up to 3 verify cycles per R29.f). Layer 6 (Impeccable) is advisory: findings
  are surfaced in the PR body but do not block push.
- **R24.** For `/dogfood`, high-severity findings reopen execute; medium-severity
  findings become advisory PR notes; low-severity findings are logged to
  `verification/dogfood-report.md` only.
- **R25.** Phase 0 preflight verifies presence of `npx expect-cli`, `browse` CLI
  (`@browserbasehq/browse-cli`), `agent-browser` CLI, and the Impeccable skill
  family whenever the spec declares `touches_ui: true`. A missing tool blocks
  the run in preflight with a clear install hint.
- **R26.** All verification artifacts (screenshots, videos, reports, raw tool
  output) are written under `.anvil/runs/<slug>/verification/` and its
  `screenshots/` / `videos/` subdirectories. Artifacts are not written to
  repo-global archive folders.

### State Machine & Failure Semantics

- **R27.** Spec status transitions: `draft` → `ready` (human or agent marks ready,
  implies `spec.json` schema validates) → `in-progress` (anvil run started) →
  `done` (PR opened successfully). There is no `failed` terminal state.
- **R28.** When a run hits an unrecoverable condition, it writes `paused_sub:
  paused_awaiting_human` into `status.json` with an explicit `trigger` (enum:
  `review_cap`, `review_stall`, `audit_cap`, `execution_thrash`, `gate_cap`,
  `verify_cap`, `spec_validation`, `backend_crash`) and an `unblocker` string
  describing exactly what Omer must provide to resume. `spec.status` remains
  `in-progress`. `status.json.active` is set to `false`.
- **R29.** Pause triggers are explicit, bounded, and detected by the following
  rules:
    - (a) **review_cap** — `config.review.max_rounds` (default 10) exhausted
      without reaching convergence (0 contested + GO/CONDITIONAL_GO verdict).
    - (b) **review_stall** — 3 consecutive review rounds produce identical
      `{settled, contested, open}` counts AND the same top contested point.
      Detected by comparing round N-2, N-1, N.
    - (c) **audit_cap** — hostile auditor has reopened review twice already and
      the third audit still returns `REOPEN`.
    - (d) **execution_thrash** — 2 consecutive execute cycles touch the same
      file set with opposing diffs (revert-and-restore pattern).
    - (e) **gate_cap** — the same quality gate check (build|lint|test|knip|jscpd|
      typecheck|semgrep) has failed 5 fix attempts in a row.
    - (f) **verify_cap** — 3 consecutive verify cycles fail with the same claim
      unsatisfied.
    - (g) **spec_validation** — spec references files, paths, or dependencies
      that do not exist in the current repo at Phase 0 preflight or Phase 2
      brainstorm.
    - (h) **backend_crash** — a review backend's `review()` method threw an
      exception or crashed mid-round (not an `available()` false, which is
      handled by fallback per R19).
- **R30.** Aborting a paused run is a manual human action performed by Omer,
  not by the skill itself. Abort reverts `spec.status` to `ready` and seals the
  current run record in place. A fresh dispatch starts a new `runs/<slug>-N/`
  directory per R9.

### Observability

- **R31.** Every mutation to the spec or run state appends a single-line JSON
  record to the relevant `history.jsonl` file (either the spec's own or the
  run's own, depending on scope) with `ts`, `event`, `actor`, and event-specific
  fields. `history.jsonl` is append-only, never rewritten, and survives run
  seal.
- **R32.** The PR description is generated automatically at Phase 10 from a
  template combining `spec.md` + `status.json` + verification results. Required
  sections in the rendered PR body: Summary (from spec.md Problem), Changes
  (spec.md Plan milestones), Acceptance Criteria (every AC with ✅/❌ + verify
  command or evidence excerpt), Verification Evidence (review rounds and final
  score, quality gate results, UI battery layer-by-layer results when
  `touches_ui`, dogfood advisory findings), Spec link
  (`.anvil/specs/<slug>/spec.md`), Run link (`.anvil/runs/<slug>/handoff.md`),
  Test Plan checklist.
- **R33.** `pipeline.log`, `handoff.md`, `closeout.md`, and `status.json` must
  remain internally consistent at every phase transition. No phase is considered
  complete until all four agree on `phase`, `phase_status`, `active`, and
  `next_required_action`.

### Migration & Skill Upgrade

- **R34.** The existing `.agents/skills/anvil-risoluto/` skill is renamed to
  `.agents/skills/anvil/` via `git mv` (preserving history) and upgraded in-place.
  The `-risoluto` suffix is dropped since this will be the only anvil going
  forward.
- **R35.** The six phase sub-skills (`anvil-brainstorm`, `anvil-plan`,
  `anvil-review`, `anvil-audit`, `anvil-execute`, `anvil-verify`) are upgraded
  in-place: Codex-specific references (`.codex/agents/*.toml`, `codex exec`
  calls, context budget limits, bundle intake logic) are replaced with the
  pluggable `ReviewBackend` interface and model-agnostic phase logic.
- **R36.** Files to delete during upgrade:
    - `.agents/skills/anvil-risoluto/references/codex-context-budget.md`
      (no context limits per D14)
    - `.agents/skills/anvil-risoluto/references/bundle-intake.md` (no bundling
      per D3)
- **R37.** Files to create during upgrade:
    - `references/spec-schema.md` — spec.json v1 schema + worked examples
    - `references/review-backends.md` — ReviewBackend interface + 3 impls
    - `references/ui-battery.md` — 6-layer battery in detail
    - `references/pause-triggers.md` — all pause conditions + recovery
    - `references/worktree-lifecycle.md` — create/work/push/cleanup contract
    - `references/migration.md` — upgrade-from-anvil-risoluto guide
    - `scripts/validate_spec.ts` — strict spec.json schema check
    - `scripts/init_run.ts` — scaffold `.anvil/runs/<slug>/`
    - `scripts/collision_scan.ts` — file-overlap check vs running specs
    - `scripts/create_worktree.ts` — git worktree + branch setup
    - `scripts/cleanup_worktree.ts` — post-push teardown
    - `scripts/append_history.ts` — append event to history.jsonl
    - `scripts/dispatch_review.ts` — pluggable backend dispatcher
    - `scripts/migrate_old_state.ts` — one-off `.anvil/<slug>/` migration
- **R38.** Existing `.anvil/<slug>/` directories (10 historical runs from prior
  battle tests: remove-workflow-md, testing-expansion, cicd-release-pipeline,
  config-validation-bundle, config-validation-bundle-replay-01, notifications-bundle,
  persistence-recovery-bundle, pr-ci-automation-pipeline-bundle, v1-ui-ux-polish,
  plus ACTIVE_RUN pointer) are migrated forward into the new `.anvil/runs/<slug>/`
  layout by `scripts/migrate_old_state.ts`. Spec records are NOT retroactively
  created for completed historical runs.
- **R39.** The personal `/anvil` at `~/.agents/skills/anvil/` is out of scope for
  this migration — it lives in Omer's personal dotfiles and is not committed
  to Risoluto.

### Invocation & Session Model

- **R40.** The only v1 invocation shape is `anvil run <slug>` (single spec,
  current Claude Code session, synchronous). Batch drain modes (`run-all`,
  background watcher) are explicitly deferred per D3.
- **R41.** Each Claude Code session operates as a self-contained universe: one
  spec, one worktree, one branch, one PR, no cross-session coordination beyond
  shared `.anvil/` state visibility.
- **R42.** Parallel sessions are protected against collision by Phase 0 preflight
  scanning all `.anvil/runs/*/status.json` for active runs (`status != done` and
  `active == true`) whose spec's file boundaries overlap with the current spec's
  file boundaries. Collision blocks the run in preflight with a clear message
  naming the conflicting run and file set.

## Success Criteria

- **SC1.** A single spec in `ready` status can be executed with `anvil run <slug>`
  and produces a green-gate, UI-verified, merge-ready PR within one Claude Code
  session, requiring no human intervention beyond the initial invocation unless
  a defined pause trigger (R29) fires.
- **SC2.** Three specs can be executed concurrently in three separate Claude
  Code sessions without worktree, branch, state, or SQLite-lock collisions. Each
  session produces an independent PR.
- **SC3.** A spec with `touches_ui: true` that accidentally introduces an
  accessibility regression is caught by the Phase 8 6-layer battery (not after
  push), and the run reopens Phase 7 Execute to fix the regression.
- **SC4.** An unresolvable review disagreement after 10 rounds causes the run to
  pause cleanly (`paused_sub: paused_awaiting_human` with `trigger: review_cap`)
  and writes a precise unblocker into `status.json` — not an infinite loop or a
  silent failure.
- **SC5.** Switching the review backend for a given round from `claude-subagent`
  to `codex-app-server` requires only editing `.anvil/config.json` — no code
  changes inside the anvil skill.
- **SC6.** The full history of a completed spec (created, every field update,
  every phase transition, every review round, final push) can be reconstructed
  by reading `.anvil/specs/<slug>/history.jsonl` and `.anvil/runs/<slug>/pipeline.log`
  linearly, without any external data sources.
- **SC7.** The existing `anvil-risoluto` + 6 sub-skills are upgraded in-place
  and the old `.anvil/<slug>/` historical state migrates cleanly to the new
  layout without losing audit trail. `git log` on the renamed skill files still
  shows pre-v2 history.
- **SC8.** PR reviewers can understand a PR from the auto-generated body alone,
  without needing to click into `.anvil/specs/` or `.anvil/runs/` directories
  in the repo tree.

## Scope Boundaries (out of scope for this design)

- **Layer 1 spec creation skills** — research agent, brainstorm-to-spec, bug-to-spec.
  These are a separate brainstorm / design session. Until Layer 1 ships, Omer
  authors specs manually following the v1 schema.
- **`repo-research.md` v2** — the research prompt that will write specs instead
  of creating GitHub issues. Deferred per Round 3 decision #9.
- **Multi-spec batch invocation** (`anvil run-all`). Deferred per R40.
- **Background queue watcher daemon.** Deferred.
- **Web / MCP-based research sources** beyond the current GitHub-only
  `repo-research`. Deferred per decision #9.
- **Private repo for spec storage** (mentioned as an optional future enhancement
  for cross-machine sync).
- **Observability dashboard or query UI** over `history.jsonl`.
- **Retroactive spec records** for historical bundled runs.
- **Personal `/anvil`** at `~/.agents/skills/anvil/` (not in this repo).
- **Cost tracking per run** (token usage, API spend, wall time budgets).
- **Spec-level retry policies** (each retry is a fresh human-invoked run; no
  auto-retry across runs).

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Replace `anvil-risoluto` + personal `/anvil` entirely with new `anvil` skill | One mental model going forward; no dual maintenance burden |
| D2 | Execution-ready spec schema with verifiable DoD pre-baked | Every AC must map to a checkable command/assertion; feeds a sharp review loop |
| D3 | Omer drives parallelism externally (multi-session), not internally (subagents) | Self-contained universes; no cross-session orchestration complexity |
| D4 | `.anvil/specs/<slug>/` dir-per-spec with spec.json + spec.md + history.jsonl | Strict schema + rich context + full observability in one place |
| D5 | GitHub issues retired as work tracking | Local-first, schema-enforced, offline-capable, no gh CLI friction |
| D6 | No `failed` state; runs always succeed or pause awaiting human | Factory grinds until correct; no token waste on silent failures |
| D7 | Pluggable `ReviewBackend` interface | Cross-model diversity without code-level lock-in to Codex |
| D8 | Pause on backend runtime crash (no silent fallback on crash) | Diversity is load-bearing; quiet fallback defeats the purpose |
| D9 | Fresh run record per invocation (`runs/<slug>-N/`) | Runs are immutable history; retries start clean state |
| D10 | Worktrees as sibling dir, state stays in main repo | No `.gitignore` pollution; single source of truth for state |
| D11 | 6-layer mandatory UI battery when `touches_ui: true` | Real UI testing with real skills; matches the "ship-ready" bar |
| D12 | Upgrade `anvil-risoluto` + 6 sub-skills in place (not delete) | Preserve battle-tested phase logic and git history |
| D13 | Stall detector + incoherence detector + hard caps per R29 | "Always succeeds" still needs pause triggers to avoid infinite loops |
| D14 | No context budget limits | Treat context as unlimited; drops a layer of operational complexity |

## Dependencies / Assumptions

### Assumed tools on the machine

- Node.js 22+, `pnpm`, `git` (with worktree support), `gh` CLI — already required
  by Risoluto baseline.
- `playwright` — already in repo devDependencies.
- `npx expect-cli` — installable per-repo via `npx expect-cli@latest init`. Phase 0
  preflight checks for it when `touches_ui: true`.
- `@browserbasehq/browse-cli` — installable globally via `npm install -g`. Phase 0
  preflight checks for it when `touches_ui: true`.
- `agent-browser` CLI — already in Omer's toolchain.
- `codex` CLI — for the Codex app-server backend. Optional; only required when
  that backend is enabled.
- `opencode` CLI — for the OpenCode SDK backend. Optional; disabled by default
  in v1.
- Impeccable skill family (`/critique`, `/audit`, and follow-ups) — assumed
  installed; used advisory-only in Layer 6 of the UI battery.

### Assumed repo state

- The existing Risoluto CI pipeline (build, lint, format:check, test, knip, jscpd,
  semgrep, mutation, typecheck:coverage) remains intact and is invoked by
  Phase 8 Verify / Phase 9 Docs-Tests Closeout as the quality gate.
- Husky pre-push hooks remain the canonical quality gate for manual development;
  the anvil factory runs an equivalent programmatic gate via Phase 8/9 without
  bypassing hooks (no `--no-verify`).
- The `.agents/skills/` tree remains checked in and shared with the repo.

### Assumed design partners

- Layer 1 (spec creation, separate brainstorm) will produce specs that conform
  to the v1 schema. Until Layer 1 is built, Omer authors specs manually following
  `references/spec-schema.md`.
- Research sources beyond GitHub (web / MCP) are not needed for the v1 anvil to
  function. Anvil v1 works with manual specs, existing `repo-research`-authored
  specs (once the research prompt is upgraded in a later session), and ad-hoc
  hand-written specs.

## Outstanding Questions

### Resolve Before Planning

None. All blocking product decisions are resolved. Planning may proceed immediately.

### Deferred to Planning

- **[Affects R2] [Technical]** Exact `spec.json` v1 field types, enums, required
  vs optional markers, and a JSON Schema file for automated validation during
  Phase 0 preflight.
- **[Affects R12] [Technical]** `status.json` v2 schema: how the new `paused_sub`
  field nests, how `integration_branch` semantics change for solo runs (since
  there is no integration branch distinct from the PR branch), and how to
  normalize legacy `status.json` files during migration.
- **[Affects R17, R18] [Technical]** `ReviewBackend` TypeScript interface signatures,
  persona handling (`hostile`/`constructive`/`counter`), stdio vs HTTP protocol
  adapters, timeout + cancellation handling, and error taxonomy for crash vs
  unavailable.
- **[Affects R11] [Technical]** Worktree cleanup policy — delete immediately on
  push success for hygiene, or keep the N most recent for post-hoc debugging?
  Config flag or hardcoded?
- **[Affects R41, R42] [Technical]** Port allocation strategy for parallel
  sessions that run dev servers (Playwright, Vite). Options: worktree-derived
  port offsets, reserved port pool with lockfile coordination, or shell-out to
  a dynamic-port finder. Picks one, documents it.
- **[Affects R38] [Technical]** `scripts/migrate_old_state.ts` design — which
  historical fields map 1:1 to the new schema, which need synthetic values,
  which get archived unchanged, and how `ACTIVE_RUN` is handled post-migration.
- **[Affects R33] [Technical]** `pipeline.log` format template and `handoff.md`
  section requirements for anvil v2 — inherit from existing contracts, update
  for new state shape (paused_sub, no integration_branch).
- **[Affects R6] [Technical]** Forward migration chain entry points, version
  ladder design (v1 → v2 → v3 → ...), and how migrations are invoked (on read
  vs explicit command).
- **[Affects anvil skill] [Testing]** 2-3 realistic test prompts for the new
  `anvil` SKILL.md per skill-creator's evaluation loop. Candidates: "anvil run
  structured-logging", "ship the webhook retry spec", "run the factory on
  spec-042".
- **[Affects R22, R23] [Needs research]** Exact `/expect` invocation for CI mode
  inside a worktree — how does it detect the dev server URL and reuse auth
  cookies across worktrees sharing a main repo origin?
- **[Affects R22, R23] [Needs research]** Calibrate `/ui-test` `browse` CLI step
  budgets for typical Risoluto spec sizes (small bugfix ~25 steps, medium
  feature ~40 steps, dashboard rework ~75 steps).
- **[Affects R24] [Needs research]** `/dogfood` finding severity routing — how
  are findings mapped from dogfood's internal severity scale (if any) to the
  high/medium/low decision tree that drives reopen vs advisory?
- **[Affects R34-R37] [Technical]** Exact per-file diff of upgrade edits per
  sub-skill, specifically what to preserve from `references/escalation-playbook.md`,
  `references/state-contract.md`, `references/output-contract.md`,
  `references/dependency-contract.md`, `references/preflight-contract.md`,
  `references/preflight-checks.md`, `references/phase-routing.md`.
- **[Affects R29.b, R29.d] [Technical]** Stall and incoherence detectors — exact
  comparison algorithms. For stall: how tolerant is "identical ledger"? For
  incoherence: how to detect "opposing diffs" across two execute cycles?

## Next Steps

→ `/ce-plan` for structured implementation planning grounded in this requirements
document and the current repo state. Pass this file as the plan input.
