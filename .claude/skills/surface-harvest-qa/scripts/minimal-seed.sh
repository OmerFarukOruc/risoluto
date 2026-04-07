#!/usr/bin/env bash
set -euo pipefail

# minimal-seed.sh — Lightweight API-only seeding when .env.seed is unavailable
#
# Usage: minimal-seed.sh [port]
# Seeds: templates, triggers refresh. Does NOT require API keys.

PORT="${1:-4000}"
BASE="http://localhost:${PORT}/api/v1"

# Verify app is running
if ! curl -sf "${BASE}/state" > /dev/null 2>&1; then
  echo "Error: Risoluto not reachable at ${BASE}" >&2
  exit 1
fi

# Check setup
CONFIGURED=$(curl -sf "${BASE}/setup/status" | python3 -c "import json,sys; print(json.load(sys.stdin).get('configured', False))" 2>/dev/null || echo "False")
if [[ "$CONFIGURED" != "True" ]]; then
  echo "BLOCKED: Setup wizard incomplete. Run seed-test-data.sh with API keys first." >&2
  exit 1
fi

# Templates — ensure at least 2
TEMPLATE_COUNT=$(curl -sf "${BASE}/templates" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get('templates',[])))" 2>/dev/null || echo 0)
if [ "$TEMPLATE_COUNT" -lt 2 ]; then
  curl -sf -X POST "${BASE}/templates" -H "Content-Type: application/json" \
    -d '{"id":"shqa-review","name":"Review Prompt","body":"Review {{ issue.identifier }}: {{ issue.title }}.\nPriority: {{ issue.priority | default: \"normal\" }}"}' \
    > /dev/null 2>&1 && echo "Seeded template: shqa-review" || echo "Template seed failed (may already exist)"
fi

# Trigger orchestrator refresh
curl -sf -X POST "${BASE}/refresh" > /dev/null 2>&1 && echo "Orchestrator refresh triggered" || true

echo "Minimal seed complete"
