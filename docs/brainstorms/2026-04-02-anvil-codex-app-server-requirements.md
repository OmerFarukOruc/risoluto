---
date: 2026-04-02
topic: anvil-codex-app-server
---

# Anvil Codex App-Server Client

## Problem Frame

The Anvil skill's Phase 3 review loop (and related Codex phases) shells out to `codex exec` for each round. This is a fire-and-forget model with no mid-execution visibility — when Codex stalls (as observed during the CI/CD pipeline brainstorm on 2026-04-02), there's no way to detect it, interrupt it, or recover without killing the process. Each round also starts fresh with no shared context, forcing the Anvil skill to manually pass review state through files.

Meanwhile, Risoluto's core codebase (`src/codex/`, `src/agent-runner/`, `src/agent/`) already has a production-grade `codex app-server` integration with JSON-RPC, stall detection, turn interruption, thread resume/rollback, and dynamic tools. The Anvil skill should have its own standalone client that reuses these **patterns** (not shared code) to get the same reliability guarantees.

**Who this affects:** Omer (sole operator) running Anvil pipelines from Claude Code. The client is a Claude Code skill utility, not a Risoluto module.

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│  Anvil SKILL.md (Claude Code orchestrator)       │
│                                                  │
│  tsx scripts/codex-client.ts --action <action>   │
│       │                                          │
│       ▼                                          │
│  ┌────────────────────────────────────────────┐  │
│  │  codex-client.ts                           │  │
│  │                                            │  │
│  │  1. Spawn `codex app-server` (stdio)       │  │
│  │  2. initialize → initialized handshake     │  │
│  │  3. thread/start (or thread/resume)        │  │
│  │                                            │  │
│  │  Per action:                               │  │
│  │    turn/start → stream item/* events       │  │
│  │    → stall detection (no events for Ns)    │  │
│  │    → turn/interrupt on timeout             │  │
│  │    → turn/completed → extract output       │  │
│  │                                            │  │
│  │  4. Write output to .anvil/<slug>/         │  │
│  │  5. Exit with structured status            │  │
│  └────────────────────────────────────────────┘  │
│       │                                          │
│       ▼                                          │
│  codex app-server (child process, stdio JSONL)   │
│       │                                          │
│       ▼                                          │
│  cliproxyapi @ 127.0.0.1:8317 (local proxy)     │
└──────────────────────────────────────────────────┘
```

## Requirements

**Core Protocol**

- R1. Spawn `codex app-server` as a child process over stdio transport (JSONL). Inherit auth and provider config from `~/.codex/config.toml` (cliproxyapi provider, no auth logic in client).
- R2. Implement the full initialization handshake: `initialize` with `clientInfo: { name: "anvil", version: "1.0.0" }` and `capabilities: { experimentalApi: true }`, followed by `initialized` notification.
- R3. Implement bidirectional JSON-RPC 2.0 connection: send requests (with `id`), receive responses (match by `id`), receive notifications (no `id`), and handle server-initiated requests (approvals, tool calls).
- R4. Auto-accept all approval requests (`commandExecution`, `fileChange`, `permissions`) with `acceptForSession` — matching Risoluto's pattern in `codex-request-handler.ts`.

**Thread and Turn Management**

- R5. Support `thread/start` to create a new thread, and `thread/resume` to continue an existing thread across rounds. Persist the thread ID to `.anvil/<slug>/thread-id` so the Anvil skill can resume across Claude Code sessions.
- R6. Support `turn/start` with configurable input (text prompt), and stream `item/*` notifications until `turn/completed`.
- R7. Extract the agent's final message text from `item/completed` notifications where `item.type === "agentMessage"`. Write to the specified output file.
- R8. Support `turn/steer` to inject follow-up context into an active turn (used for stall reframing).

**Stall Detection and Recovery**

- R9. Track `lastEventAtMs` during a turn. If no `item/*` or `turn/*` notification arrives within the configurable stall timeout (default: 180 seconds), emit a warning and attempt `turn/interrupt`.
- R10. After `turn/interrupt`, wait up to 5 seconds for `turn/completed` with `status: "interrupted"`. If the turn doesn't complete, kill the child process and exit with a stall error code.
- R11. On stall or error, write a structured error JSON to stdout so the Anvil SKILL.md can detect the failure and decide whether to retry, reframe, or escalate.

**Rate Limit Awareness**

- R12. Call `account/rateLimits/read` after initialization. If usage exceeds 80%, log a warning. If usage exceeds 95%, exit with a rate-limit error code before starting the turn (so Anvil can wait and retry).

**CLI Interface**

- R13. Single entry point: `tsx scripts/codex-client.ts` with the following flags:
  - `--action <review|audit|finalize>` — which Anvil phase this turn serves
  - `--plan-dir <path>` — path to `.anvil/<slug>/` directory
  - `--prompt <text>` or `--prompt-file <path>` — the turn's input text
  - `--output <path>` — where to write the agent's final message
  - `--resume` — attempt `thread/resume` using persisted thread ID before falling back to `thread/start`
  - `--model <model>` — model override (default: from config.toml)
  - `--stall-timeout <ms>` — override default stall timeout
  - `--cwd <path>` — working directory for the Codex agent (default: current directory)
- R14. Exit codes: `0` = success, `1` = general error, `2` = stall detected, `3` = rate limit exceeded, `4` = auth failure.
- R15. Structured JSON output to stdout: `{ "status": "ok"|"error"|"stall"|"rate_limited", "threadId": "...", "turnId": "...", "outputFile": "...", "error?": "..." }`.

**Lifecycle**

- R16. The `codex app-server` process must be cleaned up on: normal exit, stall abort, SIGINT/SIGTERM of the parent script, and unhandled exceptions.
- R17. Total process timeout: configurable (default: 600 seconds). If the entire script exceeds this, kill the app-server and exit with stall code.

## Success Criteria

- Phase 3 review rounds use the app-server client instead of `codex exec`, with shared thread context across rounds within a single pipeline run.
- Stall detection fires within `stallTimeoutMs` of last event and cleanly interrupts/kills the process — no more indefinite hangs.
- Rate limit pre-check prevents wasted rounds that would fail mid-execution.
- Anvil SKILL.md changes are minimal — replace the `codex exec` bash command with a `tsx scripts/codex-client.ts` command using appropriate flags.

## Scope Boundaries

- **Not reusable by other skills** — this is purpose-built for Anvil. Other skills that need app-server access can copy/adapt.
- **No Docker** — this runs locally on Omer's machine, not in a sandbox container. Risoluto's Docker session layer is not reused.
- **No dynamic tools** — Anvil's Codex reviews don't need Linear GraphQL or GitHub API tool calls. Auto-accept approvals, skip tool routing.
- **No auth management** — inherits from `~/.codex/config.toml` and `~/.codex/auth.json`. No login flows, no token refresh.
- **No WebSocket transport** — stdio only.
- **No model listing** — the model is passed via `--model` flag or defaults to config.toml.
- **No npm/package.json** — standalone `.ts` files run with `tsx`. Dependencies limited to Node.js built-ins.

## Key Decisions

- **Standalone over shared**: Anvil's client lives in `~/.claude/skills/anvil/scripts/`, not in Risoluto's `src/`. Reuses Risoluto's architectural patterns (JSON-RPC connection class, notification-driven stall detection, auto-accept approvals) but shares no code. This keeps the skill self-contained and independently versioned.
- **TypeScript with tsx**: Matches the patterns being reused. JSON-RPC types provide compile-time safety. `tsx` is already installed on the machine.
- **Spawn per-pipeline**: Each Anvil run spawns its own `codex app-server`. Clean lifecycle — process dies when the script exits. No shared state between pipelines.
- **Inherit local auth**: The `cliproxyapi` provider at `127.0.0.1:8317` is already configured in `~/.codex/config.toml`. No auth logic needed.
- **Single CLI entry point**: `codex-client.ts` handles all actions via `--action` flag. The SKILL.md invokes it with different flags per phase. Simpler than maintaining multiple scripts.

## Dependencies / Assumptions

- `codex` CLI installed and on PATH (already verified by `scripts/check-deps.sh`)
- `tsx` installed globally or via npx (already used in Risoluto dev workflow)
- `~/.codex/config.toml` has a working provider configured (cliproxyapi or default openai)
- Node.js 22+ (same as Risoluto)

## Outstanding Questions

### Deferred to Planning

- [Affects R5][Technical] Should thread persistence use a simple text file (`thread-id`) or a JSON state file that also tracks round count, last model used, and cumulative token usage?
- [Affects R6][Needs research] What `sandboxPolicy` should the client request on `thread/start`? Risoluto uses `workspaceWrite` with explicit `writableRoots`. For local Anvil runs, `danger-full-access` may be acceptable since there's no sandbox container.
- [Affects R7][Technical] How should the client extract the final message from the notification stream? Risoluto's `notification-handler.ts` accumulates `item/agentMessage/delta` events. Should the client do the same, or just read the final `item/completed` with `type: "agentMessage"`?
- [Affects R13][Technical] Should the prompt text be passed inline via `--prompt` flag, or always via `--prompt-file` to avoid shell escaping issues with complex review prompts?

## Next Steps

→ `/ce:plan` for structured implementation planning
