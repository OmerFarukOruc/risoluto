# Verify Charter -- Notifications Bundle

## Verification questions

1. Can operators configure multi-channel notifications without breaking legacy Slack behavior?
2. Does `/notifications` now serve and render a durable timeline instead of the old Slack placeholder?
3. Do GitHub webhooks and authenticated trigger dispatch route through real handler paths with dedup-safe behavior?
4. Do cron automations and alert rules persist the right history and expose it over the operator API?
5. Are the checked-in docs and OpenAPI artifact aligned with the shipped API surface?
6. Do repo quality gates and browser verification pass on the final tree?

## Verification routes

- Focused backend regression fixes:
  - `pnpm exec vitest run tests/http/trigger-handler.test.ts tests/http/github-webhook-handler.test.ts`
  - `pnpm exec vitest run tests/http/server.test.ts tests/http/openapi-sync.test.ts tests/frontend/settings-sections.test.ts`
- Repo gates:
  - `pnpm run build`
  - `pnpm run lint`
  - `pnpm run format:check`
  - `pnpm run typecheck`
  - `pnpm run typecheck:frontend`
  - `pnpm test`
- Browser verification:
  - `pnpm exec playwright test --project=smoke`
  - `pnpm exec playwright test tests/e2e/specs/smoke/notifications.smoke.spec.ts --project=smoke`
  - `pnpm exec playwright test --project=visual`
  - Manual `visual-verify` pass at the default viewport against `http://127.0.0.1:4000/notifications` and `http://127.0.0.1:4000/settings`, captured in `.anvil/notifications-bundle/verification/manual-visual-verify.md`

## Notes

- Playwright verification initially failed because the local Chromium bundle was missing. Installing it with `pnpm exec playwright install chromium` restored the smoke and visual suites.
- The notifications smoke tests uncovered a real mock-routing gap: `tests/e2e/mocks/api-mock.ts` was not intercepting `/api/v1/notifications?limit=...` queries. The mock now matches the query-bearing route, and the smoke locator was tightened to the unread stat card to avoid strict-mode ambiguity.
- The repo-level Playwright visual project still runs at its checked-in `2560x1440` viewport, but the final manual `visual-verify` closeout was rerun at the default viewport after the user explicitly requested the default resolution.
