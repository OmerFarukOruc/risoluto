---
title: Code review remediation for feat/app-server-provider-introspection-v2
slug: code-review-381-remediation
issue_url: https://github.com/OmerFarukOruc/risoluto/issues/381
status: ready
created_at: 2026-04-06T12:07:38+03:00
investigation:
  depth: deep
  files_read: 18
  completed_at: 2026-04-06T12:07:38+03:00
---

# Code review remediation for feat/app-server-provider-introspection-v2

## Summary

A four-agent code review on `feat/app-server-provider-introspection-v2` flagged 5 must-fix items, 10 P1 cluster items, ~13 P2 polish items, and ~9 P3 nits across security, webhook durability, notification system, and test coverage. This spec resolves all of them before merge. It also corrects one factual error in the source review: the Linear webhook handler is *not* asymmetric with GitHub — both handlers ACK before the inbox insert resolves, so the persist-before-ack fix must apply to both.

## Acceptance Criteria

### Security (P1 must-fix)

- `validateOpenaiKey` in `src/setup/handlers/openai-key.ts` routes operator-supplied `provider.baseUrl` through a new `normalizeOpenAiProviderBaseUrl` helper that mirrors `normalizeGitHubApiBaseUrl`: env-gated allowlist, HTTPS enforced unless explicitly opted out, default allowlist `api.openai.com` only.
- The same `normalizeOpenAiProviderBaseUrl` is invoked from `normalizeCodexProvider` so the overlay store can never persist a bypassing URL.
- `PROTECTED_READ_PREFIXES` in `src/http/read-guard.ts` includes `/api/v1/notifications`, `/api/v1/automations`, and `/api/v1/alerts`. `docs/TRUST_AND_AUTH.md` is updated to list the new protected prefixes.
- Bearer-token comparison in `src/http/read-guard.ts:106` and the query-token comparison at `:124` are migrated from `Array.includes()` to a `timingSafeEqual`-based helper that iterates unconditionally and OR's the result, matching the pattern that commit `a624c06` introduced for the trigger API key.

### Webhook durability (P1 must-fix, both handlers)

