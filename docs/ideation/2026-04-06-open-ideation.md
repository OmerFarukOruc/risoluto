---
date: 2026-04-06
topic: open-ideation
focus: open-ended (no specific focus)
---

# Ideation: Risoluto Open-Ended Improvement Ideas

## Codebase Context

Risoluto is a TypeScript (ESM, Node 22+) orchestration platform that dispatches AI agents (currently Codex) to work on issues from trackers (Linear, GitHub). v0.6.0 with 238/239 spec requirements met (one gap: SSH per-host concurrency limits, §8.3). Port/adapter architecture with 25+ modules, Express HTTP server, SQLite persistence, Vite/React dashboard, 292 test files including 38 Playwright E2E specs.

**Recent progress:** Notifications/chat/triggers bundle, PR/CI automation, checkpoint history, 15-unit architecture refactor (core types split, new ports for secrets/templates/audit, AttemptStorePort decomposition, domain-split HTTP routes).

**Active work:** Anvil v2 (meta-tooling), v1.0 roadmap (21 requirements across 4 phases: hardening, agent-agnostic runner + plugin arch, PR/CI pipeline, distribution/DX). 71 open features across 11 bundles.

**Key leverage points:** DI wiring centralized in `services.ts`, TypedEventBus with 5+ consumers, port/adapter pattern enables swappable backends, workflow loader partially exists, audit event data already persisted but unqueried.

## Ranked Ideas

### 1. Adaptive Orchestrator Health

**Description:** A unified resilience layer for the orchestrator's core loop addressing three interacting gaps: (a) monotonic-clock stall detection replacing wall-time `Date.now()` with `performance.now()` — currently, a laptop suspend or VM hibernation causes `silentMs` to jump, triggering false-positive stalls that kill all running agents simultaneously; (b) exponential backoff with jitter on the concurrency-cap retry re-queue path, which currently uses a flat 1s delay; (c) a circuit breaker wrapping tracker API calls during startup recovery, which currently blocks indefinitely with no timeout if the tracker is down.

**Rationale:** These three gaps interact — a tracker outage during boot hangs the service, a laptop suspend kills all agents, and a rate-limit wave at concurrency saturation creates a synchronized retry burst. Fixing them as a coherent health layer is cheaper and more robust than three independent patches. All three are Phase 1 hardening scope.

**Downsides:** Requires touching three modules (`stall-detector.ts`, `retry-manager.ts`, `recovery.ts`). Heartbeat protocol may need agent-runner changes to emit keepalive events. Circuit breaker state machine adds complexity to the recovery path.

**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored

**Key files:** `src/orchestrator/stall-detector.ts` (wall-time `silentMs` calculation), `src/orchestrator/retry-manager.ts` (flat 1s re-queue in `revalidateAndLaunchRetry`), `src/orchestrator/recovery.ts` (unbounded `tracker.fetchIssueStatesByIds()` at startup)

---

### 2. Repo-Level Agent Behavior Bundles

**Description:** Allow repositories to ship `.risoluto/workflow.yaml` files that declare per-repo agent behavior: model preference, prompt template selection, artifact type, retry policy, and label-based routing. The orchestrator reads these at dispatch time, layered on top of the operator config. Combined with prompt template selection, this turns Risoluto from a single-config orchestrator into a platform where teams own their agent behavior without operator intervention — closer to how GitHub Actions `.github/workflows/` works.

**Rationale:** Currently all repos share one operator config. The workflow loader infrastructure already partially exists (recent commits refactored front-matter parsing). Per-repo config is the v1.0 customization story that isn't stated anywhere on the roadmap yet — it's the bridge between "tool a single operator runs" and "platform teams adopt." Enables GitOps workflows and removes UI-only config dependency.

**Downsides:** Config merge-order semantics get more complex (YAML base → overlay → repo-level). Security surface expands — repos can request expensive models or override safety constraints. Needs guardrails and cost caps. Schema design for the workflow file is a product decision.

**Confidence:** 75%
**Complexity:** Medium-High
**Status:** Unexplored

**Key files:** `src/config/store.ts` (operator-level YAML), `src/config/overlay.ts` (runtime overrides), `src/prompt/resolver.ts` (template resolution), recent workflow loader commits (`7e0d159`)

---

### 3. Automation Implement Idempotency Guard

**Description:** The `AutomationRunner.runImplement` path has a data integrity race condition: a crash between `createRun()` and `finishRun()` leaves an orphaned `running` record in `automation_runs` with no recovery path. On next trigger, the idempotency guard is gone, and a duplicate tracker issue is created — which then gets dispatched as a real work item, creating a ghost-issue amplification loop. Each crash at the wrong moment creates an orphaned tracker issue that costs agent compute to process.

**Rationale:** This is a correctness bug, not a feature gap. The fix is surgical: add a unique constraint on `(automation_name, trigger_id, started_at)` in the `automation_runs` schema, and scan for orphaned `running` records at startup to either finalize or discard them. The `node-cron` `noOverlap: true` flag prevents double-execution within a single process lifetime, but does not survive restarts.

