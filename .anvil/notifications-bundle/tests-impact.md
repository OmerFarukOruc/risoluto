# Tests Impact -- Notifications Bundle

## Added or updated coverage

- [complete] `tests/config/notification-config.test.ts`
- [complete] `tests/config/normalizers.test.ts`
- [complete] `tests/config/url-policy.test.ts`
- [complete] `tests/cli/notifications.test.ts`
- [complete] `tests/frontend/api.test.ts`
- [complete] `tests/frontend/event-source.test.ts`
- [complete] `tests/http/alerts-handler.test.ts`
- [complete] `tests/http/automations-handler.test.ts`
- [complete] `tests/http/github-webhook-handler.test.ts`
- [complete] `tests/http/openapi-paths.test.ts`
- [complete] `tests/http/openapi.test.ts`
- [complete] `tests/http/request-schemas.test.ts`
- [complete] `tests/http/response-schemas-core.test.ts`
- [complete] `tests/http/routes.test.ts`
- [complete] `tests/http/trigger-handler.test.ts`
- [complete] `tests/notification/channel.test.ts`
- [complete] `tests/notification/desktop.test.ts`
- [complete] `tests/notification/manager.test.ts`
- [complete] `tests/notification/webhook-channel.test.ts`
- [complete] `tests/persistence/sqlite/automation-store.test.ts`
- [complete] `tests/persistence/sqlite/notification-store.test.ts`
- [complete] `tests/persistence/sqlite/schema-v2.test.ts`
- [complete] `tests/tracker/github-adapter.test.ts`
- [complete] `tests/tracker/linear-adapter.test.ts`
- [complete] `tests/alerts/engine.test.ts`
- [complete] `tests/automation/runner.test.ts`
- [complete] `tests/automation/scheduler.test.ts`
- [complete] `tests/e2e/mocks/api-mock.ts`
- [complete] `tests/e2e/specs/smoke/notifications.smoke.spec.ts`

## Gate results

- [passed] `pnpm exec vitest run tests/http/trigger-handler.test.ts tests/http/github-webhook-handler.test.ts`
- [passed] `pnpm exec vitest run tests/http/server.test.ts tests/http/openapi-sync.test.ts tests/frontend/settings-sections.test.ts`
- [passed] `pnpm run build`
- [passed] `pnpm run lint`
- [passed] `pnpm run format:check`
- [passed] `pnpm run typecheck`
- [passed] `pnpm run typecheck:frontend`
- [passed] `pnpm test`
- [passed] `pnpm exec playwright test tests/e2e/specs/smoke/notifications.smoke.spec.ts --project=smoke`
- [passed] `pnpm exec playwright test --project=smoke`
- [passed] `pnpm exec playwright test --project=visual`

## Final suite result

- `250` Vitest files passed
- `3236` Vitest tests passed
- `1` Vitest test skipped
- `123` Playwright smoke tests passed
- `23` Playwright visual tests passed