- `src/http/github-webhook-handler.ts` awaits `webhookInbox.insertVerified(...)` before `res.status(200).json({ ok: true })`. Only the downstream `requestTargetedRefresh` / `stopWorkerForIssue` calls run as background side-effects.
- `src/http/webhook-handler.ts` (Linear) is changed to the same shape: `await deps.webhookInbox.insertVerified(...)` before `res.status(200)`. The current code starts the insert promise but does not await it before responding, leaving the same loss window.
- Both handlers preserve the existing dedup behaviour: if `insertVerified` reports `isNew: false`, side-effects are skipped; if the insert throws, the response is still 200 (delivery is lost rather than retried infinitely, matching today's failure mode) but the error is logged at `error` severity with `deliveryId`, `event`, and `action` context.
- Tests cover the new ordering: an `insertVerified` mock that resolves slowly proves the response is not sent until the insert resolves, on both handlers.

### Test coverage (P1 must-fix + P1 cluster + P2)

- `tests/http/openapi-contracts.integration.test.ts:748-780` replaces `expect.arrayContaining([...])` with full equality (`toEqual` on a sorted path list), so any new path that lacks AJV coverage breaks the test.
- `tests/helpers/http-server-harness.ts:145-170` is extended to wire the new stores (notifications, automations, alerts, prs, recovery, ingress) so the integration test can exercise the new routes against real handlers.
- Each new operation has at least one happy-path AJV validation against the response schema and one error-envelope validation.
- `tests/http/openapi-paths.test.ts:332-378` cross-builder invariants imports and includes all 8 builders (`buildStateAndMetricsPaths`, `buildIssuePaths`, `buildPrPaths`, `buildNotificationPaths`, `buildAutomationPaths`, `buildAlertPaths`, `buildIngressPaths`, `buildInfrastructurePaths`) — currently only 4 are checked, so duplicate operationIds in `Pr`, `Automation`, `Alert`, and `Ingress` go undetected.
- `tests/http/trigger-handler.test.ts` adds tests for: 503 `trigger_not_configured`, 503 tracker-missing, 400 no-title.
- `tests/http/github-webhook-handler.test.ts` adds tests for: 503 missing secret, 401 missing signature header, 400 missing event header, 401 missing rawBody.
- `src/http/notifications-handler.ts` gets direct unit tests mirroring the `handleTestSlackNotification` block: `parseLimit` 400, `unreadOnly` parsing, 503 store-missing, 404 not-found, 400 empty id.
- `tests/http/routes.test.ts` adds a `beforeEach` mock reset to remove order-dependence.
- `tests/alerts/engine.test.ts` (or equivalent) is rewritten to use fake timers with `afterEach` cleanup, asserts the event bus is detached on `stop()`, and adds branch coverage for `partial_failure`, disabled rules, and the self-event-skip path.
- `tests/http/automations-handler.test.ts` adds the 6 missing error-branch tests for `handleListAutomations`, `handleListAutomationRuns`, and `handleRunAutomation`.
- `tests/http/response-schemas-core.test.ts` is extended to cover the notification response schemas.

### Notification system (P1 cluster + P2)

- `notificationTestSchema` in `src/http/request-schemas.ts:97` is wired into `routes.ts:458-465` via `validateBody(notificationTestSchema)`. The `.strict()` mode is preserved so unknown fields are rejected.
- `NotificationManager.notify` in `src/notification/manager.ts:46-65` checks `isDuplicate(dedupeKey)` *before* calling `createNotificationRecord` / emitting `notification.created`. Duplicate emits are dropped at the gate, not after a row+SSE round-trip.
- `frontend/src/views/notifications-view.ts:307-315` validates `notification.href` against an `http:` / `https:` scheme allowlist before assigning it to the anchor, and switches `rel="noreferrer"` to `rel="noopener noreferrer"`.
- `markAllRead` in `src/persistence/sqlite/notification-store.ts:141-149` is wrapped in `db.transaction(() => { ... })()` and returns `result.changes` from the UPDATE rather than the pre-count, eliminating the count-then-update race.
- `WebhookNotificationChannel` in `src/notification/webhook-channel.ts:60-67` filters the user-supplied `headers` map: drop `Host`, `Cookie`, `Proxy-Authorization` (case-insensitive), cap header count (≤16) and total serialized header size (≤8 KiB).
- `WebhookNotificationChannel` constructor calls `normalizeNotificationWebhookUrl(this.options.url)` as a belt-and-suspenders runtime check, even though the config-time normalizer already does this.
- `NotificationManager.deliver` adds a per-channel cooldown / circuit breaker so a 429-ing webhook is not hammered every alert cycle. Minimum behaviour: if a channel returns a 429 or any 5xx three times within `cooldownMs`, skip it for the next `cooldownMs` window, log at `warn`.
- `frontend/src/state/event-source.ts:159-169` SSE notification subscriber stops calling the full-list refetch on every event. The subscriber now consumes the `notification` payload from the event and applies a delta in memory.
- `frontend/src/views/notifications-view.ts:138-150` removes the triple-trigger storm: pick one of (SSE created, SSE updated, `state:update` DOM event) as the canonical refresh path. The other two listeners are dropped or debounced.

### Resilience and operator surface (P1 cluster + P2)

- `AlertEngine.recentDeliveries` in `src/alerts/engine.ts:19,62` gets the same sweep pattern as `NotificationManager.remember`: on every `set`, walk the map and delete entries older than `cooldownMs * 2`.
- `src/agent-runner/preflight.ts:27` no longer wraps every preflight command in `["sh", "-lc", command]`. Either revert to raw `command/exec` semantics, or add a `preflight.shell: boolean` config option defaulting to `false` so existing configs do not silently change semantics. `docs/OPERATOR_GUIDE.md` documents the chosen behaviour.
- `buildCooldownKey` in `src/alerts/engine.ts:108` uses a separator that cannot collide with rule names. A null byte (`\u0000`) or a length-prefixed encoding is acceptable; `|` is not.
- `src/http/trigger-handler.ts:84-89` `safeStringEquals` no longer length-mismatch returns early (which leaks key length). Compare against a fixed-length expected buffer or always run `timingSafeEqual` against a padded buffer.
- `src/http/github-webhook-handler.ts:113` fallback `deliveryId` no longer relies on `Date.now()` alone. Use `${Date.now()}-${randomUUID().slice(0, 8)}` to mirror the Linear handler at `webhook-handler.ts:174`.
- `src/automation/runner.ts:120,155` throws `TypeError` (not `Error`) for contract violations, per the project rule in `CLAUDE.md`.
- `AutomationScheduler.sync` no longer uses `JSON.stringify(config)` as a change signature. Replace with a stable canonical encoding (sorted keys) or a content hash over normalized fields.

### Frontend + UI (P2 + P3)

- `frontend/src/styles/notifications.css:14-19` `notifications-toolbar` grid is fixed so it does not clip on viewports around 720 px.
- `frontend/src/components/runs-table.ts` `threadStatus` default class `is-status` is replaced with an explicit `mc-*` modifier mapping for every Codex thread type.
- `setup-openai-step.ts` inline-styled HTML strings are migrated to the design token system.
- `notifications-view.ts` `{onFilterChange, onMarkRead, onMarkAllRead}` bundle is extracted into a single named props object instead of being passed in 4 places.
- `notifications-view.ts` `renderPage` flashes the diff on full reload but not on mark-read; the visual cue is made consistent.
- `settings-section-defs.ts` Slack instructions render via `<ol>` (or with `white-space: pre-line` on the wrapper) so the literal `\n` characters render as line breaks.

### Test hygiene (P3)

- Test files that inline helpers are migrated to the `tests/<module>/<module>-fixtures.ts` pattern, matching `tests/orchestrator/orchestrator-fixtures.ts`.

### Out of scope — already addressed by in-flight commits

- The trigger-handler timing-safe compare (commit `a624c06`) is already in place at `src/http/trigger-handler.ts:84-89`. Only the read-guard path remains.
- Channel-name dedupe (commit `788016a`) already guards against the legacy slack collision in `src/config/normalizers.ts:194-209`. The P2 entry from the issue is no longer load-bearing.

## Current State

Branch `feat/app-server-provider-introspection-v2` is at commit `261f755` and ships ~12.6 k lines across 157 files. Architecture, schema discipline, and dual-backend (`SqliteXxxStore` / `MemoryXxxStore`) patterns hold up well; the issue does not contest any of that. The 5 must-fix items are clustered in the security and webhook-durability slices; the 10 P1 cluster items are mostly notification-system bugs and test-coverage gaps.

The most important factual correction to the source issue is around the webhook handlers. The issue says "The Linear handler persists *before* acking — this is an asymmetry, not a missing capability." That is wrong. `src/http/webhook-handler.ts:171-193` starts the `deps.webhookInbox.insertVerified(...)` promise (assigning it to a local `inboxResult` variable) but does *not* `await` it before `res.status(200).json({ ok: true })`. The insert is then consumed via `void inboxResult.then(...)` after the response. The semantics are functionally identical to `src/http/github-webhook-handler.ts:175-177`, which calls `res.status(200).json(...)` then `queueGitHubWebhookProcessing(deps, context)`. Both handlers race the database write against the response, so both have the same crash window. The fix has to apply to both.

Two items in the issue have already been partially addressed by commits that landed after the review was filed on 2026-04-04. Commit `a624c06` ("use timing-safe key comparison") added `safeStringEquals` to `src/http/trigger-handler.ts:84-89`, which fully resolves the trigger half of the timing-safe compare concern. The read-guard path at `src/http/read-guard.ts:106,124` was missed and still uses `Array.includes()`. Commit `788016a` ("skip legacy slack when name claimed") added a `channels.some((ch) => ch.name === "slack")` dedupe in `src/config/normalizers.ts:194-209`, which resolves the P2 "legacy slack dedupe collision" entry. The remediation does not need to revisit either of those.

The notification system has the highest concentration of bugs because the slice is new. `NotificationManager.notify` performs `createNotificationRecord` (which inserts a row and emits `notification.created` over SSE) before the `isDuplicate(dedupeKey)` check at `src/notification/manager.ts:50-56`, so under event storms the table grows one row per emit regardless of dedup. `notification-store.ts:141-149` runs `countUnread()` and the UPDATE as separate async statements with no transaction, returning the cached pre-count rather than the UPDATE's `changes`. The frontend assigns `notification.href` directly to the anchor with no scheme allowlist (`notifications-view.ts:307-315`), and uses `rel="noreferrer"` rather than `rel="noopener noreferrer"`. The `notificationTestSchema` Zod schema is defined `.strict()` in `request-schemas.ts:97` for "future extension" but `routes.ts:458-465` never calls `validateBody` on it, so the test endpoint silently accepts unknown fields.

Test coverage of the new surface is shallow. `tests/http/openapi-contracts.integration.test.ts:754` uses `expect.arrayContaining([...22 paths])` against a spec that now has 31+ paths, so AJV validation never runs against any new route — schema drift can land silently. `tests/http/openapi-paths.test.ts:332-378` cross-builder invariants only import 4 of the 8 path builders, missing `Pr`, `Automation`, `Alert`, and `Ingress`. The handler test files exist (`trigger-handler.test.ts` 6 tests, `github-webhook-handler.test.ts` 7 tests, `notifications-handler.test.ts` 6 tests) but each leaves load-bearing error branches uncovered. The `notifications-handler` list/read methods have no direct unit tests at all.

The remaining items are smaller surface bugs: an unbounded in-memory cooldown map in `AlertEngine.recentDeliveries`, a `["sh", "-lc", command]` wrap in `agent-runner/preflight.ts:27` that quietly changed exec semantics for existing operator configs, an unfiltered `headers` map in `WebhookNotificationChannel`, no backoff in `NotificationManager.deliver`, an SSE subscriber that throws away the payload and refetches the full list on every event, and a triple-trigger refetch storm on the notifications page. Plus a handful of P3 nits (cooldown key separator collision, length-leaking early return, `Error` vs `TypeError`, unstable `JSON.stringify` signature, an inline-styled setup step, a clipping CSS grid).

## Likely Touchpoints

### Backend
- `src/setup/handlers/openai-key.ts`
- `src/config/normalizers.ts` — extend with `normalizeOpenAiProviderBaseUrl`
- `src/http/read-guard.ts`
- `src/http/github-webhook-handler.ts`
- `src/http/webhook-handler.ts`
- `src/http/trigger-handler.ts`
- `src/http/request-schemas.ts`
- `src/http/routes.ts`
- `src/http/notifications-handler.ts`
- `src/notification/manager.ts`
- `src/notification/webhook-channel.ts`
- `src/persistence/sqlite/notification-store.ts`
- `src/alerts/engine.ts`
- `src/automation/runner.ts`
- `src/automation/scheduler.ts`
- `src/agent-runner/preflight.ts`

### Frontend
- `frontend/src/views/notifications-view.ts`
- `frontend/src/state/event-source.ts`
- `frontend/src/components/runs-table.ts`
- `frontend/src/views/setup-openai-step.ts`
- `frontend/src/views/settings-section-defs.ts`
- `frontend/src/styles/notifications.css`

### Tests
- `tests/http/openapi-contracts.integration.test.ts`
- `tests/http/openapi-paths.test.ts`
- `tests/http/trigger-handler.test.ts`
- `tests/http/github-webhook-handler.test.ts`
- `tests/http/notifications-handler.test.ts`
- `tests/http/automations-handler.test.ts`
- `tests/http/response-schemas-core.test.ts`
- `tests/http/routes.test.ts`
- `tests/alerts/engine.test.ts`
- `tests/helpers/http-server-harness.ts`

### Docs
- `docs/TRUST_AND_AUTH.md` — new protected read prefixes
- `docs/OPERATOR_GUIDE.md` — preflight shell semantics

## Context

This is a pre-merge gate, not a follow-up cleanup. The issue's verdict — "Not a merge blocker, but 5 items should land before merge (3 P1 security, 1 P1 backend, 1 P1 contract)" — sets the floor. The user has chosen to widen the spec to all P1 + P2 + P3 items, so the closing PR should leave the slice fully clean instead of carrying a follow-up tail. The branch is `feat/app-server-provider-introspection-v2` at `261f755`.

The repo's pre-push hook (described in `CLAUDE.md`) runs build, lint, format, format:check, vitest, knip, jscpd, Playwright smoke, semgrep, and type coverage on every push. Any AJV contract additions or notification-handler tests added by this work must keep the existing pre-push gate green; the gate cannot be skipped with `--no-verify`. The mutation-testing step is opt-in (`RUN_MUTATION=1`) and is *not* part of the default gate, so the spec does not require mutation-test additions.

The Linear webhook correction matters because shipping the GitHub-only fix would leave the same data-loss window open on the Linear path, which is the production tracker. Both handlers are reachable from public webhooks; both must persist before ack to honour Linear's and GitHub's at-least-once delivery semantics.

The two scope carve-outs (trigger timing-safe compare in `a624c06`, channel-name dedupe in `788016a`) are listed under Acceptance Criteria → "Out of scope" so the implementer does not waste a cycle re-fixing them. Reviewers can confirm by reading those commits.

## References

- Issue: https://github.com/OmerFarukOruc/risoluto/issues/381
- Branch: `feat/app-server-provider-introspection-v2`
- Investigated commit: `261f755`
- Recent commits relevant to scope carve-outs:
  - `a624c06` — handle explicit zero in normalizers, deduplicate channel names, use timing-safe key comparison
  - `788016a` — skip legacy slack when name claimed, make trigger rate limiter dynamic
- Source files verified during investigation:
  - `src/setup/handlers/openai-key.ts:38-51`
  - `src/http/read-guard.ts:7-19,106,124`
  - `src/http/github-webhook-handler.ts:122-167,169-178`
  - `src/http/webhook-handler.ts:106-220`
  - `src/notification/manager.ts:46-70`
  - `src/persistence/sqlite/notification-store.ts:141-149`
  - `src/http/request-schemas.ts:91-97`
  - `src/http/routes.ts:458-465`
  - `frontend/src/views/notifications-view.ts:307-315`
  - `src/agent-runner/preflight.ts:15-44`
  - `src/alerts/engine.ts:18-69,108-112`
  - `tests/http/openapi-contracts.integration.test.ts:744-781`
  - `tests/http/openapi-paths.test.ts:332-378`
- Project rules: `CLAUDE.md` (pre-push gate, code quality rules), `docs/TRUST_AND_AUTH.md` (read-guard policy)
