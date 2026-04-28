#!/bin/bash
# wiki-signal.sh — refresh the project's wiki-derived signal at session start.
#
# Runs project_signal.py against the my-vault-v2 wiki to regenerate
# .cache/wiki-signal.md with concepts/entities/syntheses/sources affiliated
# with this project (slug: risoluto). The repo's CLAUDE.md points Claude
# at the file so wiki signal is in context from turn 1.
#
# Affiliation lives in the wiki side (~/Documents/my-vault-v2/wiki/meta/projects.yaml).
# Edit there → next /wiki-ingest re-affiliates → next session start picks it up.
#
# Failures are silenced: a missing vault, missing python, or missing yaml
# should never block a Risoluto session.

set -o pipefail

# When invoked outside Claude Code, $CLAUDE_PROJECT_DIR may be unset — fall
# back to the script's containing repo root so a manual run still works.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

VAULT="$HOME/Documents/my-vault-v2"
SIGNAL_SCRIPT="$VAULT/scripts/project_signal.py"
OUT_DIR="$PROJECT_DIR/.cache"
OUT_FILE="$OUT_DIR/wiki-signal.md"
SLUG="risoluto"

# Vault or script missing → silently no-op (never block a session).
[[ -f "$SIGNAL_SCRIPT" ]] || exit 0

mkdir -p "$OUT_DIR" 2>/dev/null || exit 0

python3 "$SIGNAL_SCRIPT" "$SLUG" --out "$OUT_FILE" >/dev/null 2>&1 || true
exit 0
