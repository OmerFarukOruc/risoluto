---
plan: "feat: v1.0 UI/UX polish orchestrator prompt"
round: 3
mode: counter-review
model: claude-opus-4.6
date: 2026-04-01
previous: .anvil/v1-ui-ux-polish/reviews/002-counter-codex-gpt-5.4-2026-04-01.md
verdict: CONDITIONAL GO
confidence: 86%
overall_score: 7/10
---

## What Works

The debate has converged well. Round 2 correctly recalibrated the two biggest perceived blockers (skill invocation and AskUserQuestion), and the remaining disagreements are mostly about severity rather than substance. The plan's core architecture -- subagent-per-skill with disk-based state -- is sound, and the conditions for a clean GO are now narrow and actionable.

## Settled Points (5 items -- not re-evaluated)

Per ledger: OP-6 (health monitoring), OP-7 (parameterized route data), OP-12 (subagent crash recovery), AI-1 (route table backport), AI-3 (.gitignore entries).

## Contested Points

### OP-1: Skill invocation inside Agent subagents is unproven
**Verdict**: AGREE with Codex Round 2
**Their claim**: Not an existential blocker -- the Claude Code changelog explicitly documents skill/slash-command support in sub-agent contexts.
**My assessment**: Codex is right. The local changelog at `~/.claude/cache/changelog.md` contains two directly relevant entries:
- v2.1.0: "Added support for running skills and slash commands in a forked sub-agent context using `context: fork` in skill frontmatter"
- v1.0.123: "Added SlashCommand tool, which enables Claude to invoke your slash commands"

This is concrete platform evidence, not speculation. The mechanism exists. Round 1's "entire architecture collapses" framing was overcautious -- it treated a documented feature as an unproven assumption.

**Recommended fix**: D1 should name the mechanism precisely: the subagent dispatches skill invocation via the SlashCommand tool (or the `context: fork` path). This is a wording clarification, not a spike gate.
**Status**: --> Settled

### OP-2: build-error-resolver is an agent, not a skill
**Verdict**: AGREE with Codex Round 2 (PARTIALLY AGREE on the underlying point)
**Their claim**: The taxonomy distinction is valid but severity is overstated; the architecture is already structurally compatible.
**My assessment**: Codex is correct on both counts. D6 already says "spawn a build-error-resolver subagent" -- that phrasing is compatible with the Agent tool dispatch pattern. The missing browser tools are irrelevant because the build-error-resolver handles verification-command failures (build/lint/test), not browser-only UX issues. Round 1's escalation about browser-tool limitations was a theoretical concern, not a practical one in this pipeline.

**Recommended fix**: One sentence in D6 clarifying: "The build-error-resolver is dispatched via the Agent tool with the agent definition at `~/.claude/agents/build-error-resolver.md`, not via the Skill tool." Add repo-specific command overrides (`pnpm run build`, not `npm run build`).
**Status**: --> Settled

### OP-3: Smoke test count is stale
**Verdict**: DISAGREE with both prior rounds -- the truth is more nuanced
**Their claim**: Codex says the plan's "119 smoke tests / 17 specs" is correct. Round 1 said "121 tests."
**My assessment**: I verified the live codebase. The smoke directory contains **17 files** but only **16 match `*.smoke.spec.ts`** -- the outlier is `setup-gate.spec.ts` (no `.smoke.` segment). Counting `test(` calls:
- Across 16 `*.smoke.spec.ts` files: **117 `test(` calls**
- Across all 17 `*.spec.ts` files (including `setup-gate.spec.ts` with 4 tests): **121 `test(` calls**

So the plan's claim of "119 smoke tests / 17 specs" is wrong in both dimensions: it is either 117/16 (strict smoke glob) or 121/17 (all specs in the directory). Round 1's "121" was correct for the broader count. Codex's "119 matches the live tree" was incorrect.

That said, severity is LOW. The plan should either update the count to match reality (117/16 or 121/17 depending on scope) or, better, remove hard-coded test counts since they drift with every commit.
**Recommended fix**: Replace the hard-coded count with "all smoke tests in `tests/e2e/specs/smoke/`" or update to the verified count. This is cosmetic.
**Status**: --> Settled (LOW severity -- fix is trivial)

### OP-4: Visual baseline count needs context
**Verdict**: AGREE with Codex Round 2
**Their claim**: The plan's 7/4 count is accurate and the extra context is optional.
**My assessment**: Codex is right. The plan already states "7 visual baselines / 4 specs," which matches reality. Round 1's request for additional explanation about why some specs have multiple baselines is educational but not a plan defect. No fix needed.
**Status**: --> Settled

