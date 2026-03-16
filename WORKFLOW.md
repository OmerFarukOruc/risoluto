---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
polling:
  interval_ms: 30000
workspace:
  root: $TMPDIR/symphony_workspaces
hooks:
  timeout_ms: 60000
  after_create: |
    echo "workspace created for $SYMPHONY_ISSUE_IDENTIFIER"
  before_run: |
    echo "about to run in $PWD"
  after_run: |
    echo "attempt finished"
  before_remove: |
    echo "removing workspace $PWD"
agent:
  max_concurrent_agents: 10
  max_turns: 20
  max_retry_backoff_ms: 120000
codex:
  command: "/home/oruc/Desktop/codex/bin/codex-app-server-live"
  model: "gpt-5.4"
  reasoning_effort: "high"
  approval_policy: "never"
  thread_sandbox: "danger-full-access"
  turn_sandbox_policy:
    type: "dangerFullAccess"
  read_timeout_ms: 5000
  turn_timeout_ms: 120000
  stall_timeout_ms: 300000
server:
  port: 4000
---
You are working on Linear issue {{ issue.identifier }}: "{{ issue.title }}"
{% if issue.description %}

## Issue Description

{{ issue.description }}
{% endif %}

Respect the repository state you find in the workspace, explain what you are doing in short operator-friendly updates, and stop once the issue is either complete or blocked.
