---
plan: "feat: v1.0 UI/UX polish orchestrator prompt"
round: 4
mode: finalize
model: claude-opus-4.6
date: 2026-04-01
previous: .anvil/v1-ui-ux-polish/reviews/003-counter-claude-opus-4.6-2026-04-01.md
verdict: FINALIZED
---

# Finalization Changelog

All 18 settled points from the 3-round adversarial debate (claude-opus-4.6 R1, codex-gpt-5.4 R2, claude-opus-4.6 R3) have been merged into the plan. Zero contested points, zero open points at time of finalization.

## Amendments Applied

### 1. D1: SlashCommand tool mechanism named explicitly (OP-1)
- **Section:** D1 title, decision text, pattern example, subagent dispatch diagram
- **Change:** Replaced vague "invoke /<skill-name>" phrasing with explicit reference to the **SlashCommand tool** and Claude Code's `context: fork` sub-agent skill support. Added version citations (v1.0.123, v2.1.0) in the decision rationale.

### 2. D6: build-error-resolver dispatch clarified (OP-2)
- **Section:** D6 decision text, subagent dispatch diagram
- **Change:** Explicitly states the build-error-resolver is dispatched via the **Agent tool** using the agent definition at `~/.claude/agents/build-error-resolver.md`, not via the Skill/SlashCommand tool. Added repo-specific command overrides (`pnpm` instead of `npm`).

### 3. Smoke test count corrected (OP-3)
- **Section:** Verified File Counts table, Unit 2 approach
- **Change:** Replaced stale "119 smoke tests / 17 specs" with the verified count: "117 tests / 16 `*.smoke.spec.ts` files (121 tests / 17 files including `setup-gate.spec.ts`)". Unit 2 guidance now says to reference smoke tests structurally rather than hard-coding counts.

### 4. Dev server health monitoring added (OP-6)
- **Section:** D3 (retitled to include "with Health Monitoring"), subagent dispatch diagram, all phase units (4-11)
- **Change:** Added pre-dispatch health check with auto-restart flow before every subagent dispatch. Includes concrete bash snippet. Every unit now includes "pre-dispatch health check" in its approach.

### 5. Parameterized route data strategy added (OP-7)
- **Section:** Route Structure subsection, Unit 4 approach
- **Change:** Added explicit strategy: discover valid IDs from API endpoint or mock data layer before capturing parameterized routes. If no data available, classify as empty-state captures and note in manifest.

### 6. Crash recovery protocol added as D8 (OP-12)
- **Section:** New decision record D8, Unit 1 approach/test scenarios, all phase units, subagent dispatch diagram, System-Wide Impact, Risks table
- **Change:** Defined explicit 3-step flow: auto-retry once, ask user (retry/skip/manual), write stub summary if skipped. Added "verify summary file exists" step to all units.

### 7. AI-1: Route table correction noted for backport
- **Section:** Route Structure subsection
- **Change:** Added note that origin requirements document should be updated to reflect 16 (not 17) screenshottable views.

### 8. AI-2: AskUserQuestion confirmed as real tool
- **Section:** No change needed (plan was already correct)
- **Change:** None -- Round 1's concern was factually wrong. AskUserQuestion is a documented Claude Code tool declared in allowed-tools across multiple skills.

### 9. .gitignore entries for .ui-polish/ and screenshots/ (AI-3)
- **Section:** Unit 1 approach, Unit 4 approach
- **Change:** Added explicit instruction to add `.ui-polish/`, `screenshots/baseline/`, `screenshots/after/` to `.gitignore` in Phase 0.

### 10. Verification tiers defined (AI-4)
- **Section:** New top-level section "Verification Tiers", R8 requirements trace, Unit 1 approach
- **Change:** Added 3-tier table: blocking (build/lint/test non-zero exit), auto-fixable (format:check -> format), non-blocking (diagnosis findings/style).

### 11. Context compaction rule added as D9 (OP-5)
- **Section:** New decision record D9, all phase units, Risks table
- **Change:** Added per-phase-boundary compaction instruction. Estimated token budget (~23-37K of 200K) documented. Unit 8 (Phase 4) highlighted as the pipeline midpoint for thorough compaction.

### 12. /visual-verify added to verification steps (NEW-1)
- **Section:** R6 requirements trace, Unit 3 template, Units 6-11 (all UI-changing phases)
- **Change:** Added `/visual-verify` to the verification step for UI-changing phases (Phases 2-7), satisfying the repo's mandatory CLAUDE.md contract.

### 13. Screenshot intent clarified as qualitative (NEW-2)
- **Section:** R13 requirements trace, D4 decision text, Documentation/Operational Notes
- **Change:** Added explicit note: screenshots are qualitative review evidence, not pixel-perfect diffs. Deterministic regression uses Playwright visual suite.

### 14. Problem Frame view count corrected
- **Section:** Problem Frame paragraph
- **Change:** Updated "17 screenshottable views" to "16 screenshottable views" for consistency with the route table correction.

### 15. Remaining settled points preserved without changes
- **OP-4** (visual baseline count): Plan's 7/4 count was already correct. No change needed.
- **OP-8** (rollback strategy): Per-skill atomic commits + targeted reverts already present. Risk table wording improved.
- **OP-9** (Phase 3 ordering): Ordering was already correct. No change needed.
- **OP-10** (diagnosis skills read-only): `/dogfood` is sandboxed to browser-only tools. No change needed.
- **OP-11** (800-line target): Acceptable up to ~1000 lines given token budget. Line target softened to "~800-1000".

## Sections Preserved Without Change

All uncontested sections of the plan were preserved:
- Overview, Requirements Trace (structure), Scope Boundaries
- Design System Files, Key UI Modules, All 20 Skills table
- Dev Server Setup, D2 (state artifacts), D5 (commit strategy), D7 (phase gate questions)
- Open Questions (both resolved and deferred)
- Orchestrator Control Flow mermaid diagram (structure preserved, details updated)
- Unit structure and ordering (Units 1-12)
- Sources & References

## Frontmatter Changes

- `status: active` -> `status: finalized`
- Added `finalized: 2026-04-01`
- Added `finalized-by: claude-opus-4.6`
