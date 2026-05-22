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
| Move Linear webhook handling into a provider-local module and remove the shallow generic adapter | Strong | After `a7d943c`, `src/webhook/http-adapter.ts` contains only Linear webhook implementation plus old GitHub/signature compatibility exports. Callers in `src/http/routes/webhooks.ts`, `src/webhook/service.ts`, `src/webhook/composition.ts`, `src/webhook/port.ts`, `src/http/route-types.ts`, and tests still depend on the generic adapter name for Linear behavior. Deleting the adapter today would force import knowledge across those callers, proving the seam is shallow and weak on locality. | Security-sensitive, so the slice must be import-shape only: no signature, replay, delivery, or dispatch behavior changes. | The GitHub provider now has a local module. Linear should match that depth and remove the old pass-through seam before deeper Linear event-processing work. |
| Extract Linear webhook event processing from the Linear handler | Worth exploring | Linear handling still combines verification, replay checks, delivery workflow, issue/comment dispatch, and worker stop behavior. | Larger blast radius because it can accidentally change targeted refresh, broad refresh, previous-secret logging context, or stop-worker behavior. | Reconsider after the provider-local module exists and tests import the intended interface. |
| Split Docker command assembly phases in `src/docker/spawn.ts` | Speculative | The file is coherent and already has named helper phases; friction is mostly function length. | Would risk aesthetic extraction without stronger caller/test pain. | Defer unless runtime config, auth injection, or mount ownership shows repeated caller friction. |

### Chosen Candidate

- Candidate: Move Linear webhook handling into a provider-local module and remove the shallow generic adapter
- Reason chosen: Strong current evidence, no UI behavior, no credentials needed, and the slice improves provider locality by making both webhook providers expose their own handler module. It also removes a shallow seam whose interface is now mostly historical naming.
- Current problem: `src/webhook/http-adapter.ts` is no longer a real HTTP adapter. It is a Linear webhook handler with old compatibility exports for GitHub and signature helpers. Its interface is less clear than its implementation, and callers/tests must know that "http-adapter" means Linear. That weakens locality and makes the next Linear-specific improvement harder to plan through the intended interface.
- Deeper module/interface being created or simplified: Create `src/webhook/linear-handler.ts` as the Linear webhook module. Its interface is `handleWebhookLinear(deps, req, res)` plus `WebhookHandlerDeps` and `verifyLinearSignature`. Keep the implementation unchanged behind that provider-local interface. Delete `src/webhook/http-adapter.ts` after updating all source and test imports so the old shallow adapter seam does not remain.
- Affected files:
  - `src/webhook/linear-handler.ts`
  - `src/webhook/http-adapter.ts`
  - `src/webhook/service.ts`
  - `src/webhook/composition.ts`
  - `src/webhook/port.ts`
  - `src/http/routes/webhooks.ts`
  - `src/http/route-types.ts`
  - `tests/helpers/http-server-harness.ts`
  - `tests/http/webhook-handler.test.ts`
  - `PLAN.md`, `ATTEMPTS.md`, `NOTES.md`
- Compatibility expectations: `/webhooks/linear` behavior remains unchanged: missing secrets keep `503` with `Retry-After`, signature failures stay `401`, previous-secret rotation still works, invalid payloads stay `400`, replay rejection stays `401`, missing delivery stays `400`, duplicates still short-circuit through `WebhookDeliveryWorkflow`, issue/comment actions still refresh the same way, and terminal issue states still stop workers. `/webhooks/github` imports remain direct from `github-handler.ts`.
- Tests to add or update: Update Linear webhook tests and HTTP harness imports to the new module. Existing assertions remain the route-contract proof; run the matching Linear/GitHub route suites to prove no regression.
- Docs or ADRs to update: None; this is internal architecture with no operator-visible behavior change.
- Validation commands:
  - `pnpm exec vitest run tests/http/github-webhook-handler.test.ts tests/http/webhook-handler.test.ts tests/http/webhook-routes.test.ts`
  - `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`

## Open Decisions

- None for candidate choice. The agent must choose autonomously.
- Any candidate needing missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, or behavior-changing authority must be skipped and recorded.

## Latest Result

- 2026-05-22T16:08:50+03:00: Linear webhook provider-local module slice implemented and validated. Focused validation passed with `pnpm exec vitest run tests/http/webhook-handler.test.ts tests/http/github-webhook-handler.test.ts tests/http/webhook-routes.test.ts` (`31` tests passed), followed by `pnpm run build`. First required validation found formatting drift in `tests/http/webhook-handler.test.ts`; after `pnpm exec prettier --write tests/http/webhook-handler.test.ts`, required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3773` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T16:05:08+03:00: Planning the next slice: move Linear webhook handling into `src/webhook/linear-handler.ts` and remove the shallow `src/webhook/http-adapter.ts` seam after updating imports.
- 2026-05-22T16:01:16+03:00: GitHub webhook handling extraction committed as `a7d943c`.
- 2026-05-22T16:01:16+03:00: GitHub webhook handling extraction implemented and validated. Focused validation passed with `pnpm exec vitest run tests/http/github-webhook-handler.test.ts tests/http/webhook-handler.test.ts tests/http/webhook-routes.test.ts` (`31` tests passed). Required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3773` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T15:55:21+03:00: Planning the next slice: GitHub webhook handling extraction.
- Previous result: GitHub label provisioning slice committed as `cd07db4`.
