#!/usr/bin/env bash
# Workspace setup for Risoluto.
# Installs pnpm deps and seeds a local .env from the root repo (or .env.example).
set -euo pipefail

cd "$SUPERSET_WORKSPACE_PATH"

# Risoluto requires Node 22+ and pnpm 10. Surface a clear error if missing.
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[risoluto] pnpm not found on PATH. Install pnpm@10 (corepack enable && corepack prepare pnpm@10.33.0 --activate) and re-run." >&2
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$node_major" -lt 22 ]; then
  echo "[risoluto] Node $node_major detected; Risoluto needs Node >=22." >&2
  exit 1
fi

# Seed .env: prefer the root repo's .env if present, else fall back to .env.example.
if [ ! -f .env ]; then
  if [ -f "$SUPERSET_ROOT_PATH/.env" ]; then
    cp "$SUPERSET_ROOT_PATH/.env" .env
    echo "[risoluto] seeded .env from root workspace"
  elif [ -f .env.example ]; then
    cp .env.example .env
    echo "[risoluto] seeded .env from .env.example (fill in secrets before running)"
  fi
fi

# frozen-lockfile keeps the worktree faithful to pnpm-lock.yaml.
pnpm install --frozen-lockfile
