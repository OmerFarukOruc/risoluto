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

| Candidate                                                 | Rank            | Evidence                                                                                                                                                                                                                                                                                                                                                         | Blockers                                                                                                                                                                                                                   | Why Now                                                                                                                                                                                           |
| --------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move setup GitHub HTTP behind `GitHubTransport`           | Strong          | `src/setup/setup-service.ts` still owns raw GitHub token validation, default-branch fetches, headers, unauthenticated fallback, and hardcoded `https://api.github.com` calls while `src/github/transport.ts` already owns GitHub HTTP request construction and payload parsing. Tests in `tests/setup/detect-default-branch.test.ts` assert this route behavior. | Must preserve setup behavior: token validation still uses GitHub's `token` auth scheme, default-branch detection still tries authenticated first, then public, and failures still fall back to `main` through the handler. | This is repeated ownership after the Git context slice. Extending the existing transport interface for token auth scheme and anonymous requests gives setup more depth without adding a new seam. |
| Move GitHub health probe HTTP onto `GitHubTransport`      | Worth exploring | `src/health/runtime/github-http.ts` duplicates some GitHub headers and base URL handling, but it also owns probe-specific result mapping: status `0`, scope parsing, body excerpts, rate-limit parsing, and timeout classification.                                                                                                                              | Using the transport may or may not improve locality because the health probe's interface is intentionally not a generic GitHub API interface.                                                                              | Revisit only after setup HTTP is deeper, and only if the probe can keep its adapter-specific implementation clear.                                                                                |
| Broaden setup GitHub repo URL parsing beyond `github.com` | Speculative     | `parseOwnerRepo()` and setup route validation intentionally accept only `github.com`/`www.github.com`; custom GitHub API docs exist elsewhere.                                                                                                                                                                                                                   | This would change setup behavior and trust posture, requiring user intent/security authority.                                                                                                                              | Do not implement inside this architecture loop.                                                                                                                                                   |

### Chosen Candidate

- Candidate: Move setup GitHub HTTP behind `GitHubTransport`
- Reason chosen: Strong current evidence of repeated ownership with a safe test surface. Setup's GitHub token validation and default-branch detection are still raw `fetch` implementations even though the GitHub transport module already owns request construction, token headers, payload parsing, and non-2xx handling.
- Current problem: `src/setup/setup-service.ts` mixes setup workflow implementation with GitHub HTTP details: token-validation headers, default-branch headers, authenticated/public retry ordering, direct response parsing, and hardcoded API URLs. This weakens locality because future GitHub request behavior has to be checked in both setup and the transport module.
- Deeper module/interface being created or simplified: Extend the existing `GitHubTransport` interface just enough to support setup's real adapter variation: the `token` auth scheme used by `/user` validation and anonymous public repo fetches. Then make setup use the transport implementation while keeping setup-specific fallback and `SetupServiceError` behavior local.
- Affected files:
  - `src/github/transport.ts`
  - `src/setup/setup-service.ts`
  - `tests/github/transport.test.ts`
  - `tests/setup/detect-default-branch.test.ts`
  - `tests/setup/github-token-handler.test.ts`
  - `tests/setup/api-auth.test.ts`
  - `PLAN.md`, `ATTEMPTS.md`, `NOTES.md`
- Compatibility expectations: `/api/v1/setup/github-token` still returns `{ valid: true }` only for an ok GitHub `/user` response and stores `GITHUB_TOKEN` only then. `detectDefaultBranch()` still tries authenticated repo lookup first when a token exists, falls back to public lookup on non-ok/malformed authenticated responses, throws `GitHub API returned <status>` for failed public lookup, and the handler still returns `main` on lookup failure. No UI behavior changes.
- Tests to add or update: Add transport coverage for non-Bearer auth scheme and omitted authorization. Keep setup route/helper tests aligned with the same URLs and headers through the transport interface.
- Docs or ADRs to update: None; this aligns implementation with existing operator and trust docs.
- Validation commands:
  - `pnpm exec vitest run tests/github/transport.test.ts tests/setup/detect-default-branch.test.ts tests/setup/github-token-handler.test.ts tests/setup/api-auth.test.ts`
  - `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`

## Open Decisions

- None for candidate choice. The agent must choose autonomously.
- Any candidate needing missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, or behavior-changing authority must be skipped and recorded.

## Latest Result

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
