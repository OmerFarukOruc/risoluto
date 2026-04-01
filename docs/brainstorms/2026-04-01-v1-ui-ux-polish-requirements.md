---
date: 2026-04-01
topic: v1-ui-ux-polish
---

# v1.0 UI/UX Production Quality Pass

## Problem Frame

Risoluto's functionality is production-ready but the dashboard UI needs a comprehensive quality pass before v1.0. The app has a copper-accent, zero-radius "stitch" design language documented in `.impeccable.md`, but the implementation has inconsistencies, rough edges, and missing polish across 17 pages. The goal is to produce a **self-contained prompt** that can be pasted into a fresh Claude Code session to orchestrate the entire polish workflow using ~20 Impeccable design skills.

## Requirements

**Prompt Architecture**
- R1. The prompt must use Agent tool subagents for each design skill — one skill per subagent with fresh context. The main session acts as a lean orchestrator.
- R2. The orchestrator must only track phase state, run phase gate questions via AskUserQuestion, and dispatch subagents. It must not accumulate skill output in its own context.
- R3. State must persist to disk between subagents — baseline screenshots, skill output summaries, change descriptions, and verification results.

**Skill Orchestration**
- R4. All 20 design skills execute in the specified 7-phase ordering: Diagnosis → Foundation → Visual Identity → Production Hardening → Delight → Consolidation → Polish.
- R5. Each subagent runs its skill, commits changes atomically (conventional commits: `feat(ui):`, `fix(ui):`, etc.), and runs verification before returning.
- R6. Verification per skill: `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`. After CSS/view changes, also `pnpm exec playwright test --project=smoke`.

**Error Recovery**
- R7. When verification fails after a skill, the orchestrator spawns a build-error-resolver subagent to auto-fix. After 2 failed attempts, escalate to the user via AskUserQuestion.
- R8. The orchestrator must not block the entire pipeline on minor issues — only escalate genuine build/test failures.

**User Control**
- R9. AskUserQuestion gates at every phase boundary for aesthetic direction, priority, and go/no-go decisions.
- R10. The prompt must ask about page prioritization, aesthetic direction (bolder vs quieter), UX copy tone, and visual baseline updates before proceeding.

**Visual Evidence**
- R11. Baseline screenshots of all 17 pages in both dark and light themes before any changes.
- R12. After-screenshots of all pages at the end for before/after visual comparison.
- R13. Screenshots saved to `screenshots/baseline/` and `screenshots/after/` with descriptive names.

**Quality Constraints**
- R14. Never modify `design-system.css` or `tokens.css` token values without asking.
- R15. Never remove functionality — this is enhancement, not feature cut.
- R16. Always preserve dark/light theme parity.
- R17. Always maintain WCAG AA contrast compliance.
- R18. If a skill's suggestions conflict with `.impeccable.md`, ask the user which to follow.

## Success Criteria

- The prompt executes in a fresh Claude Code session from Phase 0 through Phase 7 without context window exhaustion.
- Each subagent runs with fresh context and produces verifiable, committed changes.
- The user maintains control via phase gate questions.
- Build stays green throughout the pipeline.
- The final dashboard looks professional to outsiders (first impression quality), visually consistent across all pages, and fully compliant with the `.impeccable.md` design system.

## Scope Boundaries

- This produces a **prompt file**, not code changes. The prompt is the artifact.
- The prompt targets a fresh Opus 4.6 Claude Code session as the execution environment.
- Aesthetic decisions are made by the user during execution via AskUserQuestion — the prompt does not hardcode aesthetic choices.
- Visual regression baselines are only updated with explicit user approval.

## Key Decisions

- **Subagent architecture over monolithic session**: Each of the 20 skills runs in its own Agent subagent to avoid context window pressure. The orchestrator stays lean. (Decision: 2026-04-01, brainstorm)
- **All 20 skills, trust the ordering**: No skills cut despite overlap. Each skill adds unique value and overlapping passes catch drift. (Decision: 2026-04-01, brainstorm)
- **Auto-fix with escalation**: Build failures are auto-fixed by build-error-resolver subagent, escalating after 2 attempts. Keeps momentum without sacrificing safety. (Decision: 2026-04-01, brainstorm)
- **Full quality bar**: Success requires professional impression + visual consistency + design system compliance. Not just one of these. (Decision: 2026-04-01, brainstorm)
- **Strictly sequential execution**: Skills run one at a time in order. No parallelization within phases. Simpler to reason about and debug. (Decision: 2026-04-01, brainstorm)
- **Full attended mode**: User present throughout. AskUserQuestion at every phase gate. Maximum control over aesthetic direction. (Decision: 2026-04-01, brainstorm)

## Outstanding Questions

### Deferred to Planning
- [Affects R3][Technical] What specific state artifacts should each subagent write to disk for downstream skills to consume?
- [Affects R1][Technical] Should the orchestrator start the dev server once, or should each subagent manage its own server lifecycle?
- [Affects R11][Technical] How should subagents access screenshots — by reading files from `screenshots/baseline/`, or by taking their own targeted screenshots?
- [Affects R5][Technical] Should each subagent commit individually, or should the orchestrator batch commits per phase?
