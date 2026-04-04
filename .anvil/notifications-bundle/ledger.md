# Debate Ledger

## Settled

- **L1.** `R5` requires explicit `notification.*` SSE coverage plus frontend refetch wiring; lifecycle-only polling is not enough. Settled in round 1.
- **L2.** Generic outbound webhook channels must use a dedicated HTTPS plus host-allowlist policy in `src/config/url-policy.ts`, not Slack's special-case normalizer or arbitrary egress by default. Settled in round 1.
- **L3.** Automation modes need explicit execution identity: `report` and `findings` are tracker-free runs with repo binding, while `implement` must resolve or create a real tracker issue before entering the issue-centric worker path. Settled in round 1.
- **L4.** `create_issue` stays in scope only if Unit 3 expands `TrackerPort`, the GitHub and Linear adapters, and the backing clients explicitly. Settled in round 1.

## Contested

*(none)*

## Open

*(none)*

## Score History

- Round 1: 7.6/10, CONDITIONAL GO, settled 4, contested 0, open 0
