---
plan: "feat: v1.0 UI/UX polish orchestrator prompt"
round: 1
mode: review
model: claude-opus-4.6
date: 2026-04-01
previous: none
verdict: CONDITIONAL GO
confidence: 78%
overall_score: 6/10
---

## What Works

The plan demonstrates strong codebase awareness -- every file count (36 CSS, 22 components, 48 views, 26 pages, 23 UI modules) verified exactly against the live repo. The subagent-per-skill architecture is a sound response to the context window problem, and the 7-phase ordering with user gates gives the operator meaningful control without micromanagement. The disk-based state handoff pattern (`.ui-polish/state/`) is the right abstraction for stateless subagent coordination, and the decision to commit per-skill rather than per-phase gives clean rollback boundaries.

## Settled Points (0 items -- first review)

N/A -- Round 1.

## Contested Points

N/A -- Round 1.

## Open Points

### OP-1: Skill Invocation Inside Agent Subagents Is Unproven (CRITICAL)

**My assessment**: The entire plan hinges on D1 -- spawning an Agent subagent whose prompt says "Run `/dogfood` against the running app." But slash command skills are designed to be invoked by the **user** in the main conversation, not programmatically by an Agent subagent. The Skill tool works at the top level of a conversation turn. There is no documented evidence that an Agent subagent can invoke the `Skill` tool to trigger a slash command. The subagent prompt in D1 says `invoke /<skill-name>`, but this may just produce a natural-language response about what the skill would do rather than actually executing it.

If skill invocation fails inside subagents, the **entire architecture collapses** -- every single implementation unit depends on this working.

**Recommended fix**: This is a **spike-before-execution gate**. Before writing the prompt, run a 5-minute proof-of-concept: spawn a single Agent subagent with a prompt that says "Run /audit on the app at http://localhost:5173 and report findings." Confirm that the Skill tool fires, the skill reads files, and the skill produces output. If it does not work, the plan needs a fundamentally different approach -- likely inlining the skill's SKILL.md content directly into each subagent prompt instead of invoking the slash command.

**Status**: Open

### OP-2: build-error-resolver Is an Agent, Not a Skill -- Invocation Mismatch (HIGH)

**My assessment**: The plan (D6, R7) describes spawning a "build-error-resolver subagent" to fix verification failures. The actual `build-error-resolver` lives at `~/.claude/agents/build-error-resolver.md` and is a **Sonnet-model agent definition**, not a skill. It cannot be invoked via `/build-error-resolver` as a slash command. It is designed to be used as a `model: sonnet` agent delegated to via the Agent tool -- which is actually compatible with the plan's subagent pattern, but the plan conflates it with the skill invocation pattern used for the 20 design skills.

Furthermore, the agent definition specifies `tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]` -- it does **not** have access to `agent-browser` or any MCP tools. If the build error involves a runtime UI issue that only manifests in the browser, this agent cannot diagnose it.

**Recommended fix**: Clarify in the plan that the build-error-resolver is dispatched differently (via Agent tool with the agent definition, not via Skill tool). Also acknowledge its tool limitations and add a fallback: if the resolver cannot diagnose the issue because it requires browser inspection, escalate to the user immediately rather than burning both retry attempts.

**Status**: Open

### OP-3: Smoke Test Count Is Stale (LOW)

**My assessment**: The plan's "Verified File Counts" table claims "119 smoke tests / 17 specs." Verification against the live codebase shows **121 test blocks across 17 spec files** (summed from `grep -c "test(" across all smoke specs). The count has drifted by +2 since the plan was written, likely due to recent commits. This is cosmetic but undermines the "all counts verified" claim.

**Recommended fix**: Update the count to 121 or, better, remove hard-coded test counts from the prompt since they will drift further as development continues. The prompt should reference the test suite structurally ("run all smoke tests") rather than asserting a specific count.

**Status**: Open

### OP-4: Visual Baseline Count Discrepancy -- Plan Says 7/4, Origin Says 4 Baselines (LOW)

**My assessment**: The plan states "7 visual baselines / 4 specs." Verification confirms 7 PNG files across 4 spec directories. The origin requirements document does not specify a baseline count. This is consistent -- no issue -- but the plan should note that the 7 baselines come from some specs having both `smoke-linux` and `visual-linux` variants, which is a testing implementation detail the prompt author should understand when deciding whether to update baselines.

