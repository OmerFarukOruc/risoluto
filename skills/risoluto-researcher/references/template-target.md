# Per-target file template

Use this verbatim as the skeleton for every `research/targets/<slug>.md`. Fill every section. Omit nothing.

---

```markdown
# <Target name>

> <1-sentence positioning, sourced from README or landing page.>

<!-- Source manifest — populated on every run. Never stale. -->

- **target_type:** github-repo | website | hybrid
- **primary_url:** <url>
- **secondary_urls:** <list, optional>
- **default_branch:** <main | master | …> (repos only; detected from `gh repo view`, never assumed)
- **revision:** <git short SHA | sha256:abcdef123456> (12 hex chars for the sha256 form)
- **fetched_at:** <YYYY-MM-DD> (UTC)
- **last_upstream_commit:** <YYYY-MM-DD> by `<author-or-bot>` (repos only)
- **repo_health:** <active | dormant | archived> — <1-sentence justification: commit cadence, archive status, star count> (repos only)
- **commits_in_last_90d:** <N> (repos only)
- **stars:** <N> (repos only)
- **primary_languages:** <top 1–2>
- **runs:** <N> (this run is run <N>; prior runs listed in `## Run history`)

## Summary

2–4 paragraphs covering:

- What the target actually is (one-liner plus distinguishing characteristics).
- Who the target is for (intended user, deployment shape).
- Anything structurally different that changes how the reader should interpret the behavior list (e.g., "this is a library, not an orchestrator", or "the website is marketing-only — code surface unverifiable").

## Pass 1: Broad map

The surface inventory built in Pass 1. Each bullet lists one surface, a 1–2 line summary, and an estimated behavior count. The Behaviors subsections below mirror this list exactly.

- **README** — <1-line>. ~N behaviors.
- **docs/** — <1-line, file count, top sections>. ~N behaviors.
- **CHANGELOG / releases** — <1-line>. ~N behaviors.
- **CLI surface** — entry: <path>. <K> subcommands. ~N behaviors.
- **HTTP/RPC API** — <1-line, route count>. ~N behaviors.
- **UI surface** — <1-line, page count>. ~N behaviors.
- **Config surface** — <1-line, schema source, key count>. ~N behaviors.
- **Module map** — <list of top-level modules>. ~N behaviors.
- **Issues** — <total open>. Labels: <list>.
- **Tests** — <test framework, file count>. ~N behaviors.
- **Examples / demos** — <1-line>. ~N behaviors.
- **Blog / posts** — <N posts referenced>.

Estimated total: ~N–M behaviors.

## Behaviors

One subsection per surface listed in Pass 1. Within each subsection, every observable behavior gets an entry. **No spine references. No comparison fields. No legend codes beyond `confidence` and `status`.**

### README

- [<behavior-id>] <one-line description>
  - source: `<file:line>` or `<url>#<anchor>`
  - quote:
    > <verbatim 1–3 lines>
  - confidence: high | medium | low
  - status: shipped | in-flight | experimental | deprecated   <!-- when discoverable -->

(repeat per behavior)

### docs/

(same per-behavior format)

### CLI surface

(same per-behavior format)

### HTTP/RPC API

(same per-behavior format)

### UI surface

(same per-behavior format)

### Config surface

(same per-behavior format)

### Module map

(same per-behavior format)

### Issues

(same per-behavior format — open issues, labels, recent triage signals)

### Tests

(same per-behavior format — test names often phrase behaviors directly)

### Examples / demos

(same per-behavior format)

### Blog / posts

(same per-behavior format)

<!-- Add or remove subsections to match Pass 1's surface inventory exactly. A surface that was skipped or failed in Pass 2 still appears here as a stub with an explanatory note, so the reader can see what's missing. -->

## Coverage manifest

Table of every surface attempted, every surface skipped with reason, and every Pass 2 child that failed.

| Surface | Scope | Status | Items found | Notes |
|---------|-------|--------|-------------|-------|
| README | `README.md` | scanned | <N> | — |
| docs/ | `docs/**/*.md` (<N> files) | scanned | <N> | — |
| CLI surface | `bin/<binary>` | scanned | <N> | ran in local sandbox |
| HTTP/RPC API | `src/server/routes.ts` | scanned | <N> | — |
| ... | ... | ... | ... | ... |
| Pricing page | n/a | skipped | — | not a commercial website |
| <other> | <scope> | failed | — | <reason: timeout, paywall, 404, child crash> |

- **Coverage rating:** high | medium | low (high = ≥80% of applicable surfaces scanned with non-empty results).

## Needs follow-up

Every `low`-confidence behavior, every surface flagged ambiguous, and every item the skill could not verify. One concrete question per entry — what would resolve it.

- **<behavior-id>:** <what's ambiguous> — resolution path: <e.g., "read target's closed issue #412", "run their CLI with `--debug`", "fetch the JS-rendered landing page via agent-browser">.
- …

## Run history

| Run | Date | Revision | Behaviors found | Delta from previous run |
|-----|------|----------|-----------------|-------------------------|
| 1 | YYYY-MM-DD | <revision> | <N> | initial |
| 2 | YYYY-MM-DD | <revision> | <N> | +<n> new, <n> updated, <n> dropped |
```

---

## Rules for filling the template

1. **No spine references.** Do not include `Comparison vs Risoluto`, `[=]`, `[R+]`, `[T+]`, `[R!]`, `[NEW]`, `[?]`, or `Spine version used` anywhere. The skill is spine-free; cross-target comparison happens in a separate harmonization skill.
2. **Every behavior has all four evidence fields.** Source location, verbatim quote, revision/fetched_at (carried implicitly via the Source manifest), confidence. Missing any of source/quote/confidence → drop confidence to `low` and surface in `## Needs follow-up`.
3. **Quotes are verbatim.** Copy text exactly. Don't paraphrase inside the blockquote.
4. **Paths and URLs are specific.** `src/` is not good enough. `src/server/routes.ts:L44–L112` is. URL anchors must point at the actual section, not the page root.
5. **Behavior IDs are stable.** Use a slug-like form (`auth-github-oauth`, `cli-flag-verbose`) so re-research can diff against prior runs cleanly. IDs do not need to be unique across targets, only within a target.
6. **Coverage manifest reflects reality.** If a surface was skipped because the target lacks it, mark `skipped` with the reason. If a Pass 2 child timed out or crashed, mark `failed`. Don't pretend coverage you don't have.
7. **Run history preserves deltas.** On `--refresh` runs, append a row — do not overwrite prior rows. The delta column is computed from a behavior-id-level diff against the previous run.
8. **The Behaviors subsection list mirrors Pass 1.** If Pass 1 lists 10 surfaces, you have exactly 10 Behaviors subsections (or 10 minus the surfaces that failed-with-reason in Pass 2 — those still get a stub heading with an explanatory note).