### OP-5: Context window budget is hand-waved
**Verdict**: PARTIALLY AGREE with Codex Round 2 -- the estimate is better, but a compaction rule is still needed
**Their claim**: Round 1's ~120K estimate is too high; the realistic footprint is ~25K-50K with proper subagent architecture.
**My assessment**: Codex's estimate is more grounded. With the subagent architecture, the orchestrator retains per cycle:
- One Agent dispatch prompt (template instantiation): ~200-400 tokens
- One returned summary string (3-5 sentences): ~100-200 tokens
- No intermediate skill work (that stays in the subagent's context)

So ~300-600 retained tokens per subagent cycle, not ~3K. For 20 cycles that is ~6K-12K. Adding the initial prompt (~8-12K tokens for ~716 lines), 7 phase gates with user responses (~4-8K), and error recovery buffer (~5K), the realistic range is **~23K-37K tokens** -- well within 200K.

However, this estimate assumes the orchestrator does not accidentally retain subagent transcripts. The plan should still add a compaction note: "After each phase gate, summarize prior phase outcomes into the state file and reference the file, not inline history." This is cheap insurance.

**Recommended fix**: Add a one-line compaction rule per phase boundary. The budget is not tight, but the instruction prevents accidental bloat.
**Status**: --> Settled (Codex's estimate is correct; add compaction rule as a best practice, not an existential fix)

### OP-8: No rollback strategy for cumulative drift
**Verdict**: AGREE with Codex Round 2
**Their claim**: Per-skill atomic commits plus targeted reverts already provide rollback. The issue is earlier drift detection, not missing rollback.
**My assessment**: Codex is right. The plan explicitly says each skill commits atomically (D5) and the risk table mentions "Git revert individual skill commits" as rollback. Round 1's "no rollback strategy" was inaccurate -- the strategy exists. What Round 1 was actually concerned about is drift *detection*, which is a different (and lower severity) issue. Phase 6's `/normalize` catches drift, and adding an inter-phase consistency check would be an enhancement, not a gap fix.
**Status**: --> Settled

### OP-9: Phase 3 AskUserQuestion ordering is fragile
**Verdict**: AGREE with Codex Round 2
**Their claim**: The ordering is already correct -- `/colorize` runs first, then the bolder/quieter choice. Nothing prevents later adjustment.
**My assessment**: Codex is right. Unit 7 explicitly sequences: `/colorize` first, then AskUserQuestion for bolder/quieter, then the intensity skill. The user sees color changes before making the intensity decision. And subsequent phase gates (after Phase 3 and all later phases) provide opportunities to revisit. Round 1's concern about the user "feeling locked in" is addressed by the existing gate structure.
**Status**: --> Settled

### OP-10: Diagnosis skills claimed read-only but /dogfood may modify files
**Verdict**: AGREE with Codex Round 2
**Their claim**: `/dogfood` and `/audit` are report-only by design.
**My assessment**: Codex is correct, and the evidence is stronger than Codex stated. The `/dogfood` skill's `allowed-tools` frontmatter is `Bash(agent-browser:*), Bash(npx agent-browser:*)` -- it literally cannot invoke Write, Edit, or any filesystem modification tool. It is sandboxed to browser automation only. The `/audit` skill explicitly says "Don't fix issues -- document them for other commands to address." Round 1's concern was not grounded in the actual skill definitions.

Adding an explicit "report only, do not modify files" line in the subagent prompt would be harmless belt-and-suspenders, but it is not fixing a real risk.
**Status**: --> Settled

### OP-11: 800-line prompt target may be unrealistic
**Verdict**: AGREE with Codex Round 2
**Their claim**: The plan itself is already 716 lines; the 800-line target is plausible. Token footprint matters more than line count.
**My assessment**: Codex is right. The plan (which includes extensive rationale, mermaid diagrams, test scenarios, and open questions that will NOT appear in the final prompt) is 716 lines. The actual prompt will be leaner -- it is instructions, not a plan document. 800 lines is achievable. And even if it reaches ~1000 lines, the token impact (~12-15K) is manageable given the ~23-37K total budget estimate. Round 1's suggestion to split into core + phase-reference files is over-engineering for this context.
**Status**: --> Settled

### AI-2: AskUserQuestion is not a real tool
**Verdict**: AGREE with Codex Round 2
**Their claim**: AskUserQuestion IS a real tool in Claude Code, documented across multiple skills.
**My assessment**: Codex is correct. Extensive evidence confirms this:
- Multiple skills in `~/.claude/skills/gstack/*/SKILL.md` declare `AskUserQuestion` in their `allowed-tools` frontmatter (qa, qa-only, retro, and others)
- The qa skill even has a dedicated "AskUserQuestion Format" section with structured usage guidance
- Cross-platform skills distinguish `AskUserQuestion` (Claude Code) from `request_user_input` (Codex) and `ask_user` (Gemini)

Round 1's claim that "this tool does not exist in the standard Claude Code toolset" was factually wrong. The plan's use of AskUserQuestion is correct.
**Status**: --> Settled

### AI-4: No definition of "verification failure" vs "minor issue"
**Verdict**: PARTIALLY AGREE with Codex Round 2
**Their claim**: The escalation logic is implied by D6, but the blocking/non-blocking boundary should be spelled out.
**My assessment**: Both rounds agree this needs more specificity -- the disagreement is only on severity. The plan should define:
- **Blocking**: non-zero exit from `pnpm run build`, `pnpm run lint`, or `pnpm test` (or smoke tests when applicable)
- **Auto-fixable**: `pnpm run format:check` failure --> run `pnpm run format` and re-check
- **Non-blocking**: diagnosis findings, polish observations, style preferences

This is a small addition (~3 lines in the prompt) with meaningful impact on orchestrator behavior.
**Recommended fix**: Add the three-tier definition above to Unit 1 (error recovery protocol).
**Status**: --> Settled

## Open Points

### NEW-1: Mandatory `/visual-verify` is missing from the plan
**My assessment**: This is a valid gap. The project's `CLAUDE.md` explicitly says: "You MUST invoke `/visual-verify` after editing `dashboard-template.ts`, `logs-template.ts`, any CSS, or any file that affects the Risoluto web UI." This is a repo-local contract, not optional. The plan's verification suite (build/lint/format/test/smoke) does not include `/visual-verify`. Since virtually every skill in this pipeline modifies UI files, `/visual-verify` should be part of the verification step for UI-changing phases (at minimum Phases 2-7).

**Recommended fix**: Add `/visual-verify` to the verification commands for phases that modify UI files. This can be a post-phase check rather than per-skill to keep the pipeline efficient.
**Status**: --> Settled (valid gap, straightforward fix)

### NEW-2: Baseline/after screenshot strategy is nondeterministic
**My assessment**: Valid observation but lower severity than framed. The plan's screenshots serve a **qualitative** purpose -- they give the user visual evidence of changes at phase gates. They are not meant to be pixel-perfect deterministic diffs (that is what the Playwright visual tests with clock freezing handle). The plan should clarify this intent explicitly so the orchestrator does not try to do programmatic image diffing on nondeterministic screenshots.

**Recommended fix**: Add a note: "Screenshots are qualitative review evidence. For deterministic visual regression, rely on the Playwright visual test suite (`--project=visual`)."
**Status**: --> Settled (clarification, not a design change)

## Additional Issues Found

None. The plan's gaps have been thoroughly surfaced across three rounds.

## Revised Scores

| Dimension | R1 (Claude) | R2 (Codex) | R3 (Claude) | Delta (R2->R3) |
|-----------|-------------|------------|-------------|-----------------|
| Completeness | 7 | 8 | 8 | 0 |
| Sequencing & Dependencies | 8 | 8 | 8 | 0 |
| Risk Coverage | 5 | 7 | 7 | 0 |
| Feasibility | 5 | 7 | 8 | +1 |
| Edge Cases | 6 | 7 | 7 | 0 |
| Clarity | 8 | 8 | 8 | 0 |
| Scope Discipline | 9 | 9 | 9 | 0 |
| ROI / Effort | 7 | 7 | 7 | 0 |
| Goal Alignment | 8 | 8 | 8 | 0 |
| **Overall** | **6** | **7** | **7** | **0** |

Feasibility moves from 7 to 8 now that OP-1 (skill invocation) and AI-2 (AskUserQuestion) are confirmed as working platform features. The remaining conditions are all small, concrete additions. Overall stays at 7 because the conditions have not been applied to the plan yet -- once they are folded in, this is an 8.

## Verdict

**CONDITIONAL GO -- 86%**

All 11 contested points and 2 open points are now settled. Zero contested, zero open. The plan is ready for finalization with the following amendments:

### Amendments to fold in during finalization

1. **D1 wording**: Name the SlashCommand tool / `context: fork` mechanism explicitly.
2. **D6 wording**: Clarify build-error-resolver is dispatched via Agent tool with agent definition, add repo-specific command overrides.
3. **Smoke test count**: Update to verified count (117/16 or 121/17) or remove hard-coded count.
4. **Context compaction**: Add a one-line rule after each phase gate to summarize prior phases into state files.
5. **Verification tiers**: Define blocking / auto-fixable / non-blocking criteria (3 lines).
6. **`/visual-verify`**: Add to verification commands for UI-changing phases.
7. **Screenshot intent**: Clarify screenshots are qualitative evidence; deterministic regression uses Playwright visual suite.

All amendments are small, concrete, and can be applied during finalization without restructuring. This plan is ready to finalize.
