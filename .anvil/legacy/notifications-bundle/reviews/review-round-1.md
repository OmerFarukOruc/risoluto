---
plan: "feat: Notifications bundle"
round: 1
mode: review
model: codex-main-session
date: 2026-04-04
verdict: CONDITIONAL GO
confidence: 84%
overall_score: 7.6/10
---

# Hostile Review Round 1

## Findings

1. **High -- realtime notification truth is not executable from the current unit definition.** `R5` requires persisted notification changes to reach the dashboard without manual reload, but the current frontend SSE bridge only triggers `pollOnce()` for `issue.started`, `issue.completed`, `issue.stalled`, and `issue.queued` in `frontend/src/state/event-source.ts`. Unit 2 currently changes `frontend/src/views/notifications-view.ts` but does not own `frontend/src/state/event-source.ts`, `frontend/src/state/polling.ts`, or an explicit `notification.*` event contract in `src/core/risoluto-events.ts`, so the plan overclaims live timeline behavior.

2. **High -- generic outbound webhook egress lacks a repo-truthful trust policy.** The plan adds a generic outbound webhook notification channel, but the existing URL guardrail in `src/config/url-policy.ts` only normalizes tracker endpoints, GitHub API hosts, and Slack webhook hosts. Unit 1 does not currently include `src/config/url-policy.ts` or `tests/config/url-policy.test.ts`, which leaves the plan silent on whether arbitrary operator-configured destinations are allowed, denied, or separately allowlisted.

3. **High -- automation execution is still described as if the current worker stack were tracker-agnostic.** `src/agent-runner/index.ts` requires both an `Issue` and a prepared `Workspace`, and `src/orchestrator/workspace-preparation.ts` plus `src/orchestrator/worker-launcher.ts` are built around issue identity, repo routing, and issue lifecycle persistence. The plan needs an explicit execution contract for `implement`, `report`, and `findings` modes instead of assuming tracker-free scheduled work can drop into the existing issue-centric launcher unchanged.

4. **Medium -- trigger action scope must stay honest to today's tracker substrate.** The plan's example config includes `create_issue`, but `src/tracker/port.ts` still has no `createIssue()` path, `src/tracker/github-adapter.ts` delegates to a GitHub client that only fetches, labels, closes or reopens, and comments, and the Linear create mutation exists only as `buildCreateIssueMutation()` in `src/linear/queries.ts`. The plan does recognize this gap, but the execution units need to make the adapter and client expansion explicit before downstream trigger or automation work depends on it.

## Settlements Applied

- **S1.** Unit 2 now owns explicit `notification.*` event typing, SSE contract updates, and frontend refetch wiring in `frontend/src/state/event-source.ts` and `frontend/src/views/notifications-view.ts` so `/notifications` can update without a manual reload.
- **S2.** Unit 1 now owns a dedicated outbound webhook URL policy in `src/config/url-policy.ts` plus config tests, with HTTPS-only and env-backed host allowlisting documented as part of the trust boundary.
- **S3.** Unit 4 now defines an explicit automation execution model: `report` and `findings` are tracker-free automation runs with required repo binding and durable run history; `implement` may enter the existing issue-centric worker path only after a real tracker issue has been resolved or created.
- **S4.** Unit 3 now makes tracker write expansion first-class for `create_issue`, including `TrackerPort`, both tracker adapters, and the backing client work instead of implying the action already exists.

## Verdict

The bundle grouping still makes sense and the repo seams are strong enough to support it, but only after the four settlements above are folded into the ExecPlan. With those changes in place, the plan is honest enough to continue to hostile audit rather than reopening planning again.
