---
plan: feat: v1.0 UI/UX polish orchestrator prompt
round: 2
mode: counter-review
model: codex-gpt-5.4
date: 2026-04-01
previous: .anvil/v1-ui-ux-polish/reviews/001-review-claude-opus-4.6-2026-04-01.md
verdict: CONDITIONAL GO
confidence: 84%
overall_score: 7/10
---

## What Round 1 Got Right

The plan still has a few real execution gaps: server liveness is underspecified, parameterized-route screenshots need a data strategy, and crash recovery should be explicit instead of implied. Those are worth fixing before this prompt is treated as production-ready.

## Point-by-Point Verdicts

### OP-1: Skill invocation inside Agent subagents is unproven
**Verdict: DISAGREE**

This is not an existential blocker. The local Claude Code changelog explicitly says:

- `2.1.0`: "Added support for running skills and slash commands in a forked sub-agent context"
- `1.0.123`: "Added SlashCommand tool, which enables Claude to invoke your slash commands"

That is direct evidence that subagents can run slash-command/skill workflows. Round 1’s "entire architecture collapses unless proven" framing is too strong.

**What should change:** D1 should be reworded to name the actual mechanism more precisely: the subagent should invoke the skill via Claude’s slash-command/skill execution path, not merely be told in natural language to "run /dogfood." This is a wording/implementation-clarity fix, not a spike gate.

### OP-2: build-error-resolver is an agent, not a skill
**Verdict: PARTIALLY AGREE**

The taxonomy point is correct: `~/.claude/agents/build-error-resolver.md` is an agent definition, not a skill, and the plan should say that explicitly.

But the severity is overstated. D6 already says "spawn a build-error-resolver subagent," which is structurally compatible with the agent form. The missing browser tools are also mostly irrelevant here because R7/D6 are about verification-command failures, not browser-only UX debugging.

**Fix:** Clarify that this path uses the Agent tool with the `build-error-resolver` agent, and override its default npm/npx-oriented habits with repo-specific commands (`pnpm run build`, `pnpm run lint`, etc.).

### OP-3: Smoke test count is stale
**Verdict: DISAGREE**

The repo currently has `119` smoke tests across `17` spec files. The plan’s count is correct. Round 1’s `121` claim does not match the live tree.

### OP-4: Visual baseline count needs context
**Verdict: DISAGREE**

The plan is already accurate: `7` visual baseline PNGs across `4` visual specs. Extra explanation about why some specs have multiple baseline files is optional background, not an open issue.

### OP-5: Context window budget is hand-waved
**Verdict: PARTIALLY AGREE**

The plan would benefit from a budget note, but Round 1’s `~120K` estimate is too high based on the actual artifact sizes and the architecture described.

Grounding:

- The current plan file is `716` lines / `39,152` bytes, which is closer to roughly `8K-10K` tokens than `15K`.
- A retained subagent cycle is not the full subagent transcript. The main thread should mostly keep:
  - one short Agent dispatch,
  - one short return summary,
  - maybe one state-file reference.

**My estimate:** roughly `400-800` retained tokens per subagent cycle if the plan is followed well, not `~3K`.

That puts the orchestration footprint more like:

- Initial prompt: `~8K-12K`
- 20 subagent cycles: `~8K-16K`
- 7 phase gates + user replies: `~4K-12K`
- Buffer / error handling: `~5K-10K`

So the realistic range looks closer to `~25K-50K`, with upside risk if the user gives essay-length feedback or the orchestrator keeps too much inline history.

**Fix:** add a simple compaction rule after each phase: summarize prior phase outcomes into one state file and keep only the latest gate decision + latest summaries in active context.

### OP-6: Dev server lifecycle has no health monitoring
**Verdict: AGREE**

Valid and easy to fix. A single startup `curl` is not enough for a multi-hour run.

**Fix:** add a pre-dispatch health check before every subagent and restart the dev server if `http://localhost:5173` is no longer healthy.

### OP-7: Screenshots of parameterized routes require data
**Verdict: AGREE**

Valid. The repo’s own E2E drilldown flow uses explicit mock scenario setup (`tests/e2e/mocks/scenarios/issue-drilldown.ts`) to make `/issues/:id`, `/issues/:id/runs`, `/logs/:id`, and `/attempts/:id` meaningful. In a live dev session, those views need discovered IDs or seeded data.

**Fix:** tell the baseline-screenshot step to first discover a valid issue/attempt path from runtime state or setup helpers, then capture those pages; otherwise explicitly classify them as empty-state screenshots.

### OP-8: No rollback strategy for cumulative drift
**Verdict: DISAGREE**

The plan does have a rollback story: every skill commits atomically, and the risk table explicitly calls out reverting individual skill commits. Round 1’s "no rollback strategy" claim is incorrect as written.

If anything, the improvement here is earlier drift detection, not rollback.

### OP-9: Phase 3 AskUserQuestion ordering is fragile
**Verdict: DISAGREE**

The plan already sequences Phase 3 as `colorize` first, then the "bolder or quieter?" choice before the intensity pass. That is the right place for the decision. Nothing in the plan prevents later adjustment at subsequent gates.

### OP-10: Diagnosis skills claimed read-only but /dogfood may modify files
**Verdict: DISAGREE**

`/dogfood` is report-first, browser-first, evidence-first. Its skill doc is about exploration and reporting, not code edits. `/audit` is also explicitly "Don't fix issues — document them."

