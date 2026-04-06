## Debate Ledger
**Plan**: feat: v1.0 UI/UX polish orchestrator prompt
**Round**: 4 (FINALIZED)

### FINALIZED
All 18 settled points have been merged into the plan on 2026-04-01 by claude-opus-4.6. The plan status is now `finalized`. See `reviews/004-finalize-claude-opus-4.6-2026-04-01.md` for the full changelog.

### Settled (all models agree)
- **OP-1: Skill invocation inside Agent subagents is unproven** (CRITICAL -> resolved) -- Claude changelog confirms SlashCommand tool and `context: fork` sub-agent skill support. Not an existential blocker. Fix: name the mechanism explicitly in D1. Settled round 3. **Applied in finalization.**
- **OP-2: build-error-resolver is an agent, not a skill** (HIGH -> resolved) -- D6 already uses "subagent" phrasing, structurally compatible. Browser-tool gap is irrelevant for verification-command failures. Fix: one-sentence clarification in D6 + repo-specific commands. Settled round 3. **Applied in finalization.**
- **OP-3: Smoke test count is stale** (LOW) -- Verified: 117 test( calls across 16 *.smoke.spec.ts files, or 121 across all 17 *.spec.ts files (includes setup-gate.spec.ts). Plan's "119/17" is wrong in both dimensions. Fix: update count or remove hard-coded numbers. Settled round 3. **Applied in finalization.**
- **OP-4: Visual baseline count needs context** (LOW) -- Plan's 7/4 count is correct. No fix needed. Settled round 3. **No change needed.**
- **OP-5: Context window budget is hand-waved** (HIGH -> LOW) -- Realistic estimate is ~23-37K tokens, well within 200K. Fix: add a one-line compaction rule per phase boundary as best practice. Settled round 3. **Applied in finalization (new D9).**
- **OP-6: Dev server lifecycle has no health monitoring** (MEDIUM) -- Add pre-dispatch health check and restart flow. Settled round 2. **Applied in finalization (D3 updated).**
- **OP-7: Screenshots of parameterized routes require data** (MEDIUM) -- Baseline capture needs discovered IDs or seeded/mock scenario. Settled round 2. **Applied in finalization.**
- **OP-8: No rollback strategy for cumulative drift** (MEDIUM -> resolved) -- Per-skill atomic commits (D5) plus targeted reverts already provide rollback. Phase 6 `/normalize` catches drift. Settled round 3. **No change needed.**
- **OP-9: Phase 3 AskUserQuestion ordering is fragile** (LOW -> resolved) -- Ordering is correct: `/colorize` first, then bolder/quieter choice. Subsequent gates allow revisiting. No fix needed. Settled round 3. **No change needed.**
- **OP-10: Diagnosis skills claimed read-only but /dogfood may modify files** (MEDIUM -> resolved) -- `/dogfood` allowed-tools is `Bash(agent-browser:*)` only; cannot invoke Write/Edit. `/audit` explicitly says "Don't fix issues." No real risk. Settled round 3. **No change needed.**
- **OP-11: 800-line prompt target may be unrealistic** (MEDIUM -> resolved) -- Plan is 716 lines with rationale/diagrams; prompt will be leaner. Even at ~1000 lines, token budget is fine. Settled round 3. **Line target softened to ~800-1000.**
- **OP-12: No handling of partial subagent failure** (MEDIUM) -- Missing summary/state files need explicit retry/skip/stop flow. Settled round 2. **Applied in finalization (new D8).**
- **AI-1: Route table correction needs backport to requirements** (LOW) -- Requirements/origin docs should reflect 16 screenshottable views, not 17. Settled round 2. **Applied in finalization.**
- **AI-2: AskUserQuestion is not a real tool** (MEDIUM -> resolved) -- AskUserQuestion IS a real Claude Code tool, declared in allowed-tools across multiple skills, with dedicated usage format documentation. Plan is correct. Settled round 3. **No change needed (plan was correct).**
- **AI-3: .ui-polish/ and screenshots/ not in .gitignore** (LOW) -- Ignore `.ui-polish/`, `screenshots/baseline/`, `screenshots/after/`. Settled round 2. **Applied in finalization.**
- **AI-4: No definition of "verification failure" vs "minor issue"** (MEDIUM) -- Define three tiers: blocking (build/lint/test non-zero), auto-fixable (format:check -> format), non-blocking (diagnosis findings/style). Settled round 3. **Applied in finalization (new Verification Tiers section).**
- **NEW-1: Mandatory `/visual-verify` is missing from the plan** (MEDIUM) -- Repo CLAUDE.md requires `/visual-verify` after UI changes. Add to verification for UI-changing phases. Settled round 3. **Applied in finalization.**
- **NEW-2: Baseline/after screenshot strategy is nondeterministic** (MEDIUM -> LOW) -- Screenshots are qualitative evidence; deterministic regression uses Playwright visual suite. Clarify intent in plan. Settled round 3. **Applied in finalization.**

### Contested (models disagree)
(none)

### Open (raised, not yet addressed by all)
(none)

### Score History
| Round | Version | Model | Overall | Verdict |
|-------|---------|-------|---------|---------|
| 1 | v1 | claude-opus-4.6 | 6/10 | CONDITIONAL GO 78% |
| 2 | v1 | codex-gpt-5.4 | 7/10 | CONDITIONAL GO 84% |
| 3 | v1 | claude-opus-4.6 | 7/10 | CONDITIONAL GO 86% |
| 4 | v1-finalized | claude-opus-4.6 | -- | FINALIZED |

### Finalization Amendments
All 18 points settled. All amendments applied to plan.md on 2026-04-01.
See `reviews/004-finalize-claude-opus-4.6-2026-04-01.md` for the full changelog.
