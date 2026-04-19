# Legend — semantics and edge cases

Every alignment entry in a per-target file carries **exactly one** legend code. The choice is evidence-driven, not intuition-driven.

| Symbol | Code | Meaning | When to use |
|--------|------|---------|-------------|
| ⚖️ | `[=]` | **Parity** | Both projects implement the capability with comparable behavior, defaults, and guarantees. Naming differences are not sufficient to downgrade. |
| 🟢 | `[R+]` | **Risoluto stronger** | Both implement it, but Risoluto covers more cases, ships better defaults, exposes richer UX, or enforces stricter guarantees. |
| 🔴 | `[T+]` | **Target stronger** | Both implement it, but the target is better: deeper, faster, more ergonomic, or covers cases Risoluto doesn't. **Prime roadmap-study candidates.** |
| ⭐ | `[R!]` | **Risoluto-only** | The feature is on the Risoluto spine; the target does not have it. Differentiator. |
| ✨ | `[NEW]` | **Target-novel** | The target has a feature that is **not on the Risoluto spine at all**. Candidate roadmap addition unless explicitly out-of-scope. |
| ❓ | `[?]` | **Unclear** | Evidence is ambiguous, thin, contradictory, or behind a paywall/login. Flag for follow-up — never default to parity or gap silently. |

## The crucial distinction: `[R!]` vs `[NEW]`

- `[R!]` applies only to spine entries the target **lacks**. It is a **win to defend** — worth noting in positioning.
- `[NEW]` applies to target features **not on the spine at all**. It is a **gap to consider filling** — worth roadmap triage.

If a feature is on the spine AND on the target but with weaker-looking evidence, the correct code is usually `[?]`, not `[R!]`. `[R!]` requires confirmed target-absence, not merely "I didn't find it."

## Edge cases

### A spine entry whose target counterpart is structurally different

Example: Risoluto has "channel adapter pattern for multi-channel notifications" and the target has only Slack, but their Slack integration is more sophisticated than Risoluto's Slack channel. Code this as `[R+]` for the overall spine entry ("multi-channel notifications") because Risoluto covers more channels. But record the Slack-specific sophistication as a separate `[NEW]` entry in `## Target-novel features` with a note cross-linking to the `[R+]` spine entry.

### A feature that is partially implemented in the target

"Partially" is not a code. Pick the closer of `[R+]` or `[T+]` based on the dominant shape of the difference, then use the observable-behaviors list to enumerate exactly what's shipped vs missing.

### The target has a feature we ripped out of Risoluto intentionally

Still code as `[T+]`. Use the comparison field to explain the deliberate decision and flag it as `Suggested bundle: out-of-scope` in the roadmap section. Useful institutional memory.

### The target is a library, not an orchestrator

Some targets (e.g., Aider) are interactive CLIs, not orchestration services. Many Risoluto spine entries will be `[R!]` by design (no tracker integration, no dashboard). That's fine and expected — call it out in the target file's summary so the reader frames results correctly. Do not artificially downgrade Risoluto spine entries just because the target's category is different.

## Confidence mapping

Confidence is orthogonal to the legend code.

- **high** — direct, unambiguous evidence. Current README/docs explicitly describe the behavior, or code shows the exact mechanism.
- **medium** — evidence strongly implies the feature but leaves at least one observable behavior uncertain.
- **low** — evidence is marketing copy, a forum post, a closed issue, or a stale doc. Every `low`-confidence entry MUST appear in the target file's `## Needs follow-up` section with a concrete question for the reviewer.

A `[T+]` low-confidence entry is not a roadmap candidate — it's a research question. Clarify the confidence before pitching it for roadmap inclusion.

## Inferred vs code-verified

A claim is **code-verified** when you have read the actual implementation (not just docs, not just README) and can cite the specific behavior in source. A claim is **inferred** when you drew it from docs, README, release notes, or marketing copy without touching the source.

Both are acceptable inputs to the ledger, but they must be labeled differently:

- Code-verified claims: no special tag. Evidence block cites `<file>:<lines>`.
- Inferred claims: append `(inferred, not code-verified)` to the entry's `Description` line. Evidence block cites the doc URL or README section. Confidence drops one level (`high → medium`, `medium → low`) compared to a code-verified version of the same claim.

This distinction matters for roadmap planning. An `[T+]` claim that is inferred-only can be wrong in the details — the target's README may overstate reality. Before a roadmap-study candidate becomes an actual roadmap item, upgrade it to code-verified (or website-verified via the `/features` and `/docs` pages, not just the landing page).

## Hard rules for confidence and `[?]` — anti-over-confidence

The skill must NOT claim `confidence: high` on website-only evidence, and must NOT code most entries as `[=]`/`[R+]`/`[T+]`/`[R!]` when the evidence is thin. Apply these tests before shipping:

1. **Website-only evidence cap:** If your only sources are website pages (no repo clone, no source code read), confidence is **capped at medium** regardless of how thorough the docs seem. Marketing copy is not a proof.
2. **One-source cap:** If a claim traces to a single source (one doc page, one README section), confidence is **capped at medium**. High confidence requires corroboration across at least two independent sources.
3. **No-corroboration → `[?]`:** If a spine-alignment claim depends on absence-of-evidence ("the docs don't mention a webhook, so they don't have one"), the code is `[?]`, not `[R!]`, unless you ran the inversion test (≥3 distinct search attempts documented in `Searched for:`).
4. **Target-novel features on website evidence:** `[NEW]` entries from marketing copy must carry `confidence: medium` and a `(website-claim, not code-verified)` tag on the Description. Promote to `high` only after a source read confirms.

**Target ratio sanity check:** a website-only analysis that produces zero `[?]` entries across 15+ spine items is structurally suspicious. Real website-only analyses leave ambiguity; if your `[?]` count is zero, re-walk the spine and find the things you can't actually verify. Confidence without humility is a red flag, not a strength.
