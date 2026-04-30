# Two-pass extraction

Each per-target parent subagent runs two passes back-to-back, autonomously, with no human gate between them.

- **Pass 1: surface inventory.** A single subagent reads the target's structural signals and emits a broad map — one bullet per surface, with a 1–2 line summary and an estimated behavior count.
- **Pass 2: per-surface deep dive.** One subagent per surface listed in Pass 1, capped at 5 concurrent. Each child enumerates every observable behavior on its surface with full evidence.

The merge is mechanical: each child owns a disjoint surface, so no dedup is needed. Pass 1's broad map and Pass 2's behavior lists both end up in the artifact (Pass 1 as the `## Pass 1: Broad map` section, Pass 2 as the per-surface subsections under `## Behaviors`).

## Pass 1: surface inventory

The Pass 1 subagent reads top-level signals only. It is not a behavior extractor — it's a structure scanner. Its output drives the Pass 2 fan-out.

### Pass 1 input

- For repos: the local clone at `research/.cache/clones/<slug>/`.
- For websites and blog posts: the primary URL plus any directly linked subpages of interest (`/docs`, `/changelog`, `/blog`, `/features`, `/pricing`, `/security`).

### Pass 1 surfaces to inventory

For repo targets, enumerate at minimum:

- **README** — file size, top-level headings.
- **docs/** — file count under `docs/` (includes `.md` AND `.mdx`). Detect docs generator: Mintlify (`mint.json`), Docusaurus (`docusaurus.config.*`), MkDocs (`mkdocs.yml`), Astro Starlight. See `extraction-methods.md` § "Mintlify / Docusaurus / MkDocs detection".
- **CHANGELOG / releases** — file present? recent? entry count in the last 90d.
- **CLI surface** — entry-point binaries (under `bin/`, `cmd/`, `cli/`, `scripts/`, or in the package manifest's `bin` / `scripts`). Subcommand count if discoverable. For multi-language repos, identify the language that hosts the CLI.
- **HTTP/RPC API** — router files, OpenAPI/GraphQL schemas. Route count if discoverable. For multi-language repos, identify the language that hosts the API.
- **UI surface** — frontend file count, page/view file count, framework (React/Vue/Svelte/etc).
- **Config surface** — schema files, env var docs, key count.
- **Module map** — top-level `src/` (or repo-root) subdirectories, package boundaries. **For monorepos, list every sub-package as its own bullet** (see `extraction-methods.md` § "Monorepo with many sub-packages"). **For multi-language repos with 2+ languages each over ~10% of source size, sub-bullet by language** (see `extraction-methods.md` § "Multi-language repo").
- **Database / schema** — SQL DDL, ORM models, stored procedures (PLpgSQL, PL/SQL). Only when present; many repos lack a DB layer.
- **Issues** — total open count, label list.
- **Tests** — test directory file count, framework hint.
- **Examples / demos** — `examples/`, `demo/`, `sample/`, `cookbook/`, `notebooks/` presence and file count.
- **Blog / posts** — references in README or website footer.

For repos with academic content (TeX, BibTeX, large datasets/ or paper/ dirs), record presence in the **Source manifest** but DO NOT add a behavior subsection for them. See `extraction-methods.md` § "Academic / training material noise".

For website / blog targets, enumerate at minimum:

- The primary page itself.
- Any subpages found via depth-1 link extraction matching `/docs`, `/features`, `/pricing`, `/changelog`, `/blog`, `/security`, `/api`, `/compare`, `/vs-*`, `/roadmap`.
- A linked GitHub repo, if one exists in the footer/docs (treated as a separate surface, not a separate target — but if the repo is substantial, ask the operator whether to spawn a hybrid run).

### Pass 1 output format

```markdown
- **README** — 6 KB. Positioning, install, quickstart. ~8 behaviors.
- **docs/** — 32 files under docs/. Architecture, agents, deployment. ~80 behaviors.
- **CLI surface** — entry: cmd/openhands/main.py. 12 subcommands. ~30 behaviors.
- **HTTP/RPC API** — routes in api/v1/. 24 endpoints. ~24 behaviors.
- **UI surface** — frontend/src/pages/. 11 pages. ~40 UI behaviors.
- **Config surface** — config.toml schema. 47 keys. ~47 behaviors.
- **Module map** — src/agenthub/, src/runtime/, src/evals/. 8 top-level modules.
- **Issues** — 312 open. Labels: feature, bug, design.
- **Tests** — pytest. 487 test files. ~487 behaviors.
- **Examples / demos** — examples/notebooks/, examples/agents/. ~12 behaviors.
- **Blog** — 4 posts on all-hands.dev/blog mentioning roadmap.

Estimated total: ~280–320 behaviors. Surfaces to deep-dive: 11.
```

If a surface is structurally absent (e.g., target has no UI), the bullet says `**UI surface** — none. (no frontend/, no /pages, no React/Vue/Svelte deps).` The Pass 2 fan-out will skip that surface and the artifact's coverage manifest will record it as `skipped`.

### Pass 1 must use colgrep

The Pass 1 subagent's prompt includes the colgrep reminder block from `extraction-methods.md` § "Subagent prompt template". It should not use Grep/Glob.

Pass 1 is fast — usually under 90 seconds for repos with the colgrep index already warm. Don't optimize it further at the cost of completeness; the cost of missing a surface in Pass 1 is that no Pass 2 child runs for it.

## Pass 2: per-surface deep dive

For each surface listed in Pass 1, spawn one Pass 2 subagent. Concurrency cap: **5 children in flight per parent**, queue the rest. As each child completes, dequeue the next.

### Pass 2 child input

- Target slug.
- Surface name (from Pass 1 bullet).
- Surface scope (e.g., "all files under docs/", "the CLI binary at cmd/openhands/main.py").
- The local clone path or website URL.

### Pass 2 child output

A structured Markdown block matching `template-target.md` § "Behaviors":

```markdown
### <Surface>

- [<behavior-id>] <one-line description>
  - source: `<file:line>` or `<url>#<anchor>`
  - quote:
    > <verbatim 1–3 lines>
  - confidence: high | medium | low
  - status: shipped | in-flight | experimental | deprecated   <!-- when discoverable -->
```

Children must use `colgrep` as their primary search tool. The full prompt template (with colgrep block) lives in `extraction-methods.md` § "Subagent prompt template" — paste it verbatim into every child's prompt.

### Pass 2 merge protocol

The parent receives N child reports (one per surface). The merge is straightforward:

1. Each child's `### <Surface>` block goes under `## Behaviors` in the artifact, in the order Pass 1 listed the surfaces.
2. The child's behavior-id list is preserved as-is. No dedup needed because surfaces don't overlap.
3. The artifact's `## Coverage manifest` gets one row per Pass 2 child: `scanned` if the child returned a non-empty list, `failed` if the child crashed/timed out, `skipped` if Pass 1 marked the surface absent.
4. The parent computes `behavior_count = sum(child behavior counts)` and writes that into the source manifest's `runs` count and (later) into the INDEX.md row.

### Handling Pass 2 failures

If a Pass 2 child fails (timeout, crash, no signal), the parent does NOT retry. Instead:

1. Add a stub `### <Surface>` heading to the artifact with body: `> Pass 2 child failed: <reason>. Surface not enumerated. See coverage manifest.`
2. Mark the surface `failed` in the coverage manifest with the reason.
3. Continue with the other children.

The user can re-run with `--refresh <url>` later to retry just that surface; today's behavior is fail-and-skip, not partial-retry.

## Adjusting concurrency

The default cap is 5 children per parent. If you see signs of trouble — token exhaustion in transcripts, repeated child timeouts, or operator-reported runaway wall-clock — dial it down:

- **Children per parent: 3** — safer, slower, fewer total nested in flight (≤15 worst case for 5 parents). Edit the parent prompt to spawn 3 children at a time and queue the rest.
- **Sequential children: 1** — last resort. Only if the harness flat-out can't handle nested fan-out. Wall-clock is much worse but reliability is high.

The skill does not currently expose a `--concurrency` flag. If we need that later, add it as a future enhancement; for now, edit `two-pass.md` and re-run.

## What two-pass does NOT do

- It does **not** wait for human review between passes. Both passes are autonomous in a single skill invocation.
- It does **not** spine-align in either pass. Pass 1 is structural, Pass 2 is behavior-level — neither references Risoluto's spine. Comparison happens in the future harmonization skill.
- It does **not** dedup behaviors across surfaces (e.g., a CLI flag mentioned in README is recorded both in the README surface entry and the CLI surface entry). The future harmonization skill can dedup at corpus scope; per-target redundancy is acceptable and even useful for evidence cross-checking.
