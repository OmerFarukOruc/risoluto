#!/bin/bash
# bash-guardrails.sh — Block dangerous Bash commands before execution.
# Runs as PreToolUse hook with "Bash" matcher.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Block force push to main/master
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*--force.*\b(main|master)\b|git\s+push\s+--force\b'; then
  echo "Blocked: force push to main/master is not allowed. Use a PR workflow instead." >&2
  exit 2
fi

# Block git reset --hard on main
if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard' && git rev-parse --abbrev-ref HEAD 2>/dev/null | grep -qE '^(main|master)$'; then
  echo "Blocked: git reset --hard on main branch. Create a branch first." >&2
  exit 2
fi

# Block rm -rf on critical paths
if echo "$COMMAND" | grep -qE 'rm\s+-rf\s+(/|\./?$|\./?(src|tests|\.claude|frontend|dist|\.git)(/|$))'; then
  echo "Blocked: rm -rf on critical project directory. Be more specific about what to delete." >&2
  exit 2
fi

# Block destructive SQL without WHERE
if echo "$COMMAND" | grep -iqE '(DROP\s+TABLE|DELETE\s+FROM)\s+\w+\s*;?\s*$'; then
  echo "Blocked: destructive SQL without WHERE clause. Add a WHERE condition or confirm intent." >&2
  exit 2
fi

exit 0
