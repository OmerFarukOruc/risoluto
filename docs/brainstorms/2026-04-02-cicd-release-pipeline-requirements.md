---
date: 2026-04-02
topic: cicd-release-pipeline
---

# CI/CD & Release Pipeline Architecture

## Problem Frame

Risoluto has a mature CI pipeline (build, lint, test, typecheck, security scans, Playwright smoke, Docker build/push) but lacks three critical capabilities:

1. **No release automation** — versioning is manual (`0.6.0` in package.json), no changelog generation, no semver tags. Docker images get `sha` + `latest` tags only.
2. **Integration tests are main-only** — PR authors don't know if integration tests pass until after merge.
3. **No nightly pipeline** — heavy tests (fullstack E2E, visual regression, full mutation scan, live provider smoke) have no recurring execution cadence.

Additionally, the project has a finalized but unexecuted testing expansion plan (`.anvil/testing-expansion/plan.md`, 14 units, 8/10 GO) that must be implemented as part of this work.

## Requirements

**Testing Infrastructure (from finalized testing expansion plan)**

- R1. Implement the 14-unit testing expansion plan per `.anvil/testing-expansion/plan.md` (already finalized with 19 review settlements). This includes: OpenAPI sync tests, schema tightening, HTTP server harness, SQLite integration tests, AJV contract tests, SSE contract tests, orchestrator recovery tests, fullstack Playwright E2E, live provider smoke, visual baseline expansion, and mutation ratchet to 90%.
- R2. Add `integration-pr` job to `ci.yml` — runs `pnpm run test:integration` on every PR. Include in the `build-and-test` gate alongside existing jobs (`build, lint, test, knip, typecheck, gitleaks, semgrep, docker-build, e2e-smoke`).
- R3. Add `mutation-incremental` job to `ci.yml` as advisory (`continue-on-error: true`). Graduate to required once 90% threshold is stable across 2+ weeks.

**Nightly Pipeline**

- R4. Change schedule trigger from weekly (`0 6 * * 1`) to nightly (`0 2 * * *` — 02:00 UTC / ~05:00 TR).
- R5. Add nightly-only jobs: `fullstack-e2e`, `visual-regression`, `live-provider-smoke`. All gated with `if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'`. All non-blocking (`continue-on-error: true` where external APIs are involved).
- R6. Upload failure artifacts (test results, visual diffs, traces) with 14-day retention on all nightly jobs.
- R7. Add Slack notification via GitHub Actions Slack webhook for nightly failures. Requires `SLACK_WEBHOOK_URL` secret.

**Commit Enforcement**

- R8. Install `@commitlint/cli` + `@commitlint/config-conventional` as devDependencies.
- R9. Create `commitlint.config.ts` with scope-enum: `orchestrator`, `http`, `cli`, `core`, `workspace`, `linear`, `git`, `docker`, `config`, `persistence`, `dashboard`, `setup`, `secrets`, `agent`, `ci`, `frontend`, `e2e`, `deps` (18 scopes).
- R10. Add `.husky/commit-msg` hook: `pnpm exec commitlint --edit "$1"`. This is a hard prerequisite for semantic-release.

**Release Pipeline (CD)**

- R11. Install `semantic-release` + `@semantic-release/changelog` + `@semantic-release/git` as devDependencies.
- R12. Create `.releaserc.yml` with `npmPublish: false` (package is `private: true`). Configure `@semantic-release/git` message template to include `[skip ci]` to prevent re-triggering CI on the version bump commit.
- R13. Add `release` job to `ci.yml`: runs on main push after `build-and-test` gate. Uses `RELEASE_TOKEN` (PAT with admin bypass permissions, not the default `GITHUB_TOKEN`). Outputs `new_release_published` and `new_release_version`.
- R14. Update existing `docker-push` job: add `release` to `needs` list (sequential, not parallel). Checkout the release tag (`v${{ needs.release.outputs.new_release_version }}`) instead of `${{ github.sha }}` so the Docker image contains the version-bumped `package.json`. Add semver tag to `docker/metadata-action`.
- R15. Add `deploy-vds` job: SSH to VDS, pull new image, `docker compose up -d`, health check `http://localhost:4000/api/v1/runtime`, automated rollback on failure. Pin `appleboy/ssh-action` to SHA.

