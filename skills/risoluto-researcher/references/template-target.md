# Per-target file template

Use this verbatim as the skeleton for every `research/<slug>.md`. Fill every section. Omit nothing.

---

```markdown
# <Target name>

> <1-sentence positioning: what the target is and who it's for.>

<!-- Metadata block — populated on every run. Never stale. -->

- **Target type:** github-repo | website | hybrid
- **Primary URL:** <url>
- **Secondary URLs:** <website-or-repo-if-hybrid>
- **Default branch:** <main | master | …> (detected, not assumed)
- **Version / tag:** <semver or "default branch">
- **Commit SHA:** <short-sha> (if repo)
- **Fetched at:** <YYYY-MM-DD> (UTC)
- **Last upstream commit:** <YYYY-MM-DD> by `<author-or-bot>`
- **Repo health:** <active | dormant | archived> — <1-sentence justification: commit cadence, archive status, stars>
- **Commits in last 90 days:** <N>
- **Stars:** <N>
- **Primary language(s):** <top 1–2>
- **Spine version used:** <git SHA of RISOLUTO_FEATURES.md when this run happened>
- **Runs so far:** <N> (this run is run <N>; prior runs listed in `## Run history`)

## Summary

2–4 paragraphs covering:

- What the target actually is (one-liner plus distinguishing characteristics).
- Who the target is for (ICP).
- How it compares to Risoluto at the 30,000-ft level (not feature-by-feature — that's later).
- Anything structurally different that changes how the reader should interpret alignment (e.g., "this is a library, not an orchestrator, so expect many `[R!]` entries").

## Totals at a glance

| Symbol | Code | Count |
|--------|------|-------|
| ⚖️ | `[=]` | <n> |
| 🟢 | `[R+]` | <n> |
| 🔴 | `[T+]` | <n> |
| ⭐ | `[R!]` | <n> |
| ✨ | `[NEW]` | <n> |
| ❓ | `[?]` | <n> |
| — | **Total** | <n> |

- **Confidence mix:** high <n> · medium <n> · low <n>
- **Coverage mix:** surfaces scanned <n> / <n> · surfaces skipped <n> (see `## Coverage manifest`)

## Spine alignment

One subsection per top-level spine section, mirroring the structure of `RISOLUTO_FEATURES.md`. Within each section, one entry per spine item — never silently drop.

### <Spine section 1>

#### <Spine item title>  `[=]` · confidence: high

- **Description:** 2–3 sentences — what the target's version of this feature is.
- **How it works:** 2–4 sentences — the mechanism (key classes, routes, data flow).
- **Observable behaviors:**
  - <behavior 1 — rule/limit/default/UX specific>
  - <behavior 2>
  - <behavior 3>
  - <… **minimum 3, aim for 4–7**. If you can't list at least 3 concrete observable rules/limits/defaults/UX specifics, the entry is under-researched — go dig further in the target before shipping. Do not pad with generic statements to hit the count.>
- **Evidence:**
  - Source: `<file path>:<line-range>` or `<url>#<anchor>`
  - Quote:
    > <1–3 line verbatim excerpt>
  - Version / commit / fetched: <version> @ <sha or fetch-date>
- **Comparison vs Risoluto:** 2–4 sentences naming the specific Risoluto surface (file path, UI page, API endpoint) and how the target's behavior differs. Do not hand-wave.
- **Confidence:** high | medium | low
- **Searched for:** <how the skill actively searched — needed especially for `[R!]` entries. E.g., "grepped for 'webhook', 'http.Handle', 'router.Post' across repo; checked docs/events.md; no evidence found.">

#### <Spine item title>  `[R!]` · confidence: high

- **Description:** …
- **Comparison vs Risoluto:** Risoluto ships this at `src/…`; target has no equivalent surface.
- **Evidence:** Negative evidence: list the queries / doc pages / files searched. Include at least 3 distinct search attempts.
- **Searched for:** (mandatory for `[R!]` — this is the inversion test)
- **Confidence:** high (requires ≥3 distinct search attempts to claim high on a negative)

### <Spine section 2>

<… same pattern for every section and item …>

## Target-novel features

Features the target implements that are **not on the Risoluto spine**. Every `[NEW]`.

### <Feature title>  `[NEW]` · confidence: high

- **Description:** …
- **How it works:** …
- **Observable behaviors:**
  - …
- **Evidence:**
  - Source: …
  - Quote:
    > …
  - Version / commit / fetched: …
- **Why this isn't on our spine:** 1 sentence — either "out of our problem space" (justify) or "gap we haven't named yet" (this is the common case and feeds the roadmap).
- **Confidence:** …

<… repeat for every `[NEW]` …>

## Needs follow-up

Every `[?]` entry, every `low`-confidence entry, and every item the skill could not verify. Each entry names a concrete question to resolve.

- **<item title> (`[?]`):** <what's ambiguous> — resolution path: <how you'd verify, e.g., "read target's closed issue #412", "run their CLI with `--debug`">.
- …

## Candidate flags

Light triage signal for every `[T+]` and `[NEW]`. **Not a roadmap.** Roadmap synthesis is deliberately deferred to a separate skill that runs after the research corpus is large enough (~10–15 targets) — a `[T+]` seen in one target is weak signal; the same `[T+]` seen in 3+ targets is strong signal, and only the cross-target view can tell the difference.

Do **NOT** add effort estimates, bundle assignments, Risoluto touch points, or "why it matters" narratives here. One line per entry.

- **<title>** (`[T+]` | `[NEW]`) — signal: **interesting** — <1 sentence on the user-value question the later synthesis will need to weigh>
- **<title>** (`[T+]` | `[NEW]`) — signal: **noise** — <1 sentence on why this is cargo-cult / stack-specific / not a real user problem for Risoluto>
- **<title>** (`[T+]` | `[NEW]`) — signal: **out-of-scope** — <1 sentence on why this sits outside Risoluto's problem space (e.g., GUI-only, SaaS-specific, ecosystem-specific)>

Record every `[T+]` and `[NEW]` — do not filter by signal at this stage. The synthesis skill will decide what to weight up or ignore after seeing the full corpus.

## Coverage manifest

Table of every surface the skill attempted.

| Surface | Scope | Status | Items found | Notes |
|---------|-------|--------|-------------|-------|
| README | `README.md` | scanned | <n> | — |
| docs/ | `docs/**/*.md` (<n> files) | scanned | <n> | — |
| CHANGELOG | `CHANGELOG.md` | scanned | <n> | — |
| CLI `--help` | `bin/<binary>` | scanned | <n> | ran in local sandbox |
| HTTP routes | `src/server/routes.ts` | scanned | <n> | — |
| OpenAPI | `api/openapi.yaml` | scanned | <n> | — |
| Config schema | `config/schema.json` + `*.env.example` | scanned | <n> | — |
| Tests | `tests/**/*.test.ts` (<n> files) | scanned | <n> | — |
| Public exports | `src/index.ts` | scanned | <n> | — |
| Top deps | `package.json` | scanned | <n> | — |
| Issue labels | `gh label list` | scanned | <n> | — |
| Open issues | `gh issue list --limit 100` | scanned | <n> | — |
| CI workflows | `.github/workflows/` | scanned | <n> | — |
| Examples | `examples/` | scanned | <n> | — |
| Pricing page | n/a | skipped | — | not a commercial website |
| <other> | <scope> | skipped | — | <reason> |

- **Coverage rating:** high | medium | low (high = ≥80% of applicable surfaces scanned with non-empty results).

## Analyst notes

Free-form. Anything that didn't fit the structure but matters for the reader. Examples:
- Target is dormant (last commit N months ago) — adopt ideas, don't copy direction.
- Target recently pivoted; pre-pivot features may be stale.
- Target's docs contradict their code at <specific point> — source is the tiebreaker.
- Possible new Risoluto bundle "Plugin ecosystem" suggested by `[NEW]` items X, Y, Z.

## Run history

| Run | Date | Spine SHA | Commit analyzed | Delta from previous run |
|-----|------|-----------|-----------------|-------------------------|
| 1 | YYYY-MM-DD | <sha> | <target-sha> | initial |
| 2 | YYYY-MM-DD | <sha> | <target-sha> | +<n> `[NEW]`, −<n> `[R!]` flipped to `[=]`, etc. |
```

---

## Rules for filling the template

1. **Never silently drop a spine item.** Every spine entry gets a code or `[?]` with a reason. A truly unknown entry is `[?]`, not absent.
2. **Observable behaviors are not optional.** If you can list <2, the entry is under-researched. Go back and dig.
3. **Quotes are verbatim.** Copy text exactly. Don't paraphrase inside the blockquote.
4. **Paths and URLs must be specific.** `src/` is not good enough. `src/server/routes.ts:L44–L112` is.
5. **`[R!]` requires searched-for evidence.** The `Searched for:` field is how the inversion test is audited.
6. **Roadmap candidates cite the bundle taxonomy from `docs/ROADMAP_AND_STATUS.md`.** Do not invent new bundle names.
7. **Coverage manifest reflects reality.** If you skipped pricing pages because the target has none, mark the row `skipped` with reason. If you tried and failed, say so.
8. **Run history preserves deltas.** On refresh runs, add a row — do not overwrite prior rows.