**Status**: Open

### OP-5: Context Window Budget Is Hand-Waved (HIGH)

**My assessment**: The plan claims the subagent architecture "keeps orchestrator lean" (Risk table, D1 rationale) but never quantifies the budget. The orchestrator must hold:
1. The entire prompt file (~800 lines of instructions, estimated ~15K tokens)
2. State management logic for 7 phases
3. The return summaries from each subagent (even brief 3-5 sentence summaries x 20 skills = 100 sentences)
4. AskUserQuestion interactions at 7+ phase gates (user responses can be lengthy)
5. Error recovery conversations (potentially multiple rounds per skill)
6. The subagent prompt template instantiated 20 times

With Opus 4.6's 200K context window, the main session likely survives, but there's no margin analysis. If the user provides detailed feedback at phase gates, or if multiple error recovery cycles fire, the orchestrator could hit context pressure by Phase 5-6.

**Recommended fix**: Add a rough token budget to the plan. Estimate: ~15K prompt + ~3K per subagent cycle (dispatch + return summary) x 20 = 60K + ~5K per phase gate x 7 = 35K + ~10K buffer for error recovery = ~120K total. That's within 200K but uncomfortably close if error recovery is needed frequently. The plan should include a "context checkpoint" at Phase 4 where the orchestrator can compact its context (summarize phases 0-3 into a single state file and reference that).

**Status**: Open

### OP-6: Dev Server Lifecycle Has No Health Monitoring (MEDIUM)

**My assessment**: D3 says "orchestrator starts dev server once, subagents reuse." The health check is a single `curl` at startup. But the pipeline runs for potentially hours -- 20 skills executing sequentially with user interactions between phases. The Vite dev server can crash due to: malformed CSS introduced by a skill, a syntax error that HMR cannot recover from, or simply an OOM from accumulated HMR updates. There is no health check before each subagent dispatch, and no restart protocol if the server dies mid-pipeline.

**Recommended fix**: Add a pre-dispatch health check: before each subagent is spawned, the orchestrator runs `curl -sf http://localhost:5173 > /dev/null` and restarts the dev server if it fails. This is a 2-line addition to the prompt but prevents a class of silent failures where subagents try to screenshot a dead server.

**Status**: Open

### OP-7: Screenshots of Parameterized Routes Require Data Setup (MEDIUM)

**My assessment**: The plan calls for screenshots of 16 views including `/issues/:id`, `/issues/:id/runs`, `/logs/:id`, and `/attempts/:id`. These routes require actual data -- an issue ID, a log ID, an attempt ID -- to render anything other than a 404 or empty state. The baseline screenshot subagent would need to either: (a) know valid IDs from the running dev server, or (b) create mock data first.

The plan acknowledges this in the risk table ("Some pages need data -- may show empty states") but classifies it as "Low likelihood." In reality, for a fresh dev setup, parameterized routes will **always** show empty/error states unless data is seeded. This means ~4-8 of the 32 baseline screenshots will be empty states rather than representative views, undermining the quality of before/after comparison.

**Recommended fix**: The prompt should instruct the baseline screenshot subagent to first call the API (or use the mock API from the Playwright test infrastructure) to seed representative data. Alternatively, acknowledge that parameterized route screenshots will show empty states and ensure the diagnosis skills account for this -- `/dogfood` should navigate to these routes only after verifying data exists.

**Status**: Open

### OP-8: No Rollback Strategy for Cumulative Drift (MEDIUM)

**My assessment**: The plan notes "Cumulative CSS changes break visual consistency" as a risk with mitigation "normalize in Phase 6 catches drift." But between Phase 2 and Phase 6, four phases of changes accumulate without a consistency check. If Phase 3 (Visual Identity) introduces color changes that clash with Phase 2 (Foundation) layout changes, the conflict is not detected until Phase 6 -- by which point 12+ skills have committed changes and rollback means reverting half the pipeline.

**Recommended fix**: Add a lightweight consistency check between phases -- not a full `/normalize` pass, but the orchestrator should instruct each post-Phase-2 subagent to verify that the pages it modifies still render correctly in both themes. A simple "take a screenshot, compare visually, report anomalies" instruction per subagent would catch drift early.

