# CONTROL

## Status Contract

status_file: PLAN.md
attempt_log: ATTEMPTS.md
durable_notes: NOTES.md
update_memory_after: every_candidate_and_iteration
check_control_before: phase_change, strategic_pivot, expensive_step, sidecar_input

## Human Priorities

primary_priority: depth
secondary_priority: behavior_preservation
evidence_priority: current_repo_state

## Scope Knobs

allowed_project_root: /home/oruc/Desktop/workspace/risoluto

allowed_files:
- AGENTS.md
- README.md
- package.json
- src/**
- frontend/src/**
- tests/**
- docs/**
- docs-site/openapi.json
- PLAN.md
- ATTEMPTS.md
- NOTES.md
- CONTROL.md

protected_files:
- .env
- .env.*
- .risoluto/**
- dist/**
- node_modules/**
- pnpm-lock.yaml
- .codex/**

max_blast_radius: one architecture slice per iteration

## Resource Knobs

max_runtime_per_step: none
max_parallel_jobs: reasonable_local_parallelism
network_allowed: false_by_default
external_api_allowed: false_by_default

## Candidate Choice

choose_candidates_autonomously: true
ask_user_to_choose_candidates: false

skip_instead_of_asking_when_candidate_needs:
- missing_user_intent
- credentials
- security_authority
- dependency_approval
- schema_or_migration_authority
- public_interface_authority
- behavior_changing_decision
- destructive_change

## Decision Gates

require_approval_for:
- destructive_change
- dependency_change
- schema_or_migration_change
- public_interface_behavior_change
- security_or_trust_change
- external_api_use
- scope_expansion_outside_allowed_project_root

## Sidecar Inputs

sidecar_apply_cadence: before_phase_change
nudge_file: none
human_overlay_file: none
review_queue_file: none

## Latest Human Nudge

Create deeper modules one architecture slice at a time. Prefer evidence-backed locality and leverage over aesthetic refactoring. Do not ask Omer to choose candidates.
