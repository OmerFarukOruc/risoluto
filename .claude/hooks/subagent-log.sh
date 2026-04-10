#!/bin/bash
# subagent-log.sh — Log subagent completion for visibility.
# Runs as SubagentStop hook.

INPUT=$(cat)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // "unknown"')
TIMESTAMP=$(date -Iseconds)

echo "${TIMESTAMP} agent_stop type=${AGENT_TYPE}" >> "${CLAUDE_PROJECT_DIR:-.}/.claude/agent-activity.log" 2>/dev/null

exit 0