**Status**: Open

### OP-9: Phase 3 AskUserQuestion Ordering Is Fragile (LOW)

**My assessment**: Unit 7 says the orchestrator asks "bolder or quieter?" via AskUserQuestion **before** dispatching the intensity skill. But the plan also says `/colorize` runs first in Phase 3. The user's answer to "bolder or quieter?" should ideally come **after** seeing `/colorize` results, since color changes affect perceived intensity. The current ordering (colorize -> ask -> bolder/quieter -> clarify) is reasonable but the plan doesn't acknowledge that the user might want to change their intensity answer after seeing the combined effect of colorize + bolder/quieter.

**Recommended fix**: Add a note that the Phase 3 gate (after all Phase 3 skills) should include "Do you want to adjust intensity? The bolder/quieter choice can be re-run." This is minor but prevents the user from feeling locked in.

**Status**: Open

### OP-10: Diagnosis Skills Claimed Read-Only But /dogfood May Not Be (MEDIUM)

**My assessment**: Unit 5 states: "Diagnosis skills do NOT modify files -- they produce reports only. No commits needed." However, the `/dogfood` skill is designed to "systematically explore and test a web application to find bugs, UX issues, and other problems." Its SKILL.md description says it finds bugs -- and some dogfooding skills are designed to fix bugs they find. If `/dogfood` modifies files, the "no commits needed" instruction will cause uncommitted changes that interfere with subsequent subagents.

**Recommended fix**: The subagent prompt for diagnosis skills should explicitly include "DO NOT modify any files. Report findings only. If you find bugs that need fixing, list them in your summary but do not attempt to fix them." This converts an implicit assumption into an explicit instruction.

**Status**: Open

### OP-11: 800-Line Prompt Target May Be Unrealistic (MEDIUM)

**My assessment**: The plan has 12 implementation units. Unit 1 (header + constraints + error recovery) alone will likely be 80-120 lines. Unit 2 (technical context + route table + file counts) is another 60-80 lines. Unit 3 (subagent template) needs 40-60 lines. Each of Units 4-11 (8 phases) needs 40-80 lines for skill-specific instructions, verification, and gate questions. That's roughly: 120 + 80 + 60 + (8 x 60) = 740 lines minimum, leaving almost no margin for the inevitable elaboration needed to make instructions unambiguous.

An 800-line prompt pasted into a session also means the orchestrator starts with ~15K tokens of instructions before doing any work. This is significant context pressure.

**Recommended fix**: Consider splitting the prompt into a "core orchestrator" section (~400 lines) that the user pastes in, plus a "phase reference" file (`.ui-polish/phase-reference.md`) that the orchestrator reads on demand for each phase. This keeps the initial prompt lean and lets the orchestrator load phase details incrementally. Alternatively, accept ~1000 lines and note it in the risk table.

**Status**: Open

### OP-12: No Handling of Partial Subagent Failure (MEDIUM)

**My assessment**: The error recovery flow (D6) handles verification failure after a skill completes. But what if a subagent **crashes** or times out without writing its summary file? The plan's "System-Wide Impact" section mentions this: "If a subagent crashes without writing its summary, the next subagent will miss context." But the mitigation is only "the prompt should instruct the orchestrator to verify state file existence." There is no specified behavior for what happens when the state file is missing. Does the orchestrator skip the skill? Re-run it? Ask the user?

**Recommended fix**: Define the crash recovery behavior explicitly: "If a subagent returns without writing `<skill-name>-summary.md`, the orchestrator asks the user: 'The /X skill did not produce a summary. (a) Re-run it, (b) Skip it and continue, (c) I will handle it manually.'" This is a small addition but covers a real failure mode.

**Status**: Open

## Additional Issues Found

### AI-1: Route Table Lists `/runs` as a View But No Route Exists (LOW, already noted in plan)

The plan correctly identifies this discrepancy and corrects the view count from 17 to 16. Good. But the original requirements document still says "17 pages" -- the requirements trace should note this correction explicitly so the origin document can be updated.

### AI-2: The Plan References `AskUserQuestion` Tool Without Verifying It Exists (MEDIUM)