**Downsides:** Requires a SQLite schema migration. The edge case may be rare in practice (requires crash at exactly the right moment between `createRun` and `finishRun`). However, automated cron triggers increase the statistical likelihood over time.

**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

**Key files:** `src/automation/runner.ts` (lines 118-146: `createRun` → `createIssue` → `finishRun`), `src/persistence/sqlite/database.ts` (`automation_runs` table schema)

---

### 4. SQLite Busy-Timeout as Hidden Concurrency Ceiling

**Description:** `better-sqlite3` is a synchronous binding — every write blocks the Node.js event loop. With `busy_timeout = 5000ms` and WAL mode, at 20+ concurrent agents each writing events, checkpoints, and token usage on every turn, write contention serializes the event loop for hundreds of milliseconds per tick. The 5s busy timeout means write failures surface only after blocking the orchestrator's entire main thread for 5 seconds. The symptom will present as "orchestrator slowness" or "tick latency," not "database contention," making it hard to diagnose.

**Rationale:** This is an invisible ceiling on real agent concurrency. As Risoluto scales toward v1.0 concurrency targets, SQLite write contention will be the first bottleneck — and it will be misdiagnosed. The `queuePersistence` path fires on every agent event, chaining `appendEvent` + `updateAttempt` + `appendCheckpoint` sequentially per turn event.

**Downsides:** Fix options range from simple (write batching/queuing to reduce lock contention) to complex (async SQLite wrapper, connection pooling, or Postgres migration). Profiling under real load is needed to confirm the actual threshold where this becomes material. May be a non-issue below 15 agents.

**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

**Key files:** `src/persistence/sqlite/database.ts` (lines 497-499: `pragma busy_timeout = 5000`, `synchronous = NORMAL`, WAL mode), `src/orchestrator/worker-launcher.ts` (lines 394-414: `queuePersistence` sequential writes per event)

---

### 5. Worktree Auto-Commit Silent Failure

**Description:** When `WorkspaceManager.removeWorkspace()` detects uncommitted changes during cleanup, it attempts a silent auto-commit via `enforcePreCleanupCommit`. If the commit fails (pre-commit hook rejection, missing git identity, locked file), the `autoCommitError` is logged at `warn` level — but no event is emitted to the event bus, no notification is sent, and the worktree is removed anyway. Agent-produced work (partial fixes, generated files, research artifacts) is silently discarded with no recovery path once the worktree is gone.

**Rationale:** Silent data loss is the worst failure mode for an orchestrator that manages autonomous agent work. The fix is small: emit a `workspace:commitFailed` event on failure, surface it in the dashboard via SSE, and optionally send a notification via the channel adapter. The event bus and notification infrastructure already exist — the gap is just the emission.

**Downsides:** Blocking removal pending operator confirmation could accumulate orphaned worktrees (connects to disk exhaustion concern). Needs a timeout or expiry policy for the confirmation window.

**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

**Key files:** `src/workspace/manager.ts` (`removeWorkspace` → `enforcePreCleanupCommit`, `WorkspaceRemovalResult` with `autoCommitError: string | null`)

---

### 6. Secrets Key Rotation

**Description:** `SecretsStore.deriveKey()` uses `createHash("sha256").update(masterKey)` — a plain SHA-256 hash with no KDF, no salt, and no key-ID in the encryption envelope. The envelope stores only `version: 1`, `algorithm`, `iv`, `authTag`, and `ciphertext` — no discriminator for which key encrypted a given secret. There is no rotation mechanism: changing the master key invalidates all existing secrets with no migration path. Forced rotation is a manual, error-prone all-or-nothing operation with no rollback story.

**Rationale:** For production deployments where secrets include tracker API keys and webhook signing tokens, a compromised or policy-rotated master key means re-encrypting everything manually. The fix is well-scoped: switch to PBKDF2 key derivation with a random salt, add a `keyId` field to the encryption envelope, and provide a `risoluto secrets rotate` CLI command that re-encrypts all secrets under the new key while keeping the old key readable during the transition.

**Downsides:** Requires backward-compatible envelope parsing (old `version: 1` envelopes must remain readable). Schema migration for the secrets store. If the current deployment doesn't handle sensitive production secrets, this is lower priority.

**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

**Key files:** `src/secrets/store.ts` (lines 10-22: `deriveKey` with raw SHA-256, envelope schema), `src/secrets/port.ts` (`SecretsPort` interface)

---

### 7. Startup Diagnostic Suite

**Description:** Combine three observability gaps into a single `risoluto doctor` / `--diagnose` capability: (a) config diff showing the effective resolved config across YAML/overlay/env layers — currently no startup log shows which values were overridden by which source; (b) tracker connectivity check with a timeout, fixing the recovery-blocks-startup bug where `recovery.ts` calls `tracker.fetchIssueStatesByIds()` with no timeout; (c) workspace root permissions and disk space validation. Every boot produces a one-screen diagnostic summary; a `--diagnose` flag runs the full suite without starting the orchestrator.

