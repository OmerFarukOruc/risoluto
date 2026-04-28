# Product

## Register

product

## Users

Risoluto is for **a single self-hosting developer-operator** — a technical solo who runs Docker, manages PATs and API keys, owns a Linear (or GitHub) project, and wants AI coding to run unattended on their own machine or VDS. The role is "operator," not "user" or "team member."

Their context when using Risoluto:

- They file issues during the day and want PRs in the morning.
- They scan status quickly, stepping into details only when something needs intervention.
- They run several terminal and browser surfaces in parallel.
- They host Risoluto themselves; there is no cloud version.

Their primary job-to-be-done is **eliminating supervision of individual prompts** — making the AI-coding loop run unattended for an eight-hour window without babysitting.

## Product Purpose

Risoluto is a local orchestration engine that watches an issue tracker (Linear, or GitHub Issues), claims actionable issues, spins up sandboxed Codex agents inside disposable Docker containers, and pushes the resulting code as GitHub PRs — all unattended.

**One sentence:** Risoluto turns an issue queue into mergeable PRs while the operator sleeps.

**North star:** *Personal autonomous coder, overnight-solo, dogfood-driven.*

**Success state:** the operator files N issues in bulk, goes to sleep, and wakes up to PRs ready for morning review. Every architecture decision is filtered through one question — *does this make the overnight-solo run more likely to succeed?*

## Brand Personality

**Precise. Calm. Assertive.** The product reads as engineering-first instrumentation, not marketing copy.

The tone is:

- declarative and clipped — "No cloud service. No SaaS. Your code stays on your machine."
- security-honest — operator docs flag posture and risk in plain language, not reassurance.
- exclusionary on identity — VISION.md states "not" and "never" without hedging.
- technically credible, operationally calm, intentionally designed.

It should never read as marketing-aspirational, playful, fluffy, trend-driven, or reassuring-by-omission.

## Anti-references

**Strategic non-goals (verbatim "not" list, source: VISION.md):**

- Not a multi-tenant SaaS.
- Not a cloud service or hosted control plane.
- Not a generic agent framework — "this is not 'LangChain but better.'"
- Not a web IDE, Monaco pane, or VS Code replacement — the operator uses their real IDE.
- Not a team product — pricing, billing, and org models are off-limits until the dogfood bar is met.

**Surface anti-patterns:**

- Bubbly SaaS dashboards with hero metrics and decorative cards.
- Purple gradients, playful illustrations, over-decorated empty states.
- Onboarding flows that try to win over a non-technical audience.
- Glassmorphism, gradient text, side-stripe colored borders, identical card grids.

## Design Principles

1. **Overnight-solo first.** Every surface decision is filtered through *does this make the unattended overnight run more likely to succeed?* If a design helps the operator at 9am but doesn't help the queue at 3am, it loses.
2. **Show state, don't sell it.** The dashboard is an instrument panel — claim, attempt, success/blocked, PR — not a marketing vitrine. Trust is earned by accuracy, not animation.
3. **Operator-grade honesty.** Surfaces declare posture (sandbox mode, approval policy, trust boundary) rather than soften it. When something is risky, the UI says so plainly; when something is unverified, it doesn't pretend to be live.
4. **Earn the bar before the polish.** Dashboard moves and visual flourish are deferred until the unattended run actually works. Releases are judged against VISION.md's quality + reliability pillars before aesthetic goals.
5. **Self-hosted, single-operator default.** Multi-tenant, team, and SaaS shapes are not first-class; if a feature only makes sense for "us, the org," it doesn't belong in the product yet.

## Accessibility & Inclusion

- Target: **WCAG 2.1 AA**, with deliberate bias toward operator-grade durability over visual flourish.
- Keyboard access is baseline — every primary action reachable without a pointer.
- Durable contrast for both default-dark and light themes; status colors carry redundant signal (icon + label + tint), never color alone.
- `prefers-reduced-motion` is respected throughout. Motion restraint is the default; live state is communicated by structure and copy first, motion second.
- Designed for cramped developer workspaces (multi-monitor, narrow side panels), not single-page consumer flows.