The plan repeatedly references "AskUserQuestion" as the mechanism for phase gates. This appears to be a custom tool or a reference to the built-in `ask` mechanism in Claude Code. If this refers to the standard Claude Code behavior of simply outputting a question and waiting for user input, it works. But if the plan intends a specific tool call (like a hypothetical `AskUserQuestion` tool), that tool does not exist in the standard Claude Code toolset. The prompt should just have the orchestrator ask the user directly in its output -- no special tool needed.

**Recommended fix**: Clarify that "AskUserQuestion" means the orchestrator simply asks the user a question in its response and waits for the next user message. Remove references to it as if it were a distinct tool.

### AI-3: `.ui-polish/` and `screenshots/` Not in `.gitignore` (LOW)

The plan (Unit 12) mentions verifying `.ui-polish/` is in `.gitignore`, which is good. But `screenshots/baseline/` and `screenshots/after/` also need to be excluded (or explicitly included, if the user wants them committed). The plan should instruct the prompt to add both directories to `.gitignore` in Phase 0.

### AI-4: No Definition of "Verification Failure" vs "Minor Issue" (MEDIUM)

R8 says "Do not block pipeline on minor issues -- only escalate genuine build/test failures." But the plan never defines what constitutes a "minor issue" vs a "genuine failure." Is a Prettier formatting error a minor issue? Is a single failing smoke test a genuine failure? The orchestrator needs clear criteria, otherwise it will either over-escalate (blocking on a formatting nit) or under-escalate (ignoring a real test regression).

**Recommended fix**: Define explicitly: "A genuine failure is any non-zero exit from `pnpm run build`, `pnpm run lint`, or `pnpm test`. Formatting issues from `pnpm run format:check` should be auto-fixed with `pnpm run format` before committing -- do not escalate. A single smoke test failure is a genuine failure and should trigger the build-error-resolver."

## Revised Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Completeness | 7/10 | Covers all phases and skills thoroughly, but missing crash recovery behavior, context budget analysis, and verification criteria definitions |
| Sequencing & Dependencies | 8/10 | Phase ordering is well-justified, unit dependencies are explicit, sequential execution simplifies reasoning |
| Risk Coverage | 5/10 | Risk table exists but underestimates likelihood of key risks (parameterized route data, dev server death, context exhaustion). No spike gate for the most critical assumption (OP-1) |
| Feasibility | 5/10 | The entire architecture depends on an **unverified assumption** (skill invocation in subagents). If OP-1 fails, every unit needs rework. Context budget is uncomfortably tight. |
| Edge Cases | 6/10 | Handles bolder/quieter branching, missing `.impeccable.md`, build failures. Misses subagent crashes, parameterized route data, dev server death, context exhaustion |
| Clarity | 8/10 | Well-structured, good use of decision records, mermaid diagrams. A new team member could follow this |
| Scope Discipline | 9/10 | Tight scope -- prompt file only, no aesthetic decisions baked in, clear boundaries. One of the plan's genuine strengths |
| ROI / Effort | 7/10 | 20 skills is ambitious but the overlapping passes (normalize after changes, polish at end) justify the coverage. The 800-line prompt target keeps the artifact manageable |
| Goal Alignment | 8/10 | Every unit traces to a requirement. Phase structure maps directly to the skill categories. No drift |

**Overall: 6/10** -- The plan is well-structured and thoroughly researched, but its feasibility score drags the overall rating down significantly. The critical unverified assumption (OP-1: skill invocation in subagents) is a potential single point of total failure, and the context window budget analysis is missing. These are not "nice to have" -- they are existential risks to the plan's viability.

## Verdict

**CONDITIONAL GO -- 78%**

Conditions for execution:

1. **MUST** spike OP-1 (skill invocation in Agent subagents) before writing any prompt content. If skills cannot be invoked from subagents, the plan needs a different approach (likely inlining SKILL.md content into subagent prompts).
2. **MUST** add context budget analysis (OP-5) with a checkpoint/compaction strategy.
3. **SHOULD** clarify build-error-resolver invocation (OP-2) and define verification failure criteria (AI-4).
4. **SHOULD** add pre-dispatch health checks for the dev server (OP-6).
5. **NICE TO HAVE** for remaining open points (OP-3, OP-4, OP-7-12, AI-1-3).

If OP-1 spike succeeds and OP-5 is addressed, this plan moves to 7.5-8/10 and a clean GO.

## Debate Ledger

See `ledger.md`.
