# 🗺️ Roadmap

> Symphony Orchestrator feature roadmap — all items tracked as GitHub issues.
> Research sources: Composio, OpenSwarm, mog, thepopebot, **jinyang**.

<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.3.0--pre-blue?style=flat-square" />
  <img alt="Spec Conformance" src="https://img.shields.io/badge/spec-238%2F239-brightgreen?style=flat-square" />
</p>

> [!NOTE]
> For spec conformance details and shipped capabilities, see [CONFORMANCE_AUDIT.md](CONFORMANCE_AUDIT.md).

**Tracking epic:** [#9 — Symphony v2 Feature Roadmap](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/9)

---

## Tier 1 — Ship First

High-value, achievable now. These directly address the most requested features and competitive gaps.

| # | Feature | Area | Source |
|---|---------|------|--------|
| [#10](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/10) | Reactions system — CI/review/approval → auto agent actions | core | Composio, v2 roadmap |
| [#11](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/11) | GitHub Issues adapter | core | Twitter, Composio |
| [#12](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/12) | Mobile-responsive dashboard | dashboard | Twitter feedback |
| [#13](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/13) | `symphony init --auto` one-command setup — setup-wizard-level thoroughness: prerequisite checks, repo creation, secret config, `.env` generation; add `symphony validate` post-setup step *(jinyang)* | core | Composio, thepopebot, jinyang |
| [#14](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/14) | Dollar cost tracking per issue / per model | dashboard, api | Twitter (@DatisAgent) |
| [#15](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/15) | Live agent feed / subagent drill-down view | dashboard, api | Twitter (@VladimirNovick) |
| [#59](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/59) | Auto-squash + conventional commit formatting — with configurable path validation | core | v2 roadmap, thepopebot |

---

## Tier 2 — High Impact, Medium Effort

Significant improvements to developer experience, extensibility, and autonomous operation.

| # | Feature | Area | Source |
|---|---------|------|--------|
| [#16](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/16) | Notification routing by severity | core | Composio |
| [#17](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/17) | Per-project agent rules — with personality/identity layer (SOUL.md concept) and per-phase prompt templates | core | Composio, thepopebot |
| [#18](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/18) | POST /api/v1/:issue/send — mid-session injection | api, dashboard | Composio (`ao send`) |
| [#19](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/19) | Git worktrees as workspace strategy — auto-sync to `origin/<baseBranch>` before execution, enforce-commit before done, preserve on failure *(jinyang)* | core | Composio, jinyang |
| [#20](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/20) | Plugin / swappable architecture — skills/SKILL.md standard with progressive discovery | core | Composio, Twitter, thepopebot |
| [#21](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/21) | `symphony status` CLI / TUI compact view | api | Twitter (@VladimirNovick) |
| [#22](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/22) | Multi-agent role pipeline — agent clusters with shared workspaces, per-role concurrency, template variables | core | Composio, OpenSwarm, thepopebot |
| [#23](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/23) | Agent-agnostic runner — dual LLM config (chat vs agent), per-job model overrides, multi-provider support; priority-based provider routing with automatic fallback *(jinyang)* | core | Composio, Twitter, thepopebot, jinyang |
| [#24](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/24) | Settings UI page | dashboard | Internal |
| [#25](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/25) | Acceptance criteria validation before PR | core | v2 roadmap, Composio |
| [#26](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/26) | Prompt analytics | dashboard, api | Composio |
| [#35](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/35) | Review comment ingestion | sentinel, core | v2 Phase 1 |
| [#36](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/36) | Re-dispatch on REQUEST_CHANGES | sentinel, core | v2 Phase 1 |
| [#37](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/37) | Auto-merge integration PR — with path-restriction controls (`ALLOWED_PATHS`) | sentinel, core | v2 Phase 1, thepopebot |
| [#38](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/38) | Merge conflict re-dispatch | sentinel, core | v2 Phase 1 |
| [#39](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/39) | Pre-merge verification (test/lint before done) | core | v2 Phase 2 |
| [#51](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/51) | Dashboard polish — workflow summaries, credential UI | dashboard | Follow-up |
| [#54](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/54) | Default-on hardening — request tracing, error tracking; webhook rate limiting, payload validation, request ID propagation, webhook loop detection *(jinyang)* | core | Follow-up, jinyang |
| [#56](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/56) | Docker/container sandbox — consider self-hosted runner pattern | core | Follow-up, thepopebot |
| [#57](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/57) | Agent progress monitoring (stall detection + iteration limits); session dedup (in-memory + file locks), mutex status locking *(jinyang)* | core | Follow-up, jinyang |
| [#58](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/58) | Secret/config injection — dual-tier secret model with env-sanitizer | core | Follow-up, thepopebot |
| [#66](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/66) | Chat integration layer — pluggable channel adapters (Telegram, Discord, Slack) with normalized message format | core, api | thepopebot |
| [#67](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/67) | Scheduled/cron job system — JSON-configured recurring tasks with per-cron model overrides | core | thepopebot |
| [#68](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/68) | Headless agent execution — lightweight runs without branch/PR workflow | core | thepopebot |

---

## Tier 3 — Architectural, Longer Horizon

Infrastructure work, scale-out, and deeper observability.

| # | Feature | Area | Source |
|---|---------|------|--------|
| [#27](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/27) | Session persistence — JSONL-based session logs for replay/resume | core | Composio, thepopebot |
| [#28](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/28) | Orchestrator meta-agent — AI supervisor | core | Composio |
| [#29](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/29) | CI check-run polling + auto-retry | core | v2 roadmap |
| [#30](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/30) | Vector memory for agents | core | Composio, OpenSwarm |
| [#31](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/31) | Drift detection | core | v2 roadmap |
| [#32](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/32) | Webhook-driven dispatch — job creation API, `x-api-key` auth, status polling; HMAC verification, `/webhooks/test` bypass, 202-accept-then-async pattern *(jinyang)* | core, api | Internal, thepopebot, jinyang |
| [#33](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/33) | Multi-host SSH worker distribution | core | v2 roadmap (§8.3) |
| [#34](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/34) | Jira adapter | core | v2 roadmap |
| [#40](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/40) | Rollback triggers — auto-revert on failure | core | v2 Phase 2 |
| [#41](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/41) | Structured event pipeline — centralized event bus | observability, core | v2 Phase 3 |
| [#42](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/42) | Alerting rules — cost, failure, stall thresholds | observability, core | v2 Phase 3 |
| [#43](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/43) | Trend analysis — historical metrics, regression detection | observability, dashboard | v2 Phase 3 |
| [#44](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/44) | Durable dispatch state — persist retry queue; file-based session locks + in-memory Set combo *(jinyang)* | core | v2 Phase 4, jinyang |
| [#45](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/45) | Host health monitoring + auto-failover; per-provider health cache with TTL, consecutive-error tolerance *(jinyang)* | core | v2 Phase 4, jinyang |
| [#46](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/46) | Tracker write APIs — orchestrator-driven transitions | core | v2 Phase 5 |
| [#52](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/52) | Richer reporting — Prometheus, OTLP, webhook presets | observability, api | Follow-up |
| [#53](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/53) | Desktop packaging — Tauri builds, release artifacts | desktop | Follow-up |
| [#69](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/69) | File-watch triggers — reactive agent dispatch on file changes with debounce | core | thepopebot |
| [#70](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/70) | Interactive agent workspaces — browser-based terminal access to agent environments | dashboard, core | thepopebot |

---

## Tier 4 — Long-Term Vision (Lights-Out)

Full autonomous codebase management — the end-state of the lights-out vision.

| # | Feature | Area | Source |
|---|---------|------|--------|
| [#47](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/47) | Self-healing pipelines — auto-diagnose CI failures | core | v2 Phase 6 |
| [#48](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/48) | Autonomous issue decomposition — agent delegation | core | v2 Phase 6 |
| [#49](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/49) | Continuous codebase improvement — proactive refactoring | core | v2 Phase 6 |
| [#50](https://github.com/OmerFarukOruc/symphony-orchestrator/issues/50) | Multi-repo orchestration — cross-repo changes | core | v2 Phase 6 |

---

## Dependency Graph

Key dependencies between features:

```mermaid
graph TD
    A["#20 Plugin Architecture"] --> B["#23 Agent-Agnostic Runner"]
    A --> C["#34 Jira Adapter"]
    A --> D["#46 Tracker Write APIs"]
    E["#10 Reactions System"] --> F["#29 CI Polling"]
    E --> G["#36 Re-dispatch on REQUEST_CHANGES"]
    H["#35 Review Comment Ingestion"] --> G
    F --> I["#37 Auto-merge PR"]
    J["#33 Multi-host SSH"] --> K["#45 Host Health Monitoring"]
    L["#14 Cost Tracking"] --> M["#42 Alerting Rules"]
    N["#41 Event Pipeline"] --> M
    N --> O["#15 Live Agent Feed"]
    P["#25 Acceptance Validation"] --> Q["#40 Rollback Triggers"]
    R["#39 Pre-merge Verification"] --> Q
    S["#28 Meta-agent"] --> T["#49 Continuous Improvement"]
    U["#30 Vector Memory"] --> T
    V["#48 Issue Decomposition"] --> W["#50 Multi-repo Orchestration"]
```

---

## Summary

| Tier | Issues | Status |
|------|:------:|--------|
| **Tier 1** — Ship first | 7 | Not started |
| **Tier 2** — High impact | 24 | Not started |
| **Tier 3** — Architectural | 19 | Not started |
| **Tier 4** — Lights-Out | 4 | Not started |
| **Total** | **54** | |

---

## 📝 How to Keep This Document Current

> [!NOTE]
> Update this file when issues are completed or new features are planned. Mark completed issues with ~~strikethrough~~ and update the summary table. For spec conformance tracking, see [CONFORMANCE_AUDIT.md](CONFORMANCE_AUDIT.md).
