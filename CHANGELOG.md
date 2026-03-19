# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-03-16

### Added

- Local orchestration for Linear issue polling and dispatch on a single host.
- Docker sandbox execution with a `node:22` container, resource limits, security hardening, and OOM detection.
- Per-issue workspace isolation with lifecycle hooks and cleanup.
- Codex integration through managed `codex app-server` JSON-RPC worker processes.
- Spec-conformance hardening for tracker configuration, dispatch ordering, blocker filtering, concurrency policy, retry revalidation, and startup cleanup.
- Configurable retry and stall handling with backoff, turn timeouts, stall timeouts, and read timeouts.
- Operator-controlled model overrides that persist per issue and apply on the next run.
- Archived attempts with durable summaries and event timelines under `.symphony/`.
- A local dashboard and JSON API under `/` and `/api/v1/*` for runtime visibility and control.
- Prometheus-compatible metrics at `GET /metrics`.
- Optional git automation for repo routing, clone/bootstrap, commit/push, and pull request creation when runs finish successfully.
- A repo-root `./symphony-logs` helper for archive-first issue and attempt inspection.
- Slack lifecycle notifications with configurable verbosity.
- Persistent config overlay support plus an encrypted local secrets API.
- Planning endpoints under `/api/v1/plan*`.
- A minimal Tauri desktop shell for starting and stopping the orchestrator and embedding the dashboard.
- Strict TypeScript implementation with deterministic Vitest coverage.
- Visual verification support using `agent-browser` and Brave for dashboard QA and screenshot diffing.

[Unreleased]: https://github.com/OmerFarukOruc/symphony-orchestrator/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/OmerFarukOruc/symphony-orchestrator/releases/tag/v0.2.0
