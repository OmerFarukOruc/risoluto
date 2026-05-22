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
- [x] Run browser and Playwright verification if UI behavior changed.
- [x] Update `ATTEMPTS.md` and `NOTES.md`.
- [x] Commit atomically.
- [ ] Continue from the new repo state.

## Current Candidate Plan Template

Use this section before editing code in each iteration.

### Candidate Ranking

| Candidate                                                                     | Rank        | Evidence                                                                                                                                                                                                                                                                                                                                              | Blockers                                                                                                                                                            | Why Now                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Move Git context GitHub HTTP behind `GitHubTransport` and `github.apiBaseUrl` | Strong      | `src/http/git-context.ts` still owns raw GitHub request construction, headers, response error parsing, and a hardcoded `https://api.github.com` base while `src/github/transport.ts` already owns the GitHub transport interface. `docs/OPERATOR_GUIDE.md` documents `github.apiBaseUrl` for GitHub Enterprise, but `/api/v1/git/context` ignores it. | Must keep `/api/v1/git/context` response shape and graceful GitHub failure behavior compatible. No credentials needed because route tests inject fetch and secrets. | This is a docs/tests/runtime disagreement plus repeated ownership. Reusing the existing transport module increases depth and locality without creating a new seam. |
| Extract Linear webhook event processing from the Linear handler               | Speculative | Fresh source inspection after the provider-local module slice shows `src/webhook/linear-handler.ts` is already provider-local and uses named local functions for signing, replay, delivery, issue/comment event handling, and worker stop behavior.                                                                                                   | Extraction would likely add a hypothetical seam with one adapter and no current testability or runtime need.                                                        | Keep as a note, not an implementation candidate, unless future webhook behavior grows real adapter variation or repeated ownership.                                |
| Split Docker command assembly phases in `src/docker/spawn.ts`                 | Speculative | Prior scan showed the file is coherent and already has named helper phases; friction is mostly function length.                                                                                                                                                                                                                                       | Would risk aesthetic extraction without stronger caller/test pain.                                                                                                  | Defer unless runtime config, auth injection, or mount ownership shows repeated caller friction.                                                                    |

### Chosen Candidate

- Candidate: Move Git context GitHub HTTP behind `GitHubTransport` and `github.apiBaseUrl`
- Reason chosen: Strong current evidence of repeated ownership and a docs/runtime disagreement. The existing GitHub transport module already provides the correct interface for REST requests, token injection, headers, injected fetch, and configurable API base URL. `/api/v1/git/context` should use that implementation instead of duplicating GitHub HTTP details.
- Current problem: `src/http/git-context.ts` enriches configured repos by hand-building GitHub REST calls with a local `githubGet()`, local headers, local error parsing, and a hardcoded `GITHUB_API_BASE`. That weakens locality because GitHub HTTP behavior is split between Git context and `GitHubTransport`, and it breaks documented GitHub Enterprise leverage because `config.github.apiBaseUrl` is ignored for this route.
- Deeper module/interface being created or simplified: Reuse `GitHubTransport` as the GitHub HTTP module/interface. Keep `git-context` focused on response shaping, active branch extraction, and graceful degradation; move request execution details behind the existing transport implementation.
- Affected files:
  - `src/http/git-context.ts`
  - `tests/http/git-context.test.ts`
  - `PLAN.md`, `ATTEMPTS.md`, `NOTES.md`
- Compatibility expectations: `/api/v1/git/context` response shape remains unchanged. Missing token still returns config-only repos with `githubAvailable=false`. GitHub request failures still degrade to config-only repo data with `githubAvailable=true`. The default endpoint remains `https://api.github.com`. Custom `config.github.apiBaseUrl` is now honored for repo enrichment.
- Tests to add or update: Update `tests/http/git-context.test.ts` mocks to exercise transport-readable responses, keep existing no-token/enriched/failure coverage, and add coverage proving a custom `github.apiBaseUrl` is used.
- Docs or ADRs to update: None; this aligns implementation with existing operator and trust docs.
- Validation commands:
  - `pnpm exec vitest run tests/http/git-context.test.ts tests/git/github-pr-client.test.ts tests/github/issues-client-extended.test.ts`
  - `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`

## Open Decisions

- None for candidate choice. The agent must choose autonomously.
- Any candidate needing missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, or behavior-changing authority must be skipped and recorded.

## Latest Result

- 2026-05-22T16:33:32+03:00: Git context GitHub transport slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/http/git-context.test.ts tests/git/github-pr-client.test.ts tests/github/issues-client-extended.test.ts` (`55` tests passed), followed by `pnpm run build`. Required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3783` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T16:29:41+03:00: Planning the next slice: move Git context GitHub HTTP behind `GitHubTransport` and honor the existing `github.apiBaseUrl` interface for `/api/v1/git/context`.
- 2026-05-22T16:23:17+03:00: Linear setup provisioning slice committed as `a840c02`.
- 2026-05-22T16:23:17+03:00: Linear setup provisioning slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/setup/api.test.ts tests/setup/linear-project-handler.test.ts tests/linear/client.test.ts tests/linear/linear-writeback.test.ts tests/tracker/linear-adapter.test.ts tests/setup/quick-start.test.ts` (`84` tests passed), followed by `pnpm run build`. First required validation found a compatibility failure in `tests/linear/linear-writeback.test.ts` after transport error messages moved into `LinearClient`; the slice now preserves the canonical client transport message while the setup adapter surfaces raw network cause messages for setup provisioning. Required validation then passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3782` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T16:11:51+03:00: Planning the next slice: move Linear setup provisioning GraphQL behind `LinearClient` and simplify `LinearTrackerAdapter` to provider-interface mapping.
- 2026-05-22T16:08:50+03:00: Linear webhook provider-local module slice committed as `ae6176d`.
- 2026-05-22T16:08:50+03:00: Linear webhook provider-local module slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/http/webhook-handler.test.ts tests/http/github-webhook-handler.test.ts tests/http/webhook-routes.test.ts` (`31` tests passed), followed by `pnpm run build`. First required validation found formatting drift in `tests/http/webhook-handler.test.ts`; after `pnpm exec prettier --write tests/http/webhook-handler.test.ts`, required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3773` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T16:05:08+03:00: Planning the next slice: move Linear webhook handling into `src/webhook/linear-handler.ts` and remove the shallow `src/webhook/http-adapter.ts` seam after updating imports.
- 2026-05-22T16:01:16+03:00: GitHub webhook handling extraction committed as `a7d943c`.
- 2026-05-22T16:01:16+03:00: GitHub webhook handling extraction implemented and validated. Focused validation passed with `pnpm exec vitest run tests/http/github-webhook-handler.test.ts tests/http/webhook-handler.test.ts tests/http/webhook-routes.test.ts` (`31` tests passed). Required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3773` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T15:55:21+03:00: Planning the next slice: GitHub webhook handling extraction.
- Previous result: GitHub label provisioning slice committed as `cd07db4`.
