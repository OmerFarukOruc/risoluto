# Git Workflow

## Branch Naming

Prefix branches by type: `feature/`, `fix/`, `chore/`, `refactor/`.

## Commit Messages

Conventional commit format enforced by commitlint: `type(scope): description`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

Scopes: `agent`, `alerts`, `audit`, `automation`, `ci`, `cli`, `codex`, `config`, `core`, `dashboard`, `deps`, `dispatch`, `docker`, `e2e`, `frontend`, `git`, `github`, `http`, `linear`, `notification`, `observability`, `orchestrator`, `persistence`, `prompt`, `release`, `secrets`, `setup`, `state`, `tracker`, `utils`, `webhook`, `workflow`, `workspace`

Scopeless commits are allowed for cross-cutting changes.

## Merge Strategy

- **Batch PRs** (multi-commit bundles): squash merge to keep main clean
- **Single-purpose PRs**: regular merge or rebase
- Atomic commits — one logical change per commit

## Pre-push Gate

The pre-push hook runs build + test + typecheck (~60s). Do not bypass unless truly blocked (`SKIP_HOOKS=1`).