**Flaky Test Quarantine**

- R16. Create `quarantine.json` tracked in repo — array of `{ testName, file, quarantinedAt, passCount }` entries.
- R17. Create Vitest setup file that reads `quarantine.json` and skips quarantined tests in CI (but still runs them in nightly with `QUARANTINE_ENFORCE=false`).
- R18. Nightly job updates `passCount` — auto-remove after 5 consecutive passes.
- R19. Hard cap: 5 quarantined tests maximum. Weekly audit creates Linear issues for entries older than 7 days.

**CI Consistency & Cleanup**

- R20. All new CI jobs must use the existing `.github/actions/restore-build` composite action instead of manually setting up pnpm/node/cache. Reduces duplication and ensures consistency.
- R21. Remove SonarCloud references from documentation — no sonarcloud job exists in `ci.yml`.
- R22. Preserve the existing `paths-ignore` asymmetry: push to main skips CI for doc-only changes; PRs always get full CI regardless of changed files.
- R23. Preserve existing `knip` and `dependency-review` jobs unchanged.

## Success Criteria

- Every commit to main with a `feat(*)` or `fix(*)` prefix triggers: semver tag, GitHub Release, CHANGELOG update, Docker push with semver tag, VDS deploy with health check.
- PRs run integration tests and get a required `build-and-test` gate that includes `integration-pr`.
- Nightly pipeline runs fullstack E2E, visual regression, live provider smoke, and full mutation scan. Failures send Slack notifications.
- Bad commit messages are rejected locally by the `commit-msg` hook before they reach CI.
- Flaky tests are quarantined automatically, never blocking PRs, with a self-healing mechanism that auto-removes after stability.

## Scope Boundaries

- **In scope**: All CI/CD infrastructure, testing expansion implementation, release automation, VDS deploy, quarantine system.
- **Out of scope**: SonarCloud integration (dropped), self-hosted runners (future consideration), `nightly.yml` extraction (defer unless file exceeds ~800 lines).
- **Not in scope**: Branch protection rule setup (Omer will configure manually). This plan designs for PAT with bypass permissions from the start.

## Key Decisions

- **Phase ordering**: Original ordering preserved. Testing foundation first, then release pipeline.
- **Unified execution**: Testing expansion (finalized plan) and CI/CD architecture merged into one anvil pipeline.
- **Docker image versioning**: Checkout release tag, not trigger SHA. Ensures Docker image matches the released version.
- **CI loop prevention**: `[skip ci]` in semantic-release commit messages prevents redundant CI runs.
- **Slack notifications**: GitHub Actions Slack webhook (new secret: `SLACK_WEBHOOK_URL`). Not using the codebase notification manager.
- **Commitlint scopes**: 18 scopes (15 from plan + `frontend`, `e2e`, `deps`).

## Dependencies / Assumptions

- `RELEASE_TOKEN` must be a PAT with `contents:write` + `packages:write` and admin bypass for branch protection when rules are enabled.
- VDS deploy requires `VDS_HOST`, `VDS_USER`, `VDS_SSH_KEY` secrets to be configured before Phase 3.
- VDS `docker-compose.yml` must support env var override for image reference (rollback mechanism). If it doesn't, the deploy script needs adaptation.
- Testing expansion plan at `.anvil/testing-expansion/plan.md` is the authoritative source for test infrastructure requirements. Its 19 review settlements are pre-approved.

## Outstanding Questions

### Deferred to Planning

- [Affects R15][Needs research] Does the VDS `docker-compose.yml` support `RISOLUTO_IMAGE` env var for rollback? If not, what rollback mechanism should we use?
- [Affects R17][Technical] Vitest `test.skip()` inside `beforeEach` may not work. Research the correct quarantine skip mechanism (possibly `test.skipIf()` or custom test wrapper).
- [Affects R14][Technical] When `docker-push` checks out the release tag, does the composite action `restore-build` still work (cache key is SHA-based, but the tag checkout has a different SHA)?
