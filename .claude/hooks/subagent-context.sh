#!/bin/bash
# subagent-context.sh — Inject project context into spawned subagents.
# Runs as SubagentStart hook.

cat <<'CONTEXT'
## Risoluto Project Brief

Risoluto is a self-hosted AI agent orchestrator that polls Linear for issues and
dispatches Codex workers in isolated git worktree workspaces.

### Key Conventions
- ESM TypeScript with .js import extensions
- Port/adapter pattern for all external dependencies
- 2-space indent, double quotes, semicolons, const by default
- PascalCase classes, camelCase functions/variables
- mc-* prefix for frontend component classes
- Vitest for unit tests, Playwright for E2E
- Pre-commit: ESLint + Prettier via lint-staged
- Pre-push: build + test + typecheck gate
CONTEXT
