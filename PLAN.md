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
| Extract GitHub webhook handling into a provider-local module | Strong | `src/webhook/http-adapter.ts` owns both Linear replay/signature flow and GitHub signature/header validation, context extraction, repo filtering, issue dispatch, duplicate delivery wiring, and worker stop behavior. Docs in `docs/TRUST_AND_AUTH.md` and tests in `tests/http/github-webhook-handler.test.ts` define a stable GitHub route contract. | Security-sensitive, so keep the slice behavior-preserving and covered by existing route-contract tests. | The previous smaller Strong candidate is committed. This one now has enough route-contract evidence to deepen locality safely. |
| Extract Linear webhook event processing from `src/webhook/http-adapter.ts` | Worth exploring | Linear handling still combines verification, replay checks, delivery workflow, issue/comment dispatch, and worker stop behavior. | Larger blast radius because Linear has replay-window and previous-secret behavior plus broader tests. | Worth doing after GitHub provider logic is separated. |
| Split Docker command assembly phases in `src/docker/spawn.ts` | Speculative | The file is coherent and already has named helper phases; friction is mostly function length. | Would risk aesthetic extraction without stronger caller/test pain. | Defer unless runtime config, auth injection, or mount ownership shows repeated caller friction. |

### Chosen Candidate

- Candidate: Extract GitHub webhook handling into a provider-local module
- Reason chosen: Strong current evidence, route-contract tests already exist, no UI behavior, no credentials needed, and the slice improves provider locality while preserving the route interface.
- Current problem: `src/webhook/http-adapter.ts` is a mixed provider module. The GitHub path has its own interface concerns: `triggers.github_secret`, `X-Hub-Signature-256`, `X-GitHub-Event`, `X-GitHub-Delivery`, durable inbox requirement, repo matching, supported issue actions, targeted refresh, and worker stop behavior. Keeping those beside Linear replay/previous-secret behavior weakens locality and makes the module harder to test through the GitHub interface.
- Deeper module/interface being created or simplified: Create a `src/webhook/github-handler.ts` module whose interface is `handleWebhookGitHub(deps, req, res)` plus its deps type. Keep the implementation details for validation, context extraction, and GitHub issue dispatch local to that module. Simplify `src/webhook/http-adapter.ts` to own Linear handling and compatibility re-exports only.
- Affected files:
  - `src/webhook/github-handler.ts`
  - `src/webhook/http-adapter.ts`
  - `src/http/routes/webhooks.ts`
  - `tests/http/github-webhook-handler.test.ts`
  - `PLAN.md`, `ATTEMPTS.md`, `NOTES.md`
- Compatibility expectations: `/webhooks/github` behavior remains unchanged: signature failures stay `401`, missing event/delivery stay `400`, missing inbox stays `503 webhook_inbox_unavailable`, duplicate deliveries skip dispatch, configured repo mismatches are ignored, supported issue events request targeted refresh, and closed issues stop workers.
- Tests to add or update: Update `tests/http/github-webhook-handler.test.ts` to import the new module directly. Existing assertions remain the route-contract proof; run the matching GitHub and Linear webhook handler suites to prove no regression.
- Docs or ADRs to update: None; this is internal architecture with no operator-visible behavior change.
- Validation commands:
  - `pnpm exec vitest run tests/http/github-webhook-handler.test.ts tests/http/webhook-handler.test.ts tests/http/webhook-routes.test.ts`
  - `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`

## Open Decisions

- None for candidate choice. The agent must choose autonomously.
- Any candidate needing missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, or behavior-changing authority must be skipped and recorded.

## Latest Result

- 2026-05-22T16:01:16+03:00: GitHub webhook handling extraction implemented and validated. Focused validation passed with `pnpm exec vitest run tests/http/github-webhook-handler.test.ts tests/http/webhook-handler.test.ts tests/http/webhook-routes.test.ts` (`31` tests passed). Required validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`; lint emitted existing warning-only inventory, tests passed `3773` with `1` skipped. UI verification was not required because no UI behavior changed.
- 2026-05-22T15:55:21+03:00: Planning the next slice: GitHub webhook handling extraction.
- Previous result: GitHub label provisioning slice committed as `cd07db4`.