Adding an explicit "report only" line would be harmless, but the claimed risk is not grounded in the actual skill definitions.

### OP-11: 800-line prompt target may be unrealistic
**Verdict: DISAGREE**

The current plan itself is already `716` lines, and it is not unusually bloated for a workflow prompt of this complexity. The line-count objection is weak. Token footprint matters more than line count, and the line target is within reason for a one-shot orchestrator artifact.

### OP-12: No handling of partial subagent failure
**Verdict: AGREE**

Round 1 is right here. The plan mentions verifying that state files exist, but it does not define the next action if they do not.

**Fix:** add explicit recovery behavior:

- missing summary/file after subagent return -> re-run once automatically
- if still missing -> ask the user whether to retry, skip, or stop

### AI-1: Route table correction needs backport to requirements
**Verdict: AGREE**

Low severity, but true. The requirements/origin docs should note that `/runs` is not a registered route and the screenshot list is `16`, not `17`.

### AI-2: AskUserQuestion is not a real tool
**Verdict: DISAGREE**

This is wrong in the Claude Code context the plan targets.

Grounding:

- Multiple Claude-side skills in `~/.agents/skills/gstack/*/SKILL.md` declare `AskUserQuestion` in `allowed-tools`.
- `~/.agents/skills/honcho-integration/SKILL.md` also lists `AskUserQuestion` in `allowed-tools`.
- Other cross-platform skills explicitly distinguish:
  - `AskUserQuestion` in Claude Code
  - `request_user_input` in Codex
  - `ask_user` in Gemini

So the plan is correct to reference `AskUserQuestion` for a fresh Claude Code session.

### AI-3: .ui-polish and screenshots not in .gitignore
**Verdict: AGREE**

Valid. `.gitignore` does not currently ignore `.ui-polish/`, `screenshots/baseline/`, or `screenshots/after/`.

**Fix:** make the prompt add or verify all three ignore entries.

### AI-4: No definition of "verification failure" vs "minor issue"
**Verdict: PARTIALLY AGREE**

This is directionally right but overstated. D6 already implies that command-level verification failures trigger the resolver flow. What is missing is the exact boundary for auto-fix vs escalation.

**Fix:** define it concretely:

- build/lint/test/smoke non-zero exit = blocking verification failure
- `format:check` failure = auto-run `pnpm run format`, then re-check
- diagnosis findings / polish nits / non-blocking observations = minor issues, do not stop the pipeline

## Additional Issues Found

### NEW-1: The plan misses the repo’s mandatory `/visual-verify` requirement

This repo’s `AGENTS.md` says UI-affecting changes must invoke `/visual-verify` as part of the definition of done. The current plan relies on build/lint/test/smoke plus ad hoc screenshots, but it does not carry forward that mandatory repo-local verification contract.

**Fix:** add `/visual-verify` (or an explicitly equivalent step) after UI-changing phases and definitely before final completion.

### NEW-2: Baseline/after screenshot diffs are nondeterministic as currently framed

The repo’s visual test conventions use Playwright mocks and clock freezing for deterministic screenshots. The plan’s live `agent-browser` screenshot approach is fine for qualitative evidence, but weak for true before/after diffing because timestamps, live runtime state, and route data can drift.

**Fix:** either:

- declare baseline/after screenshots as qualitative review evidence only, or
- add a deterministic screenshot mode that uses the repo’s E2E mock/visual conventions for stable comparisons.

## Revised Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Completeness | 8/10 | Covers the whole workflow well, but still needs explicit crash recovery, visual-verify, and deterministic screenshot guidance |
| Sequencing & Dependencies | 8/10 | Phase ordering is coherent and the subagent/state model is internally consistent |
| Risk Coverage | 7/10 | Several real risks are covered, but a few operational gaps remain |
| Feasibility | 7/10 | Stronger than Round 1 claimed; the big Claude-platform blockers were overstated, though some implementation details still need tightening |
| Edge Cases | 7/10 | Better than average, but parameterized-route data and subagent crash recovery need explicit handling |
| Clarity | 8/10 | The plan is easy to follow and maps decisions to implementation units well |
| Scope Discipline | 9/10 | It stays focused on the prompt artifact rather than drifting into implementation work |
| ROI / Effort | 7/10 | High leverage if executed, though the workflow remains heavy enough that verification discipline matters |
| Goal Alignment | 8/10 | The plan is still tightly aligned to the stated UI-polish orchestration goal |

**Overall: 7/10**

## Verdict

**CONDITIONAL GO**

Round 1 correctly found some operational gaps, but it overcalled the two most important blockers:

- subagents can invoke slash-command/skill workflows in modern Claude Code
- `AskUserQuestion` is a real Claude-side tool, not a hallucinated abstraction

So this is not a "spike or rewrite the architecture" situation. It is a "tighten the execution contract" situation.

### Conditions before execution

1. Clarify D1 so it explicitly relies on Claude’s subagent slash-command/skill execution path, not vague natural-language prompting.
2. Add pre-dispatch dev-server health checks.
3. Add an explicit strategy for parameterized-route screenshot data.
4. Add explicit missing-summary/subagent-crash recovery.
5. Add `.ui-polish/` and screenshot directories to `.gitignore`.
6. Add `/visual-verify` and define whether screenshots are qualitative or deterministic.

If those are folded in, this plan is a clean GO.
