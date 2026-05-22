# NOTES

## Chronological Notes

- 2026-05-22T15:33:15+03:00 Created the `/goal` scaffold for an autonomous architecture-improvement loop. This did not implement an architecture slice.
- 2026-05-22T15:33:15+03:00 Existing dirty files before scaffolding were `.codex/config.toml`, `.codex/hooks.json`, and `.codex/hooks/`; preserve them as unrelated user/pre-existing changes.
- 2026-05-22T15:33:15+03:00 Existing `docs/ARCHITECTURE_DEEPENING_EXECPLAN.md` contains prior architecture deepening history. Treat it as context only. Every iteration must re-read current repo state before choosing a candidate.
- 2026-05-22T15:33:15+03:00 Goal-forge config check reported Codex CLI likely supports `/goal`, the project is trusted, model is `gpt-5.5`, reasoning settings are high/xhigh, and `[features].goals` is true. It also reported autonomous gaps: `model_context_window`, `model_auto_compact_token_limit`, `approval_policy`, and `sandbox_mode` are unset in the inspected config.
- 2026-05-22T15:34:49+03:00 Full scaffold validation passed with `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`. Lint emitted existing warning-only inventory; Vitest reported 3771 passing tests and 1 skipped test.

## Durable Architecture Rubric

- A module is deeper when callers get more leverage through a smaller or clearer interface.
- A module has better locality when behavior, tests, bugs, and future changes concentrate in one implementation instead of repeating across callers.
- A seam is suspect when it has only one adapter and no proven testability or runtime need.
- The deletion test is mandatory: if deleting a module makes complexity vanish instead of reappearing across callers, the module was probably shallow.
- Candidate ranking must distinguish `Strong`, `Worth exploring`, and `Speculative`.

## Skipped or Blocked Candidates

- None yet. Populate this section when a candidate requires missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, unavoidable behavior changes, or unresolved validation failures.
