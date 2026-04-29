// WHY divergent from src/core/types/runtime.ts: the backend domain model uses camelCase
// field names and is serialized to snake_case by serializeSnapshot() in
// src/http/route-helpers.ts before being sent over the wire. These frontend types
// reflect the wire format (snake_case). The frontend and backend are separate build
// targets (NodeNext vs Bundler module resolution) and cannot share imports directly.
export interface RuntimeIssueView {
  issueId: string;
  identifier: string;
  title: string;
  state: string;
  workspaceKey: string | null;
  workspacePath: string | null;
  message: string | null;
  status: string;
  updatedAt: string;
  attempt: number | null;
  error: string | null;
  priority: string | number | null;
  labels: string[];
  startedAt: string | null;
  lastEventAt: string | null;
  nextRetryDueAt?: string | null;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
  model: string | null;
  reasoningEffort: string | null;
  modelSource: string | null;
  configuredModel: string | null;
  configuredReasoningEffort: string | null;
  configuredModelSource: string | null;
  modelChangePending: boolean;
  configuredTemplateId?: string | null;
  configuredTemplateName?: string | null;
  url?: string | null;
  description?: string | null;
  blockedBy?: { id: string | null; identifier: string | null; state: string | null }[];
  branchName?: string | null;
  pullRequestUrl?: string | null;
  createdAt?: string | null;
}

export interface WorkflowColumn {
  key: string;
  label: string;
  kind: "backlog" | "todo" | "active" | "gate" | "terminal" | "other";
  terminal: boolean;
  count: number;
  issues: RuntimeIssueView[];
}

export interface RateLimits {
  [key: string]: unknown;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "critical";
  checked_at: string;
  running_count: number;
  message: string;
}

export interface WebhookHealth {
  status: "connected" | "degraded" | "disconnected";
  effective_interval_ms: number;
  stats: {
    deliveries_received: number;
    last_delivery_at: string | null;
    last_event_type: string | null;
  };
  last_delivery_at: string | null;
  last_event_type: string | null;
}

export interface StallEventView {
  at: string;
  issue_id: string;
  issue_identifier: string;
  silent_ms: number;
  timeout_ms: number;
}

export interface RecentEvent {
  at: string;
  issue_id: string;
  issue_identifier: string;
  session_id: string | null;
  event: string;
  message: string;
  content: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RuntimeSnapshot {
  generated_at: string;
  counts: { running: number; retrying: number };
  queued: RuntimeIssueView[];
  running: RuntimeIssueView[];
  retrying: RuntimeIssueView[];
  completed: RuntimeIssueView[];
  workflow_columns: WorkflowColumn[];
  codex_totals: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    seconds_running: number;
    cost_usd: number | null;
  };
  rate_limits: RateLimits | null;
  recent_events: RecentEvent[];
  stall_events?: StallEventView[];
  system_health?: SystemHealth;
  webhook_health?: WebhookHealth;
  cost_samples?: CostSample[];
  health_checks?: HealthChecks;
}

// ── Per-subsystem health probes ────────────────────────────────────────

export type HealthCheckStatus = "ok" | "slow" | "degraded" | "down" | "unknown";

export type HealthFailureKind =
  | "ok"
  | "auth_failure"
  | "rate_limited"
  | "remote_error"
  | "unreachable"
  | "config_drift"
  | "resource"
  | "image_missing";

export interface HealthSubprobe {
  name: string;
  status: HealthCheckStatus;
  failure_kind: HealthFailureKind;
  latency_ms: number;
  detail: string;
}

export interface HealthProbeResult {
  status: HealthCheckStatus;
  failure_kind: HealthFailureKind;
  checked_at: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  latency_ms: number;
  detail: string;
  subprobes: HealthSubprobe[];
  window_ok: number;
  window_failed: number;
}

export interface HealthChecks {
  github: HealthProbeResult;
  linear: HealthProbeResult;
  docker: HealthProbeResult;
}

/**
 * One point in the orchestrator cost / headroom time-series. The dashboard
 * sparkline reads the most recent ~64 entries; older rows are pruned by the
 * backend on a 7-day rolling window.
 */
export interface CostSample {
  at_ms: number;
  cost_usd: number | null;
  input_tokens: number;
  output_tokens: number;
  seconds_running: number;
  headroom_pct: number | null;
}
