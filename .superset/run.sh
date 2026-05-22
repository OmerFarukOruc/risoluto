#!/usr/bin/env bash
# Run Risoluto in dev: tsx-watched backend on :4000 + Vite frontend on :5173.
# Frontend proxies /api and /metrics to the backend (see frontend/vite.config.ts).
set -euo pipefail

cd "$SUPERSET_WORKSPACE_PATH"

backend_pid=""
frontend_pid=""

shutdown() {
  trap - INT TERM EXIT
  if [ -n "$backend_pid" ] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
  fi
  if [ -n "$frontend_pid" ] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill "$frontend_pid" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}
trap shutdown INT TERM EXIT

pnpm run dev -- --port 4000 &
backend_pid=$!

pnpm run dev:frontend &
frontend_pid=$!

echo "[risoluto] backend pid=$backend_pid (port 4000), frontend pid=$frontend_pid (port 5173)"
echo "[risoluto] open http://localhost:5173 — proxies /api to :4000"

# Exit as soon as either process dies so the run pane reflects failure.
wait -n "$backend_pid" "$frontend_pid"
exit_code=$?
shutdown
exit "$exit_code"
