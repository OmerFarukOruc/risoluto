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
- [ ] Commit atomically.
- [ ] Continue from the new repo state.

## Current Candidate Plan Template

Use this section before editing code in each iteration.

### Candidate Ranking

| Candidate | Rank | Evidence | Blockers | Why Now |
| --- | --- | --- | --- | --- |
| Move Linear setup provisioning GraphQL behind `LinearClient` | Strong | `src/tracker/linear-adapter.ts` still owns raw `fetch` request construction, endpoint/token lookup, GraphQL error handling, project/team/state parsing, and setup provisioning mutations while `src/linear/client.ts` already owns the Linear transport interface and related issue/webhook GraphQL implementation. This is repeated ownership across the adapter and client. | Behavior must stay compatible for setup project listing, project creation, smoke-test issue creation, and label creation. No live Linear credentials are needed because tests can mock `LinearClient.runGraphQL`. | The GitHub provisioning slice already deepened provider transport behind `GitHubIssuesClient`; Linear should get the same locality before smaller setup or webhook internals are considered. |
| Extract Linear webhook event processing from the Linear handler | Worth exploring | Linear handling still combines verification, replay checks, delivery workflow, issue/comment dispatch, and worker stop behavior. | Larger blast radius because it can accidentally change targeted refresh, broad refresh, previous-secret logging context, or stop-worker behavior. | Reconsider after the stronger repeated-ownership Linear provisioning slice. |
| Split Docker command assembly phases in `src/docker/spawn.ts` | Speculative | The file is coherent and already has named helper phases; friction is mostly function length. | Would risk aesthetic extraction without stronger caller/test pain. | Defer unless runtime config, auth injection, or mount ownership shows repeated caller friction. |

### Chosen Candidate

- Candidate: Move Linear setup provisioning GraphQL behind `LinearClient`
- Reason chosen: Strong current evidence of repeated ownership, no UI behavior, no credentials needed, and the slice improves depth by putting Linear setup GraphQL implementation behind the existing Linear client interface.
- Current problem: `LinearTrackerAdapter` delegates ordinary tracker operations to `LinearClient`, but setup provisioning is still implemented inside the adapter with its own `runGraphQL` transport, config lookup, raw `fetch`, response parsing, and Linear-specific mutations. That weakens locality: Linear GraphQL behavior is split between the adapter and client, while the adapter interface should stay focused on `TrackerPort` semantics.
- Deeper module/interface being created or simplified: Add Linear setup provisioning methods to `LinearClient` for project listing, project creation, smoke-test issue creation, and label creation. Simplify `LinearTrackerAdapter.provision()` so its implementation delegates provider transport and payload parsing to `LinearClient` and only maps `TrackerPort` provisioning requests to the client interface.
- Affected files:
  - `src/linear/client.ts`
  - `src/tracker/linear-adapter.ts`
  - `tests/linear/client.test.ts`
  - `tests/tracker/linear-adapter.test.ts`
  - `tests/setup/setup-fixtures.ts`
  - `src/tracker/factory.ts`
  - `PLAN.md`, `ATTEMPTS.md`, `NOTES.md`
- Compatibility expectations: Setup provisioning behavior remains unchanged: project listing returns the same project shape, selected project returns `{ ok: true }`, Linear project creation still chooses the first team, smoke-test issue creation still targets the selected project and "In Progress" state, label creation still treats duplicate errors as already provisioned, and transition/fetch/comment behavior remains delegated as before.
- Tests to add or update: Add/update `tests/linear/client.test.ts` coverage for the new Linear client provisioning methods and update `tests/tracker/linear-adapter.test.ts` to prove adapter provisioning delegates through the client interface. Adjust constructor call sites if the adapter no longer needs direct config access.
- Docs or ADRs to update: None; this is internal architecture with no operator-visible behavior change.
- Validation commands:
  - `pnpm exec vitest run tests/linear/client.test.ts tests/tracker/linear-adapter.test.ts tests/setup/setup-port.test.ts`
  - `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`

## Open Decisions

- None for candidate choice. The agent must choose autonomously.
- Any candidate needing missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, or behavior-changing authority must be skipped and recorded.

## Latest Result

- 2026-05-22T16:23:17+03:00: Linear setup provisioning slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/setup/api.test.ts tests/setup/linear-project-handler.test.ts tests/linear/client.test.ts tests/linear/linear-writeback.test.ts tests/tracker/linear-adapter.test.ts tests/setup/quick-start.test.ts` (`84` tests passed), followed by `pnpm run build`. First required validation found a compatibility failure in `tests/linear/linear-writeback.test.ts` after transport error messages moved into `LinearClient`; the slice now preserves the canonical client transport message while the setup adapter surfaces raw network cause messages for setup provisioning. Required validation then passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3782` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T16:11:51+03:00: Planning the next slice: move Linear setup provisioning GraphQL behind `LinearClient` and simplify `LinearTrackerAdapter` to provider-interface mapping.
- 2026-05-22T16:08:50+03:00: Linear webhook provider-local module slice committed as `ae6176d`.
- 2026-05-22T16:08:50+03:00: Linear webhook provider-local module slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/http/webhook-handler.test.ts tests/http/github-webhook-handler.test.ts tests/http/webhook-routes.test.ts` (`31` tests passed), followed by `pnpm run build`. First required validation found formatting drift in `tests/http/webhook-handler.test.ts`; after `pnpm exec prettier --write tests/http/webhook-handler.test.ts`, required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3773` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T16:05:08+03:00: Planning the next slice: move Linear webhook handling into `src/webhook/linear-handler.ts` and remove the shallow `src/webhook/http-adapter.ts` seam after updating imports.
- 2026-05-22T16:01:16+03:00: GitHub webhook handling extraction committed as `a7d943c`.
- 2026-05-22T16:01:16+03:00: GitHub webhook handling extraction implemented and validated. Focused validation passed with `pnpm exec vitest run tests/http/github-webhook-handler.test.ts tests/http/webhook-handler.test.ts tests/http/webhook-routes.test.ts` (`31` tests passed). Required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3773` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T15:55:21+03:00: Planning the next slice: GitHub webhook handling extraction.
- Previous result: GitHub label provisioning slice committed as `cd07db4`.
