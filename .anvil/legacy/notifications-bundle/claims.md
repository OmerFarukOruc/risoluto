# Claims -- Notifications Bundle

- [passed] Risoluto now supports a typed multi-channel notification configuration that preserves legacy Slack settings while adding generic webhook and desktop delivery backends.
  Evidence: `src/core/types.ts`, `src/core/notification-types.ts`, `src/config/normalizers.ts`, `src/config/schemas/server.ts`, `src/cli/notifications.ts`, `src/notification/channel.ts`, `src/notification/webhook-channel.ts`, `src/notification/desktop.ts`
- [passed] `/notifications` is now a real persisted timeline backed by SQLite and `/api/v1/notifications`, with mark-read actions and realtime refresh wiring for notification events.
  Evidence: `src/persistence/sqlite/notification-store.ts`, `src/http/notifications-handler.ts`, `src/http/routes.ts`, `frontend/src/views/notifications-view.ts`, `frontend/src/state/event-source.ts`, `frontend/src/api.ts`
- [passed] External push ingress now includes signed GitHub webhook handling and authenticated generic trigger dispatch, including tracker-backed `create_issue` support.
  Evidence: `src/http/github-webhook-handler.ts`, `src/http/trigger-handler.ts`, `src/http/routes.ts`, `src/tracker/port.ts`, `src/tracker/github-adapter.ts`, `src/tracker/linear-adapter.ts`, `src/github/issues-client.ts`, `src/linear/client.ts`
- [passed] Cron-backed automations now register with the runtime, persist run history, and expose list plus manual-run APIs.
  Evidence: `src/automation/scheduler.ts`, `src/automation/runner.ts`, `src/persistence/sqlite/automation-store.ts`, `src/http/automations-handler.ts`, `src/cli/services.ts`, `src/cli/index.ts`
- [passed] Rule-based alerts now persist delivery history, enforce cooldown protection, ignore recursive `notification.*` events, and fan out through the configured notification channels.
  Evidence: `src/alerts/engine.ts`, `src/alerts/history-store.ts`, `src/http/alerts-handler.ts`, `src/core/risoluto-events.ts`, `src/notification/manager.ts`
- [passed] Operator docs, checked-in OpenAPI artifacts, unit or integration coverage, Playwright smoke coverage, Playwright visual coverage, and manual visual verification all match the shipped notification bundle.
  Evidence: `README.md`, `docs/OPERATOR_GUIDE.md`, `docs/TRUST_AND_AUTH.md`, `docs/ROADMAP_AND_STATUS.md`, `docs/CONFORMANCE_AUDIT.md`, `docs-site/openapi.json`, `tests/http/openapi-sync.test.ts`, `tests/e2e/specs/smoke/notifications.smoke.spec.ts`, `.anvil/notifications-bundle/verification/manual-visual-verify.md`
