# Notifications Bundle

## Problem Frame

Risoluto already has three pieces of the Notifications story in place, but they do not yet add up to a coherent operator workflow:

- Slack-only outbound notifications already exist through `NotificationManager` and `SlackWebhookChannel`.
- Linear webhook ingestion already exists through the signed `/webhooks/linear` path, durable webhook inbox persistence, and webhook health tracking.
- The dashboard already has a `/notifications` route, but it is still a configuration/status placeholder rather than a real timeline of operator-visible events.

The bundle should leave Risoluto with one coherent event-to-operator pipeline: external or internal events enter through polling, webhooks, or cron; the runtime normalizes and deduplicates them; alert/automation logic evaluates them; notification channels fan out from one adapter layer; and operators can inspect durable in-product history instead of relying only on Slack or tracker side effects.

## Requirements

- **R1.** Notification delivery must be formalized around a multi-channel registry/factory that extends the existing `NotificationChannel` and `NotificationManager` seam instead of replacing it with a separate dispatch stack.
- **R2.** The bundle must preserve existing Slack webhook behavior while adding at minimum two new channel types in this run: a generic outbound webhook channel and a desktop notification channel. The design must remain extensible for future channels such as Telegram or email, but those are not required in this bundle.
- **R3.** The notification payload model must expand from the current freeform event/message shape into a typed notification record that can carry title, message, type, severity, source, deep link, metadata, read state, and dedupe identity.
- **R4.** Typed notification records must persist in SQLite and be queryable through API endpoints for list, unread count, mark-as-read, and mark-all-as-read behavior.
- **R5.** Notification changes that matter to the dashboard must also flow through the existing real-time operator surface, so new persisted notifications are available to the UI without requiring a manual page reload.
- **R6.** The `/notifications` page must stop being a Slack-configuration placeholder and become a real operator timeline for persisted notifications and recent delivery state.
- **R7.** Existing `/webhooks/linear` support must remain intact, including signature verification, durable inbox persistence, and dedup-friendly handling of repeated deliveries.
- **R8.** The bundle must add a shared webhook-ingress layer that supports three ingress modes: Linear push events, GitHub push events, and authenticated generic trigger requests under `/api/v1/webhooks/trigger`.
- **R9.** Generic trigger requests must use explicit API-key authentication and action allowlists. Source webhooks from Linear and GitHub must use source-appropriate signature verification rather than sharing a weaker auth path.
- **R10.** Webhook and poll-based issue discovery must normalize into one internal work/notification model so the same issue is not double-dispatched just because it was seen through two transport paths.
- **R11.** The scheduler foundation must support cron-backed entries for non-interactive actions such as webhook fire, orchestrator refresh/re-poll, and automation dispatch. Invalid cron expressions must be rejected or skipped with explicit operator-visible errors instead of destabilizing startup.
- **R12.** Automation workflows must run on top of the same scheduling foundation and support three modes: `implement`, `report`, and `findings`.
- **R13.** Automation runs must persist enough history for operators to inspect what ran, when it ran, whether it succeeded, and any structured findings or report output it produced.
- **R14.** A rule-based alert engine must subscribe to the event bus and evaluate runtime events against configurable rules with severity, channel routing, and cooldown/dedup behavior rather than relying on hard-coded alert branches.
- **R15.** Channel routing must allow per-rule or per-channel severity filtering so critical events can fan out broadly while noisy informational events stay scoped.
- **R16.** Desktop notifications must be optional, fire-and-forget, and best-effort across supported platforms. Missing local tooling may emit warnings, but it must never block orchestration or notification persistence.
- **R17.** All new configuration surfaces for notifications, triggers, alerting, and automations must plug into the existing config-store / overlay path. This bundle must not introduce parallel `CRONS.json` / `TRIGGERS.json` files or reintroduce `WORKFLOW.md` as a live runtime dependency.
- **R18.** Operator-facing surfaces must stay truthful: if the Settings UI does not become a full editor for every new notification config section in this bundle, the dashboard and docs must clearly reflect how those settings are actually managed.
- **R19.** Documentation must cover the new config shape, webhook auth expectations, scheduler behavior, automation modes, alert routing, persistent notification APIs, and the operator workflow for the notification timeline.
- **R20.** Verification must include browser/UI proof for the notification timeline and lifecycle/E2E proof for webhook ingress, dedup, scheduling, and persisted notification behavior before the bundle can ship.

## Success Criteria

- Operators can keep existing Slack notifications working while enabling at least generic webhook and desktop delivery through the same channel abstraction.
- Signed webhook deliveries from Linear and GitHub plus authenticated generic trigger requests can all enter the system without bypassing validation or causing duplicate work dispatch.
- Cron entries can fire supported actions, and automation runs persist outcome history for `implement`, `report`, and `findings` modes.
- Alert rules can fire multi-channel notifications with severity routing and cooldown suppression.
- `/notifications` shows a real persisted timeline with read-state behavior instead of only a “Slack configured” placeholder.
- Existing Slack-only configs and the current `/webhooks/linear` path continue working after the bundle lands.
- The operator docs and test suite prove the new behavior end to end.

## Scope Boundaries

- No Telegram, email, PagerDuty, or other extra delivery channels beyond the required Slack, generic webhook, and desktop support in this bundle
- No full dashboard redesign unrelated to notifications, alerting, or automation visibility
- No replacement of tracker polling with webhook-only orchestration; polling remains a supported path
- No PR/CI lifecycle engine expansion beyond the narrow GitHub webhook behavior needed for push-based issue ingestion and notification truthfulness
- No unrelated observability or provider-routing work from other roadmap bundles

## Key Decisions

- **One bundle, phased foundation-first execution.** The bundle stays grouped, but implementation should build the reusable foundations first: channel registry, typed notification model, ingress normalization, scheduler, then higher-level alerting and automation behavior.
- **Reuse existing webhook foundations.** The current Linear webhook handler, durable inbox, and health tracker are the starting point; this run extends them instead of creating a parallel receiver stack.
- **Narrow first-class channel set.** Slack remains the backward-compatible default. Generic outbound webhook and desktop notifications are the additional required channels for this run; other channels remain extension points.
- **Truthful operator surface beats maximal settings UI.** The notification timeline and APIs are required. A full settings editor for every new config knob is not required if docs and existing UI stay explicit about how the config is managed.
- **GitHub webhook scope stays narrow.** This bundle should only cover the GitHub webhook behavior needed to support push-based ingestion and notification truthfulness. Broader PR/CI webhook orchestration belongs to adjacent roadmap bundles.

## Dependencies / Assumptions

- SQLite remains the persistence layer for webhook inbox state, typed notifications, and automation history.
- The existing event bus remains the source of truth for alert-engine subscriptions.
- Visual verification and UI testing will be required once the `/notifications` operator surface changes.
- Lifecycle/E2E verification remains required because this bundle touches external Linear/GitHub wiring, queue/orchestrator ingress, and scheduled execution.
- The current overlay/config-store system remains the canonical runtime config path.

## Outstanding Questions

### Resolve Before Planning

_(none — the product and operator framing is concrete enough to plan)_

### Deferred To Planning

- Decide the exact config shape for multi-channel notifications, alert rules, cron entries, and automation workflows within the current raw-config structure.
- Decide whether automation history and notification history live in new SQLite tables or partially reuse existing persistence abstractions.
- Decide the exact normalized internal event model shared across polling, webhooks, scheduler actions, and alert routing.
- Decide how much of the Settings UI should expand in this run versus remaining docs/API-managed configuration.
- Decide whether the notification timeline should include delivery-attempt details directly or link out to separate webhook/automation status views.
