# INDEX.md template

`research/INDEX.md` is the flat ledger of every researched target. Every skill run updates it in place — **never rewritten from scratch**. Per-target detail lives in `targets/<slug>.md` next to it.

The ledger is **spine-free**. Cross-target alignment, "what we have / what they have", and roadmap synthesis happen in a separate harmonization skill that reads this ledger plus `RISOLUTO_FEATURES.md` and computes the join itself. Do not aggregate spine-relative columns here.

## Structure

```markdown
# Research Ledger

> Flat ledger of every project researched by the `/risoluto-researcher` skill. Each row points at a per-target artifact under `targets/`. Rows are appended or updated in place — never destructively rewritten.
>
> This ledger is **spine-free**. No comparison with Risoluto's own feature spine (`RISOLUTO_FEATURES.md`) lives here. Cross-target alignment, "what we have / what they have / what neither has", and roadmap synthesis are deferred to a separate harmonization skill that reads this ledger plus the spine and computes the join itself.
>
> Targets researched under the older spine-aligned schema are preserved untouched in `legacy/`.

## Status enum

- `researched` — first run for this URL, artifact written.
- `refreshed` — re-run via `--refresh`; artifact updated; revision bumped.
- `failed` — run terminated before the artifact was written; reason recorded in the footnotes section below.
- `superseded` — target was renamed/moved upstream; artifact retained but new row points at the canonical URL.

## Targets

| slug | type | source | revision | captured | features | artifact | status |
|------|------|--------|----------|----------|----------|----------|--------|
| openhands | repo | github.com/All-Hands-AI/OpenHands | a3f2c1e | 2026-04-30 | 297 | targets/openhands.md | researched |
| amp | repo | github.com/sourcegraph/amp | 8b7d4f2 | 2026-04-30 | 184 | targets/amp.md | researched |
| replit-agent | website | blog.replit.com/agent-architecture | sha256:9f12abcd34ef | 2026-04-30 | 31 | targets/blog-replit-com-agent-architecture.md | researched |

## Failure footnotes

One line per `failed` row above. Format: `<slug> · <date> · <reason>`.

- example-broken · 2026-04-30 · clone failed: HTTP 404 on `git clone`

## Run history

| Run date | URLs invoked | Outcome |
|----------|--------------|---------|
| 2026-04-30 | https://github.com/All-Hands-AI/OpenHands, https://github.com/sourcegraph/amp, https://blog.replit.com/agent-architecture | 3 researched, 0 refreshed, 0 skipped, 0 failed |
```

---

## Update rules

The skill must update INDEX.md surgically.

1. **Never rewrite the file whole.** Parse the existing file, find or create the target's row, and update only that row plus the run history row. Any other approach risks erasing prior runs' data.

2. **Adding a new target** means: append a row to `## Targets`, append a row to `## Run history`. Do not touch existing rows.

3. **Refreshing an existing target** (`--refresh`) means: update the target's row in `## Targets` in place — flip `status` to `refreshed`, bump `revision`, bump `captured`, recompute `features`. Append a row to `## Run history`. Do not duplicate the target row.

4. **Marking a target failed** means: append a row to `## Targets` with `status: failed`, `revision: -`, `features: 0`, and `artifact: -`. Append a footnote to `## Failure footnotes`. Append a run history row.

5. **Marking a target superseded** is rare — used when the upstream URL has moved. Update the existing row's `status` to `superseded`, leave the `artifact` and `revision` as they were, and append a new row for the canonical URL with `status: researched`. Both rows coexist.

6. **The `source` column** drops the `https://` scheme and any trailing `.git` so rows stay scannable. Use `github.com/<org>/<repo>` for repos and `<hostname>[/<path>]` for websites/blogs.

7. **The `features` column** must match the artifact's coverage manifest total. If they drift, the artifact is the source of truth — fix the row.

## Anti-patterns to avoid

- ❌ Regenerating `INDEX.md` from only the current run's URLs. Prior rows will be lost.
- ❌ Computing per-target totals by summing markdown cells instead of re-reading the artifact's coverage manifest. Totals drift.
- ❌ Silently dropping stale targets. If a `targets/<slug>.md` no longer exists, leave the row with `status: superseded` rather than deleting it.
- ❌ Adding a spine-section matrix or negative-space table here. That synthesis belongs to the future harmonization skill that reads the whole corpus at once.
- ❌ Re-numbering or re-sorting rows. Append-only ordering preserves audit trail; sorts can be done at read time by the harmonization skill.
