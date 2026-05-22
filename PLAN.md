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

| Candidate                                                 | Rank        | Evidence                                                                                                                                                                                                                                                          | Blockers                                                                                                                                                                                      | Why Now                                                                                                                                                              |
| --------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move GitHub health probe request mechanics onto transport | Strong      | `src/health/runtime/github-http.ts` still owns GitHub base URL joining, headers, token authorization, injected fetch, and abort signal request construction while `GitHubTransport` owns the GitHub HTTP module/interface. The probe adapter has no direct tests. | Must preserve probe-specific behavior: missing token returns status `0`, network failures return status `0` plus body excerpt, scope parsing stays local, and rate-limit parsing stays local. | The previous setup slice made the transport deep enough for real GitHub adapter variation. Adding signal support lets health reuse it without losing probe locality. |
| Split health probe result parsing into separate module    | Speculative | `src/health/runtime/github-http.ts` has local parsing helpers, but they are specific to the `GithubProbeHttp` adapter and not repeated elsewhere.                                                                                                                 | Extraction would create a small hypothetical seam with one adapter and weak leverage.                                                                                                         | Keep parsing local unless another probe or adapter repeats it.                                                                                                       |
| Broaden setup GitHub repo URL parsing beyond `github.com` | Speculative | `parseOwnerRepo()` and setup route validation intentionally accept only `github.com`/`www.github.com`; custom GitHub API docs exist elsewhere.                                                                                                                    | This would change setup behavior and trust posture, requiring user intent/security authority.                                                                                                 | Do not implement inside this architecture loop.                                                                                                                      |

### Chosen Candidate

- Candidate: Move GitHub health probe request mechanics onto transport
- Reason chosen: Strong current evidence of repeated ownership with a safe adapter surface. The health runtime adapter still builds GitHub HTTP requests by hand even though transport now owns the GitHub request interface. The probe-specific result mapping remains valuable and should stay local.
- Current problem: `src/health/runtime/github-http.ts` owns GitHub HTTP request implementation details: base URL concatenation, auth header construction, common GitHub headers, injected fetch, and abort signal forwarding. That weakens locality because transport changes now need to be checked in health too, but the health adapter should own only probe response mapping.
- Deeper module/interface being created or simplified: Add `signal` support to the existing `GitHubTransportRequest` interface and use `GitHubTransport.send()` inside the health adapter. Keep `GithubProbeHttp` as the probe adapter seam and keep status/body/scope/rate-limit mapping in its implementation.
- Affected files:
  - `src/github/transport.ts`
  - `src/health/runtime/github-http.ts`
  - `tests/github/transport.test.ts`
  - `tests/health/runtime/github-http.test.ts`
  - `PLAN.md`, `ATTEMPTS.md`, `NOTES.md`
- Compatibility expectations: GitHub health results stay compatible. Missing token still returns `{ status: 0, scopes: [], bodyExcerpt: "no GitHub token configured" }` without fetch. Network errors still return status `0`. Scope parsing, body excerpt truncation, and rate-limit parsing remain unchanged. Abort signals continue to pass to fetch.
- Tests to add or update: Add direct tests for `createGithubHttpAdapter()` and extend transport tests to prove `signal` is forwarded.
- Docs or ADRs to update: None; this aligns implementation with existing operator and trust docs.
- Validation commands:
  - `pnpm exec vitest run tests/github/transport.test.ts tests/health/runtime/github-http.test.ts tests/health/probes/github-probe.test.ts`
  - `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`

## Open Decisions

- None for candidate choice. The agent must choose autonomously.
- Any candidate needing missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, or behavior-changing authority must be skipped and recorded.

## Latest Result

- 2026-05-22T16:57:21+03:00: GitHub health transport slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/github/transport.test.ts tests/health/runtime/github-http.test.ts tests/health/probes/github-probe.test.ts` (`15` tests passed). Required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3790` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T16:48:12+03:00: Planning the next slice: move GitHub health probe request mechanics onto `GitHubTransport` while preserving the probe adapter's status/body/scope/rate-limit locality.
- 2026-05-22T16:47:01+03:00: Setup GitHub transport slice committed as `83b5cfd`.
- 2026-05-22T16:44:24+03:00: Setup GitHub transport slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/github/transport.test.ts tests/setup/detect-default-branch.test.ts tests/setup/github-token-handler.test.ts tests/setup/api-auth.test.ts` (`55` tests passed), followed by `pnpm run build`. First required validation failed on `preserve-caught-error` for a mapped setup error; after preserving the `GitHubApiError` cause, required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3785` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T16:38:01+03:00: Planning the next slice: move setup GitHub HTTP behind the existing `GitHubTransport` module/interface while preserving token validation and default-branch fallback behavior.
- 2026-05-22T16:37:14+03:00: Git context GitHub transport slice committed as `021d973`.
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
