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

| Candidate                                      | Rank        | Evidence                                                                                                                                                                                                                                   | Blockers                                                                                  | Why Now                                                                                                                                                       |
| ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Align architecture docs after runtime cleanup  | Strong      | Fresh scan after `45a827e` showed `docs/ARCHITECTURE_DEEPENING_EXECPLAN.md` still says `frontend/src/state/polling.ts` and `frontend/src/state/event-source.ts` remain as migration-safe facades even though current source removed them. | Must preserve historical decision context while correcting current-state guidance.         | The goal explicitly treats docs/tests/runtime disagreement as architecture friction. Leaving stale module guidance would reduce future locality and leverage. |
| Keep webhook composition compatibility surface | Speculative | `src/webhook/composition.ts` is marked as compatibility, but current CLI/service wiring uses it to compose persistence, health, registration, secrets, and handler deps behind a stable service-level interface.                             | Deleting it would push runtime assembly into CLI/service wiring and likely reduce locality. | Do not implement unless repeated webhook runtime ownership appears in current callers.                                                                         |
| Keep setup default-branch route adapter as-is  | Speculative | `src/setup/detect-default-branch.ts` re-exports setup service helpers for tests, but it still owns the route adapter for `/api/v1/setup/detect-default-branch` and delegates implementation through `SetupService`.                          | Removing or widening it would risk route contract churn with weak leverage.                | Do not implement unless route adapter behavior becomes duplicated elsewhere.                                                                                    |

### Chosen Candidate

- Candidate: Align architecture docs after runtime cleanup
- Reason chosen: Strong. The code now has a deeper frontend runtime module/interface, but the architecture execution plan still describes deleted facade modules as current. That docs/runtime disagreement would mislead the next iteration.
- Current problem: `docs/ARCHITECTURE_DEEPENING_EXECPLAN.md` preserves useful historical decisions, but its current-state Milestone 4 section and summary still say `polling.ts` and `event-source.ts` remain as migration-safe facades.
- Deeper module/interface being created or simplified: No code module is changed. This slice updates the architecture documentation interface so future agents see the real implementation state: `RuntimeClient` is the direct module seam for polling, stale-banner dismissal, SSE, subscriptions, and runtime event filtering.
- Affected files:
  - `docs/ARCHITECTURE_DEEPENING_EXECPLAN.md`
  - `PLAN.md`, `ATTEMPTS.md`, `NOTES.md`
- Compatibility expectations: Documentation-only update. Preserve historical decision dates while clarifying that the facade removal has since happened.
- Tests to add or update: None; no runtime behavior changes.
- Docs or ADRs to update: Update current-state Milestone 4 text and add a revision note for the facade removal.
- Validation commands:
  - `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`

## Open Decisions

- None for candidate choice. The agent must choose autonomously.
- Any candidate needing missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, or behavior-changing authority must be skipped and recorded.

## Latest Result

- 2026-05-22T17:47:08+03:00: Architecture docs alignment slice implemented and validated. Required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3770` with `1` skipped. UI verification was not required because this was documentation-only.
- 2026-05-22T17:43:20+03:00: Planning the next slice: align `docs/ARCHITECTURE_DEEPENING_EXECPLAN.md` with the now-removed frontend runtime facades.
- 2026-05-22T17:39:28+03:00: Frontend runtime compatibility facade slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/frontend/runtime-client.test.ts tests/frontend/logs-timeline.test.ts` (`17` tests passed). Focused build passed with `pnpm run build`. Relevant Playwright smoke passed with `pnpm exec playwright test --project=smoke tests/e2e/specs/smoke/setup-gate.spec.ts` (`4` tests passed) after installing the missing local Playwright Chromium runtime. Browser verification passed against `/`: overview rendered, stale banner dismiss hid `#stale-banner`, and the final mocked run had no console/page/request errors. Required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3770` with `1` skipped.
- 2026-05-22T17:26:52+03:00: Planning the next slice: remove frontend runtime compatibility facades and keep callers/tests on the deeper `RuntimeClient` module/interface.
- 2026-05-22T17:21:58+03:00: Legacy setup handler barrel slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/http/routes.test.ts tests/setup/api.test.ts tests/setup/handlers.integration.test.ts` (`58` tests passed). Required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3777` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T17:19:23+03:00: Planning the next slice: remove the legacy `setup-handlers` compatibility barrel and wire setup routes to the active handler module/port directly.
- 2026-05-22T17:16:14+03:00: Setup shared helper slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/setup/api.test.ts tests/setup/linear-project-handler.test.ts tests/setup/handlers.integration.test.ts tests/setup/master-key-handler.test.ts tests/setup/reset-handler.test.ts tests/setup/status-handler.test.ts` (`59` tests passed). Required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3777` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T17:12:40+03:00: Planning the next slice: remove the stale setup handler Linear GraphQL helper seam while preserving setup route behavior through `SetupService`.
- 2026-05-22T17:10:00+03:00: Notification webhook delivery slice committed as `6d72167`.
- 2026-05-22T17:05:22+03:00: Notification webhook delivery slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/notification/webhook-delivery.test.ts tests/notification/slack-webhook.test.ts tests/notification/webhook-channel.test.ts tests/notification/manager.test.ts` (`43` tests passed). Required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3793` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T17:01:36+03:00: Planning the next slice: deepen notification webhook delivery implementation while preserving Slack/generic adapter payload locality.
- 2026-05-22T16:59:31+03:00: GitHub health transport slice committed as `9add56e`.
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
