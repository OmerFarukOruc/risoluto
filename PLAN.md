# PLAN

## Goal

Run an autonomous architecture-improvement loop that repeatedly deepens one Risoluto module at a time, validates the slice, commits it, records the learning, and continues until no safe evidence-backed candidate remains.

## Current Strategy

Start each iteration from the current repo state. Use the `improve-codebase-architecture` discipline to discover real friction, rank candidates, choose the strongest safe actionable candidate without asking the user, write a concrete one-slice plan, implement only that slice, validate, commit, and record the result.

## Phase Checklist

- [ ] Read `CONTROL.md`, repo instructions, README, relevant docs, tests, and source.
- [ ] Discover current architecture friction.
- [ ] Rank candidates as `Strong`, `Worth exploring`, or `Speculative`.
- [ ] Choose the strongest safe actionable candidate autonomously.
- [ ] Write the per-slice plan before edits.
- [ ] Implement exactly one architecture slice.
- [ ] Run focused checks.
- [ ] Run `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`.
- [ ] Run browser and Playwright verification if UI behavior changed.
- [ ] Update `ATTEMPTS.md` and `NOTES.md`.
- [ ] Commit atomically.
- [ ] Continue from the new repo state.

## Current Candidate Plan Template

Use this section before editing code in each iteration.

### Candidate Ranking

| Candidate | Rank | Evidence | Blockers | Why Now |
| --- | --- | --- | --- | --- |
| _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |

### Chosen Candidate

- Candidate: _pending_
- Reason chosen: _pending_
- Current problem: _pending_
- Deeper module/interface being created or simplified: _pending_
- Affected files: _pending_
- Compatibility expectations: _pending_
- Tests to add or update: _pending_
- Docs or ADRs to update: _pending_
- Validation commands: _pending_

## Open Decisions

- None for candidate choice. The agent must choose autonomously.
- Any candidate needing missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, or behavior-changing authority must be skipped and recorded.
