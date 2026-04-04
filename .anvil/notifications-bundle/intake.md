# Intake -- Notifications Bundle

## Request

User request on 2026-04-03: use the repo-local Anvil workflow for the Notifications bundle from roadmap epic [#354](https://github.com/OmerFarukOruc/risoluto/issues/354), covering issues `#254`, `#260`, `#262`, `#282`, `#286`, `#292`, `#308`, and `#315`.

No dry-run or planning-only stop condition was requested.

## Source Bundle

- [#254](https://github.com/OmerFarukOruc/risoluto/issues/254) -- Channel adapter pattern for multi-channel notifications
- [#260](https://github.com/OmerFarukOruc/risoluto/issues/260) -- Cron-based scheduled triggers for recurring actions
- [#262](https://github.com/OmerFarukOruc/risoluto/issues/262) -- Webhook trigger endpoints for external event-driven dispatch
- [#282](https://github.com/OmerFarukOruc/risoluto/issues/282) -- Rule-based alerting engine with multi-channel dispatch
- [#286](https://github.com/OmerFarukOruc/risoluto/issues/286) -- Cron-scheduled automation workflows with report modes
- [#292](https://github.com/OmerFarukOruc/risoluto/issues/292) -- Persistent typed notification system with dashboard API
- [#308](https://github.com/OmerFarukOruc/risoluto/issues/308) -- Cross-platform desktop notifications for agent completion
- [#315](https://github.com/OmerFarukOruc/risoluto/issues/315) -- Webhook receiver for push-based issue ingestion from Linear and GitHub

## Why This Bundle Belongs Together

All eight issues converge on the same cross-cutting seam: how events enter Risoluto, get scheduled or evaluated, fan out across delivery channels, and become durable operator-visible notifications. Grouping them together lets one implementation pass settle the ingress model, scheduling model, channel abstraction, persistence model, and dashboard/operator verification story coherently.

## Current Repo Reality

- Notification delivery already flows through `src/notification/channel.ts`, `src/notification/manager.ts`, and `src/notification/slack-webhook.ts`, but only Slack-webhook delivery is implemented today.
- Linear webhook verification and ingestion foundations already exist in `src/http/webhook-handler.ts`, `src/webhook/registrar.ts`, `src/webhook/health-tracker.ts`, and `src/persistence/sqlite/webhook-inbox.ts`.
- The repo already persists webhook deliveries for dedup/retry/audit, but it does not yet persist a typed operator notification feed or expose a full notification history API.
- There is no cron scheduler or automation subsystem yet, so scheduling and workflow/report modes remain greenfield relative to the current codebase.
- Some acceptance criteria imply operator-visible dashboard behavior (`#286`, `#292`), so frontend verification will likely be part of done once execution begins.

## Likely Touched Areas

- `src/notification/`
- `src/http/`
- `src/webhook/`
- `src/orchestrator/`
- `src/persistence/sqlite/`
- `src/config/`
- `frontend/src/`
- `README.md`
- `docs/OPERATOR_GUIDE.md`
- `docs/TRUST_AND_AUTH.md`
- `docs/CONFORMANCE_AUDIT.md`
- `tests/notification/`, `tests/http/`, `tests/webhook/`, `tests/orchestrator/`, `tests/e2e/`

## Scope For This Bundle

- Formalize multi-channel notification delivery and add at least one new delivery backend
- Add authenticated webhook-triggered dispatch paths for external systems
- Add cron-based triggers and automation workflow scheduling
- Add rule-based alert evaluation and channel routing
- Persist typed in-product notifications with API access and real-time/operator visibility
- Extend operator docs and automated coverage to prove the above behavior

## Explicitly Out Of Scope

- Unrelated tracker or plugin work outside the notification/trigger seam
- A broader dashboard redesign unrelated to notifications and automation visibility
- Provider-routing or runtime work that belongs to non-notification roadmap bundles

## Intake Status

Preflight cleared on 2026-04-03. Intake is accepted and has advanced into brainstorm-driven requirements hardening.

## Run Slug

`notifications-bundle`
