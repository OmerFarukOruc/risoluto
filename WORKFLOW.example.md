---
# Tracker credentials come from the environment on purpose so dry-start can fail cleanly when they are absent.
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY

# The polling loop never overlaps; the next pass is scheduled only after the current pass completes.
polling:
  interval_ms: 30000

# Use a temp-root workspace for local proving runs so cleanup stays low-risk.
workspace:
  root: $TMPDIR/symphony_workspaces

# Every hook runs with the issue workspace as cwd.
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

# Max concurrency, turn budgeting, retry ceiling, synchronous read timeout, and stall timeout all live here.
agent:
  max_concurrent_agents: 10
  max_turns: 20
  max_retry_backoff_ms: 120000

# Recommended: isolate the daemon's Codex runtime from your personal Codex home.
# A simple bootstrap is:
#   cp -R tests/fixtures/codex-home-custom-provider "$HOME/.symphony-codex"
codex:
  command: "/home/oruc/Desktop/codex/bin/codex-app-server-live"
  # Default worker model; the dashboard/API can override this per issue at runtime.
  model: "gpt-5.4"
  reasoning_effort: "high"
  approval_policy: "never"
  thread_sandbox: "danger-full-access"
  turn_sandbox_policy:
    type: "dangerFullAccess"
  read_timeout_ms: 5000
  turn_timeout_ms: 120000
  stall_timeout_ms: 300000

# The HTTP dashboard and JSON API bind locally by default.
server:
  port: 4000
---
You are working on Linear issue {{ issue.identifier }}.

Respect the repository state you find in the workspace, explain what you are doing in short operator-friendly updates, and stop once the issue is either complete or blocked.