**Rationale:** Operators currently debug config mismatches by mentally tracing the merge path across 5 config files (`builders.ts`, `merge.ts`, `coercion.ts`, `resolvers.ts`, `overlay-helpers.ts`), discover tracker outages only when the service hangs at boot, and learn about disk issues only when workspace creation fails. A single diagnostic surface replaces 5 separate debugging steps. Roadmap issue #367 exists for `risoluto doctor` — this idea adds scope (config diff, recovery timeout) beyond what was originally envisioned.

**Downsides:** Adds startup latency if run unconditionally. The `--diagnose` flag approach keeps it opt-in, but the config diff and tracker timeout should run on every boot regardless. Scope creep risk — the diagnostic suite could grow unbounded.

**Confidence:** 85%
**Complexity:** Low-Medium
**Status:** Unexplored

**Key files:** `src/cli/index.ts` (startup sequence), `src/config/` (5 files in the merge pipeline), `src/orchestrator/recovery.ts` (unbounded tracker call), `src/workspace/manager.ts` (no disk checks)

---

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Cascading Retry Storm | Exponential backoff already exists for error retries; flat 1s only in concurrency-cap re-queue path, by design |
| 2 | Config Hot-Reload Race | JS reference assignment is atomic in V8; no real mid-tick divergence scenario |
| 3 | Circular Dependency Chains | Real but niche — trackers don't typically produce deep transitive blocker chains |
| 4 | Workspace Lifecycle Lock | try/finally structure makes leaked locks unlikely in practice |
| 5 | Config Three-Layer Diff | Absorbed into Startup Diagnostic Suite (#7) |
| 6 | Toolchain Health Contract | Outside project boundary — Risoluto can't mandate health checks on external toolchains |
| 7 | Operator Abort Suppression Ephemeral | Real but contained — small SQLite table fix, not a design insight |
| 8 | Self-Review Classification Fragile | Narrow feature scope; fix when self-review matures |
| 9 | Notification Preference Center | Nice-to-have UX polish with no operator demand signal |
| 10 | Cost-Aware Retry | Underdefined — no concrete failure mode driving it yet |
| 11 | Resume-from-Checkpoint | Already explicitly deferred in codebase — a reminder, not an insight |
| 12 | Disk Exhaustion / Worktree Accumulation | Real ops risk but straightforward df check + eviction, not a design idea |
| 13 | Stall Detection Heartbeat | Subsumed by Adaptive Orchestrator Health (#1) |
| 14 | Agent-Agnostic Runner Registry | Already R6 in v1.0 roadmap — a reminder, not an insight |
| 15 | Fanout/Sub-Task Decomposition | Already #366 on roadmap; research-project scope |
| 16 | Event-Sourced Attempt Store | Massive rewrite, no current pain signal |
| 17 | Invert Dispatch Loop | Webhook inbox already exists; pure-push loses recovery guarantees |
| 18 | Config-as-Code | Absorbed into Repo-Level Agent Behavior Bundles (#2) |
| 19 | Federated Orchestration | Post-v1.0 scaling concern, premature |
| 20 | Headless Mode / API-First Config | Already headless-capable via existing HTTP API |
| 21 | Port Multiplexer | Over-engineering with no current use case |
| 22 | Structured Artifacts | No concrete artifact type defined — still a vision |
| 23 | Kill Pre-Push Hook | Deliberate design choice, not a bug |
| 24 | Codegen-First API Endpoints | No codegen toolchain exists; premature investment |
| 25 | Tracker Adapter Scaffolder | Useful but no second tracker imminent |
| 26 | Auto-Generated Fixture Factory | Build cost exceeds benefit of hand-maintained factories |
| 27 | Unified Config Contract | Overlaps with Startup Diagnostic Suite; partially in motion already |
| 28 | Living Docs from Code Annotations | Tooling cost exceeds doc maintenance savings |
| 29 | Plans as Structured Data | No consumer exists yet for queryable plans |
| 30 | AuditLog Analytics Surface | Incremental polish, not a design lever |
| 31 | Typed Event Replay | No event store infrastructure; the bus is in-memory only |
| 32 | ScenarioBuilder Generalization | Test infra with zero strategic leverage |
| 33 | Config Overlay as Feature Flags | Would break overlay's type safety contract |
| 34 | Prompt Template Versioning / A/B | Template system still being adopted — too early |
| 35 | Institutional Knowledge Search | Solved by existing qmd tool |
| 36 | LLM Provider Registry | Premature without agent-agnostic runner |
| 37 | Webhook-Driven PR Events | Real gap but already on existing roadmap |
| 38 | Dependency Graph Visualization | Phase 4 polish; fix blocker detection first |
| 39 | SSH Per-Host Concurrency Limiter | Known spec gap, niche impact at current scale |
| 40 | Workspace Resource Pool | Setup complexity outweighs latency benefit |
| 41 | Data-Driven Dispatch Intelligence | Dependencies make this Phase 3+ work |
| 42 | Runner-Artifact Matrix | Depends on rejected runner registry |

## Session Log

- 2026-04-06: Initial open-ended ideation — 48 raw ideas generated across 6 frames (operator pain, unmet needs, inversion/automation, assumption-breaking, leverage/compounding, edge cases/power users), 5 cross-cutting combinations synthesized, 2 adversarial critique agents applied (pragmatist + strategist). 7 survivors from 49 candidates.
