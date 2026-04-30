# Confidence and status — semantics

The skill is **spine-free**. There are no Risoluto-relative legend codes — no `[=]`, no `[R+]`, no `[T+]`, no `[R!]`, no `[NEW]`, no `[?]`. Every behavior carries two simple, target-only annotations: `confidence` and `status`. Cross-target comparison happens in a separate harmonization skill and is not encoded in the artifacts.

## Confidence

`confidence` reflects how strongly the evidence supports the behavior claim.

| Level | Meaning | When to use |
|-------|---------|-------------|
| **high** | Direct, unambiguous evidence. Code or canonical docs explicitly describe the behavior. | The README states the rule and the implementation file shows it. The CLI source defines the flag. The OpenAPI schema lists the route. |
| **medium** | Evidence strongly implies the behavior but leaves at least one observable detail uncertain. | Docs describe the behavior but don't fully specify defaults or limits. Marketing copy and a related test agree but no canonical source confirms. |
| **low** | Evidence is indirect — marketing copy alone, a forum post, a closed issue, or a stale doc. | Inferred from a blog post not corroborated by repo source. Implied by a feature flag seen in changelog but not exercised. |

Every `low`-confidence behavior MUST appear in the artifact's `## Needs follow-up` section with a concrete question for the reviewer. A `low` claim that nobody can re-verify is noise.

## Hard rules for confidence — anti-over-confidence

1. **Website-only evidence cap.** If your only sources are website pages (no repo clone, no source code read), confidence is **capped at medium** regardless of how thorough the docs seem. Marketing copy is not proof.
2. **One-source cap.** If a behavior traces to a single source (one doc page, one README section), confidence is **capped at medium**. High confidence requires corroboration across at least two independent sources.
3. **Inferred vs code-verified.** A claim is **code-verified** when you have read the actual implementation and can cite the specific behavior in source. A claim is **inferred** when you drew it from docs, README, release notes, or marketing copy without touching the source. Inferred claims drop one confidence level (`high → medium`, `medium → low`) and append `(inferred, not code-verified)` to the description.

## Status

`status` reflects the behavior's lifecycle position — when discoverable. Many behaviors won't carry a status, and that's fine; only fill it when there's signal.

| Value | Meaning | Signal sources |
|-------|---------|----------------|
| **shipped** | Behavior is in the current release; users can rely on it. | Release notes, stable docs, version-tagged source. |
| **in-flight** | Behavior is being actively built or rolled out — visible in unmerged PRs, recent commits without a release, or marked behind a feature flag without a default-on. | Open PR titles, "experimental" labels, feature flags in config. |
| **experimental** | Behavior is shipped but explicitly labeled experimental, beta, alpha, or unstable. Users should expect breakage. | `(experimental)` / `(beta)` / `(alpha)` markers in docs, version-disabled by default. |
| **deprecated** | Behavior is shipped but slated for removal. | `@deprecated` annotations, "deprecated as of vN.N" notes in changelog. |

If `status` is omitted, the reader assumes `shipped`. Don't pad — only set status when the source explicitly tells you.

## Edge cases

### Partially implemented behavior

"Partially" is not a status. Pick the most fitting status (often `experimental` or `in-flight`) and use the description text to enumerate exactly which parts are present and which aren't. Confidence drops to medium unless the gaps are themselves documented.

### Behavior on a feature flag

`status: experimental` if the flag is off by default. `status: shipped` with a note in the description if the flag is on by default and users can opt out. `status: in-flight` if the flag is wired but no UI exposes it.

### Behavior present in code but not documented

`confidence: medium` (one source). Description should note "documented only in source, not in user-facing docs." This is common in undocumented internal APIs that users still call.

### Behavior documented but not implemented (vaporware)

`status: in-flight`, `confidence: low`, surface in `## Needs follow-up`. Be conservative — marketing copy that overstates reality is a known failure mode.

### Behavior removed since the last research run

If a re-run shows the behavior is gone from current source, `status: deprecated` with a note in the description. The Run history delta column captures the drop.

## What's deliberately not here

This skill **does not encode**:

- **Who has it.** Risoluto-vs-target comparison lives in the future harmonization skill, not in artifacts.
- **Roadmap candidacy.** No `interesting` / `noise` / `out-of-scope` flags. The harmonization skill weighs cross-corpus signal and decides candidacy itself.
- **Strength comparison.** No "stronger" / "weaker" / "comparable" judgments. Just describe the behavior; the harmonization step compares.
- **Effort estimates.** No story points, no t-shirt sizes. That's a synthesis-and-planning concern, downstream.

If a future maintainer wants to add a comparison column to artifacts, the right move is to extend the harmonization skill instead — keep this layer raw.
