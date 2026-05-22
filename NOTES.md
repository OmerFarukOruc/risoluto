# NOTES

## Chronological Notes

- 2026-05-22T15:33:15+03:00 Created the `/goal` scaffold for an autonomous architecture-improvement loop. This did not implement an architecture slice.
- 2026-05-22T15:33:15+03:00 Existing dirty files before scaffolding were `.codex/config.toml`, `.codex/hooks.json`, and `.codex/hooks/`; preserve them as unrelated user/pre-existing changes.
- 2026-05-22T15:33:15+03:00 Existing `docs/ARCHITECTURE_DEEPENING_EXECPLAN.md` contains prior architecture deepening history. Treat it as context only. Every iteration must re-read current repo state before choosing a candidate.
- 2026-05-22T15:33:15+03:00 Goal-forge config check reported Codex CLI likely supports `/goal`, the project is trusted, model is `gpt-5.5`, reasoning settings are high/xhigh, and `[features].goals` is true. It also reported autonomous gaps: `model_context_window`, `model_auto_compact_token_limit`, `approval_policy`, and `sandbox_mode` are unset in the inspected config.
- 2026-05-22T15:34:49+03:00 Full scaffold validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`. Lint emitted existing warning-only inventory; Vitest reported 3771 passing tests and 1 skipped test.
- 2026-05-22T15:47:00+03:00 First real iteration chose GitHub label provisioning as the strongest safe candidate. Evidence: `src/tracker/github-adapter.ts` still owns raw GitHub HTTP request, token, endpoint, and label readback implementation, while `src/github/issues-client.ts` already owns the GitHub transport interface. The planned depth move is to put label provisioning behind the client interface and keep the tracker adapter focused on tracker provision mapping.
- 2026-05-22T15:53:11+03:00 GitHub label provisioning slice validated. `GitHubIssuesClient.ensureLabel()` now owns create-vs-existing label status behavior and `GitHubTrackerAdapter` maps that client-owned result into `TrackerProvisionCreateLabelResult`. This improved locality by removing adapter-local GitHub HTTP/auth/header knowledge without changing tracker provision behavior.
- 2026-05-22T15:55:21+03:00 Next iteration chose GitHub webhook handling extraction. Evidence: `src/webhook/http-adapter.ts` currently contains Linear and GitHub provider-specific validation/dispatch in one implementation, while docs and `tests/http/github-webhook-handler.test.ts` define a stable GitHub route contract. The planned depth move is a provider-local GitHub webhook module with the same handler interface.
- 2026-05-22T16:01:16+03:00 GitHub webhook handling slice validated. `src/webhook/github-handler.ts` now owns the GitHub webhook implementation behind the `handleWebhookGitHub(deps, req, res)` interface: signing-secret lookup, `X-Hub-Signature-256` verification, event/delivery header validation, durable inbox requirement, delivery context construction, repo matching, supported issue action dispatch, targeted refresh, and closed-issue worker stop behavior. This improves provider locality and leverage while keeping `/webhooks/github` behavior compatible.
- 2026-05-22T16:01:16+03:00 Compatibility note: `src/webhook/http-adapter.ts` still re-exports GitHub webhook symbols so existing imports through the old seam continue to work. New direct callers can import from `src/webhook/github-handler.ts`.
- 2026-05-22T16:08:50+03:00 Linear webhook provider-local module slice validated. `src/webhook/linear-handler.ts` now owns the Linear webhook implementation behind the `handleWebhookLinear(deps, req, res)` interface: current/previous secret lookup, `Linear-Signature` verification, replay-window checks, `Linear-Delivery` extraction, delivery workflow wiring, issue/comment refresh dispatch, and terminal-state worker stop behavior. This improves locality and leverage by matching the provider-local GitHub module and removing the shallow `src/webhook/http-adapter.ts` seam.
- 2026-05-22T16:08:50+03:00 Validation note: the first required validation run found only Prettier drift in touched `tests/http/webhook-handler.test.ts`; formatting that file fixed the issue, and the full required validation then passed.

## Durable Architecture Rubric

- A module is deeper when callers get more leverage through a smaller or clearer interface.
- A module has better locality when behavior, tests, bugs, and future changes concentrate in one implementation instead of repeating across callers.
- A seam is suspect when it has only one adapter and no proven testability or runtime need.
- The deletion test is mandatory: if deleting a module makes complexity vanish instead of reappearing across callers, the module was probably shallow.
- Candidate ranking must distinguish `Strong`, `Worth exploring`, and `Speculative`.

## Skipped or Blocked Candidates

- None yet. Populate this section when a candidate requires missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, unavoidable behavior changes, or unresolved validation failures.
