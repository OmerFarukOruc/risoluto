# PLAN

## Goal

Run an autonomous architecture-improvement loop that repeatedly deepens one Risoluto module at a time, validates the slice, commits it, records the learning, and continues until no safe evidence-backed candidate remains.

## Current Strategy

Start each iteration from the current repo state. Use the `improve-codebase-architecture` discipline to discover real friction, rank candidates, choose the strongest safe actionable candidate without asking the user, write a concrete one-slice plan, implement only that slice, validate, commit, and record the result.

## Phase Checklist

- [x] Read `CONTROL.md`, repo instructions, README, relevant docs, tests, and source.
- [x] Discover current architecture friction.
- [x] Rank candidates as `Strong`, `Worth exploring`, or `Speculative`.
- [x] Choose the strongest safe actionable candidate autonomously.
- [x] Write the per-slice plan before edits.
- [x] Implement exactly one architecture slice.
- [x] Run focused checks.
- [x] Run `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`.
- [ ] Run browser and Playwright verification if UI behavior changed.
- [x] Update `ATTEMPTS.md` and `NOTES.md`.
- [x] Commit atomically.
- [ ] Continue from the new repo state.

## Current Candidate Plan Template

Use this section before editing code in each iteration.

### Candidate Ranking

| Candidate | Rank | Evidence | Blockers | Why Now |
| --- | --- | --- | --- | --- |
| Deepen GitHub label provisioning behind `GitHubIssuesClient` | Strong | `src/tracker/github-adapter.ts` owns `getGitHubApiBaseUrl`, `getGitHubToken`, `getRepoPath`, `requestGitHub`, `readLabel`, and `createLabel`, duplicating the GitHub auth/header/endpoint implementation already owned by `src/github/issues-client.ts`. Tests for provisioning stub global `fetch` from the tracker adapter instead of the client interface. | None. Behavior can stay compatible and tests can move to the existing GitHub client surface. | The deletion test says this module is shallow in this area: deleting the adapter-local request helpers should not move GitHub HTTP details to callers; they belong in the GitHub client implementation. |
| Extract GitHub webhook request validation from `src/webhook/http-adapter.ts` | Worth exploring | `src/webhook/http-adapter.ts` still combines signature validation, context extraction, delivery workflow, and side-effect dispatch for two providers. | Higher blast radius because webhook behavior is security-sensitive and needs more route-contract proof. | Useful later, but not the safest first slice while a smaller Strong candidate exists. |
| Split Docker command assembly phases in `src/docker/spawn.ts` | Speculative | The file is coherent and already has named helper phases; friction is mostly function length. | Would risk aesthetic extraction without stronger caller/test pain. | Defer unless runtime config, auth injection, or mount ownership shows repeated caller friction. |

### Chosen Candidate

- Candidate: Deepen GitHub label provisioning behind `GitHubIssuesClient`
- Reason chosen: Strong current evidence, small blast radius, no user authority needed, no UI behavior, and a clear module/interface improvement.
- Current problem: `GitHubTrackerAdapter` is supposed to be a tracker adapter, but its GitHub setup label path owns raw GitHub HTTP request construction, token lookup, endpoint fallback, headers, label readback, and error-body formatting. That weakens locality because GitHub transport behavior is split between the adapter and `GitHubIssuesClient`.
- Deeper module/interface being created or simplified: Make `GitHubIssuesClient` the deeper module for GitHub issue/label implementation by adding label provisioning methods behind its existing interface. Simplify `GitHubTrackerAdapter` so its implementation calls the client and maps the result into the tracker provision interface.
- Affected files:
  - `src/github/issues-client.ts`
  - `src/tracker/github-adapter.ts`
  - `tests/github/issues-client-extended.test.ts`
  - `tests/tracker/github-adapter.test.ts`
  - `PLAN.md`, `ATTEMPTS.md`, `NOTES.md`
- Compatibility expectations: Public tracker provisioning behavior remains the same. `provision({ type: "create_label" })` still creates `risoluto`, returns `alreadyExists: false` on `201`, returns `alreadyExists: true` on existing-label `422`, and throws on other GitHub errors. GitHub endpoint/token/header semantics should match the existing `GitHubIssuesClient` implementation.
- Tests to add or update: Add `GitHubIssuesClient.createLabel` coverage for create and existing-label paths; update tracker adapter tests to assert delegation through the client interface instead of stubbing global `fetch`.
- Docs or ADRs to update: None; this is internal architecture with no operator-visible behavior change.
- Validation commands:
  - `pnpm exec vitest run tests/github/issues-client-extended.test.ts tests/tracker/github-adapter.test.ts`
  - `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`

## Open Decisions

- None for candidate choice. The agent must choose autonomously.
- Any candidate needing missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, or behavior-changing authority must be skipped and recorded.

## Latest Result

- 2026-05-22T15:53:11+03:00: GitHub label provisioning slice implemented and validated.
- Focused validation passed: `pnpm exec vitest run tests/github/issues-client-extended.test.ts tests/tracker/github-adapter.test.ts` (`37` tests passed).
- Required validation passed: `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted the existing warning-only inventory, and Vitest reported `3773` passing tests with `1` skipped test.
- UI verification was not required because no UI behavior changed.
