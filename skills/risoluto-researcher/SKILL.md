---
name: risoluto-researcher
description: Research one or more competitor or reference projects (GitHub repo URLs, blog posts, product websites) and extract every observable behavior into a durable, evidence-backed ledger under `research/`. Spine-free — this skill records what the target does, not how it compares to Risoluto. Comparison and roadmap synthesis happen in a separate harmonization skill once the corpus is large enough. Accepts multiple URLs at once and fans out to up to 5 parallel parent subagents. Produces one Markdown artifact per target plus a flat-ledger update to `research/INDEX.md`. **Invoke explicitly** via the `/risoluto-researcher` slash command or by saying "use the risoluto-researcher skill on <url(s)>" — auto-triggering on generic research prompts is unreliable because Claude can often do shallow research without a skill.
---

# Risoluto Researcher

Use this skill to turn one or more URLs — GitHub repositories, blog posts, or product websites — into durable, evidence-backed feature ledgers under the private `research/` submodule. Each ledger enumerates every observable behavior of the target with file/line evidence and a verbatim quote, plus a stable revision (git SHA for repos, content hash for blog posts) so re-runs are reproducible.

This skill **does not compare** the target to Risoluto. The comparison join — "what we have, what they have, what neither has" — is deferred to a future harmonization skill that reads `research/targets/*.md` together with `RISOLUTO_FEATURES.md`. Per-target runs that pre-judge the comparison bias the corpus toward whichever target was analyzed first; collecting raw target facts now lets the harmonization skill weigh signal across many peers later.

## When to use

Use this skill when the user wants to:

- Pull one or more new target projects into Risoluto's research corpus.
- Refresh an existing per-target file because the upstream has shipped new features.
- Capture an architecture-deep blog post into the corpus alongside source-backed repos.
- Document a competitor or reference project's full behavior surface for later cross-target synthesis.

Do NOT use this skill when:

- The user is debugging Risoluto's own runtime — use `risoluto-logs`.
- The user wants comparison or roadmap drafting — that's the future harmonization skill, not this one.
- The repo being analyzed IS Risoluto itself — that belongs in `update-feature-spine`, not here.

## Prerequisites

Before running the skill body, verify these preconditions. If any fails, stop and tell the user what to set up first — **never fabricate an answer**.

1. `research/` exists at the repo root and is a git submodule. If it's missing or empty, report that and ask the user to initialize it.
2. `research/INDEX.md` exists. If it's missing, the submodule was reorganized incorrectly — stop and surface that.
3. `research/targets/` exists (per-target artifacts go here).
4. Required tools available: `git`, `gh`, `defuddle` (for clean-markdown extraction from websites), plus standard Unix utilities.
5. For website / blog targets in a crawl-heavy run, `agent-browser` is available; if not, fall back to `defuddle` + `WebFetch` per page.

## Inputs

- **Required:** one or more URLs (whitespace- or newline-separated). Each may be:
  - a GitHub repo URL — e.g. `https://github.com/All-Hands-AI/OpenHands`
  - a GitHub sub-package URL — e.g. `https://github.com/langchain-ai/langchain/tree/master/libs/core` (treated as a separate target slugged from owner-repo-path-tail)
  - a blog post URL — e.g. `https://blog.replit.com/agent-architecture`
  - a product website URL — e.g. `https://aider.chat`
- **Optional:** `--refresh <url> [<url> ...]` to force re-research on URLs already present in `INDEX.md`. Without this flag, known URLs are skipped with a warning.

The skill detects type per URL: `github.com/<org>/<repo>` → repo (full); `github.com/<org>/<repo>/tree/<branch>/<path>` → sub-package of a monorepo (cloned as the parent repo, but Pass 1/2 scoped to `<path>`); everything else → website/blog (treated identically — both go through web extraction).

For monorepos, the default is **one artifact per top-level URL** covering the whole repo. Pass 1 lists each sub-package in the Module map; Pass 2 fans out one child per sub-package on top of the cross-cutting surfaces. If you want each sub-package as its own ledger row (separate `targets/<slug>.md`), pass each sub-package URL explicitly via the `tree/<branch>/<path>` form. See `references/extraction-methods.md` § "Monorepo with many sub-packages".

## Outputs

1. `research/targets/<slug>.md` — per-target ledger (created or appended-to). One file per URL.
2. `research/INDEX.md` — flat ledger row appended (or updated, on `--refresh`). Status enum: `researched`, `refreshed`, `failed`, `superseded`.
3. `research/.cache/clones/<slug>/` — local clone of repo targets. Persistent across runs; gitignored. Blog/website targets do not produce a clone.
4. A short structured terminal report — one row per URL with slug, behaviors found, time taken, status, and any failure reason.

Slug rules:

- GitHub repo (full): `<org>-<repo>`, lowercased, hyphen-separated. Strip `.git`.
  `github.com/All-Hands-AI/OpenHands` → `all-hands-ai-openhands.md`
- GitHub sub-package (`tree/<branch>/<path>` form): `<org>-<repo>-<path-with-slashes-as-hyphens>`, lowercased.
  `github.com/langchain-ai/langchain/tree/master/libs/core` → `langchain-ai-langchain-libs-core.md`
- Website / blog: primary hostname, lowercased, dots → hyphens, strip `www.`, plus a slugified path tail.
  `https://blog.replit.com/agent-architecture` → `blog-replit-com-agent-architecture.md`
- On collision, append `-v2`, `-v3` rather than overwriting.

## Coverage strategy — why exhaustive extraction is hard and how this skill approaches it

No single LLM pass guarantees full feature extraction from a non-trivial repo. Coverage is approached through four mechanisms — skipping any one of them compounds misses.

1. **Two-pass design.** Pass 1 builds a surface inventory (broad map of where features live). Pass 2 fans out one subagent per surface to enumerate every behavior on that surface. Pass 1 is a fast structural read; Pass 2 is the depth pass. Both run autonomously in the same skill invocation — no human gate between them.

2. **Surface enumeration, not free-form exploration.** Before deep extraction, every source surface that could reveal a behavior is enumerated. The full surface taxonomy lives in `references/two-pass.md`. Surfaces include README, docs/ tree, CLI `--help` for every subcommand, HTTP/RPC route tables, OpenAPI/schema files, config schema, test `describe`/`it` blocks, public exports, top dependencies, issue labels, recent issue titles, changelog, and (for hybrid/website targets) blog posts.

3. **Parallel subagents.** Pass 2 spawns one subagent per surface listed in Pass 1. Each subagent owns a disjoint slice; merging is straightforward — no dedup needed. Inside a single target, child subagents are capped at 5 concurrent. Across targets in a multi-URL run, parent subagents are also capped at 5 concurrent. Worst-case 25 nested in flight; if a run wobbles, dial children to 3 and re-run.

4. **`colgrep` everywhere.** Every Pass 1 reader and every Pass 2 surface subagent must use `colgrep` as its primary search tool — semantic + hybrid search beats keyword grep at locating behavior signals. The colgrep reminder block lives in one place (`references/extraction-methods.md` § "Subagent prompt template") and is pasted verbatim into every subagent prompt.

Treat these as hard requirements. If any is skipped or impossible (e.g. subagents unavailable in the environment), say so explicitly in the report so the user can calibrate trust in the result.

## Workflow

### 1) Parse inputs

Tokenize the args by whitespace and newlines. For each URL:

- If it matches `^https?://github\.com/[^/]+/[^/]+/?$`, mark `target_type=repo`.
- Anything else with a hostname → `target_type=website`. Blog posts and product sites are handled identically here.
- Compute `slug` per the rules above.
- Record whether the URL appears in the `--refresh` set.

If the args look malformed (no parseable URLs), stop and surface the parse error with the first offending token.

### 2) Filter against the ledger

Read `research/INDEX.md`. For each URL:

- If `slug` already has a row AND the URL is not in the `--refresh` set → mark `skip`. Log: `<slug> already researched on <captured_at> at <revision>. Skipping. Pass --refresh <url> to re-run.`
- If `slug` has a row AND `--refresh` was passed → mark `refresh`.
- If no row exists → mark `new`.

After the filter, if every URL was skipped, exit cleanly with a one-line summary. No subagents to spawn.

### 3) Queue and spawn parent subagents

Spawn up to 5 parent subagents in parallel — one per `new` or `refresh` URL. Queue the rest. As each parent completes, dequeue the next.

Each parent runs the per-target workflow (steps 4–7 below) end-to-end and returns a structured result. Parents do **not** share context; they're independent.

In a single Agent tool call you may spawn multiple parents (up to 5). To launch parallel work in the same turn, send all `Agent` tool uses in one assistant message.

### 4) Per-target: clone or fetch

**For repos** — shallow clone into the persistent cache:

```bash
mkdir -p research/.cache/clones
DEFAULT_BRANCH=$(gh repo view <owner>/<repo> --json defaultBranchRef --jq '.defaultBranchRef.name')

# If clone already exists from a prior run, reuse it but pull to the latest of the default branch.
if [ -d research/.cache/clones/<slug>/.git ]; then
  git -C research/.cache/clones/<slug> fetch --depth 1 origin "$DEFAULT_BRANCH"
  git -C research/.cache/clones/<slug> reset --hard "origin/$DEFAULT_BRANCH"
else
  git clone --depth 1 --branch "$DEFAULT_BRANCH" <repo-url> research/.cache/clones/<slug>
fi

REVISION=$(git -C research/.cache/clones/<slug> rev-parse --short HEAD)
```

If the user pinned a version/tag/SHA, fetch that instead.

**For websites and blog posts** — fetch with `defuddle` (primary) or `WebFetch` (fallback). For interactive / heavily-scripted pages where content renders client-side, use `agent-browser`. Compute the revision as the first 12 hex chars of `sha256(rendered_markdown)`:

```bash
# Pseudo-code: actual implementation uses Read on a temp file written by the fetcher.
REVISION="sha256:$(sha256sum <fetched-markdown> | cut -c1-12)"
```

Record `target_type`, `primary_url`, `revision`, and `fetched_at` (UTC date) for the artifact's source manifest.

### 5) Pass 1 — broad map

Run a single subagent per target that reads top-level signals and emits a surface inventory. The exact format and the list of surfaces to enumerate live in `references/two-pass.md` § "Pass 1: surface inventory". The output is bullet-list-with-counts, not detailed behavior records.

For repos, top-level signals include README + CHANGELOG + ROADMAP + package manifest + `docs/` directory listing + entry-point detection + route-file detection + config-schema detection + test discovery + issue label list + open-issue title list + branch metadata. For websites/blogs, surfaces are the page itself plus any directly linked subpages (`/docs`, `/changelog`, `/blog`, `/features`, `/pricing`, `/security`).

Pass 1 must use `colgrep` as its primary search tool. The skill's subagent prompt template enforces this — see `references/extraction-methods.md` § "Subagent prompt template" and paste verbatim.

### 6) Pass 2 — per-surface deep dive

For each surface listed in Pass 1, spawn one Pass 2 subagent. Cap at 5 children concurrent per parent; queue the rest. Each child enumerates every behavior on its surface with full evidence.

The child returns a structured Markdown block with the schema in `references/template-target.md` § "Behaviors". The merge step is mechanical — each child owns a disjoint surface, so no dedup is needed.

Every Pass 2 child must:

- Use `colgrep` as the primary search tool.
- Produce a list of behaviors where each has: `behavior-id`, description, source (file:line or url#anchor), verbatim 1–3 line quote, confidence (high/medium/low), and status (shipped/in-flight/experimental/deprecated) when discoverable.
- Return a structured report under 500 lines — long lists are compressed into surface sub-tables when needed.

If a Pass 2 child fails (timeout, crash, no signal), record the surface as `status: failed` in the artifact's coverage manifest and continue with the others.

### 7) Write the per-target artifact

Use the template in `references/template-target.md` verbatim. Fill every section: source manifest, Pass 1 broad map, Behaviors (one subsection per surface), Coverage manifest, Run history.

Key rules:

- Every behavior has all four evidence fields: source location, verbatim quote, version/fetch date, confidence. Missing any → drop confidence to `low` and surface in `## Needs follow-up`.
- The artifact does **not** carry any Risoluto-relative information. No comparison field, no legend codes beyond confidence/status. If the target ships something Risoluto doesn't, just record what the target does.
- The Coverage manifest reflects reality: every surface attempted, every surface skipped with reason. Failed Pass 2 children show as `failed` not `skipped`.
- Run history preserves deltas. On `--refresh`, append a row — do not overwrite prior rows.

### 8) Update the ledger

Read `research/INDEX.md`. Append or update the target's row in `## Targets` per the schema in `references/template-index.md`:

```
| <slug> | repo|website | <hostname-and-path> | <revision> | <YYYY-MM-DD> | <feature-count> | targets/<slug>.md | researched|refreshed|failed|superseded |
```

If the row already exists (refresh path), update in place — never destructively rewrite the file. Append a one-line entry to `## Run history` covering all URLs in this invocation.

For `failed` rows, append a one-line entry to `## Failure footnotes` with the failure reason.

### 9) Report back

Produce this structured block. The operator reads it at a glance, and it diffs cleanly across runs. Keep the shape, fill every field. If a field has nothing to say, write `none` rather than omitting the line.

```markdown
**Run:** <YYYY-MM-DD> · <N> URLs invoked · <N> researched · <N> refreshed · <N> skipped · <N> failed
**Per-target results:**
- <slug> (<repo|website>) · <feature-count> behaviors · <revision> · <duration> · <status>
- ...
**Skipped (already in ledger; pass --refresh to re-run):**
- <slug> · <captured-at> · <revision>
- ...
**Failed:**
- <slug> · <reason>
- ...
**Files written:** <count> artifact(s) in research/targets/, INDEX.md updated.
```

The per-target row's `feature-count` must match the artifact's coverage manifest total; if they drift, the artifact is the source of truth.

## Quality self-check before declaring done

Before claiming the run is complete, verify:

- [ ] Every URL passed in is accounted for: researched, refreshed, skipped, or failed. None silently dropped.
- [ ] Each `targets/<slug>.md` exists and parses as valid Markdown.
- [ ] Every behavior entry has all four evidence fields populated (source, quote, revision/fetched_at, confidence).
- [ ] No artifact contains the strings `Risoluto`, `Comparison vs`, `[R+]`, `[T+]`, `[R!]`, `[=]`, `Spine version used`, or any other spine-relative legend code. If any does, the artifact came out wrong — re-run that target.
- [ ] `## Coverage manifest` is populated with every surface attempted AND every surface skipped/failed with reason.
- [ ] `research/INDEX.md` was updated in place — NOT destructively rewritten. Verify by diffing against the prior version: only the new row(s) and the Run history row should differ.
- [ ] Each repo target has a clone in `research/.cache/clones/<slug>/` whose `git rev-parse HEAD` matches the artifact's `revision` field.
- [ ] Each blog/website target's `revision` is `sha256:<12hex>`, computed from the fetched markdown.
- [ ] Run history row appended to each per-target file (revision + fetched_at + behavior count + delta from previous run, if any).
- [ ] Concurrency caps respected: at no point did more than 5 parent subagents run in parallel; at no point did any parent spawn more than 5 children.

Treat this checklist as a hard gate. If any box can't be ticked, say so in the report instead of declaring success.

## Reference files

For exact shapes and procedures, see:

- `references/template-target.md` — full template for `targets/<slug>.md`, with every section, field, and example.
- `references/template-index.md` — INDEX.md flat-ledger row format and the in-place update contract.
- `references/multi-url.md` — the parse → filter → queue → spawn sequence, the skip-on-collision policy, and the ledger-update protocol.
- `references/two-pass.md` — Pass 1 surface inventory format + Pass 2 per-surface fan-out, surface taxonomy, child-cap policy, merge protocol.
- `references/clone-cache.md` — `research/.cache/clones/<slug>/` contract: persistent across runs, gitignored, manual cleanup, `git rev-parse HEAD` for revision capture, when to unshallow.
- `references/extraction-methods.md` — clone/crawl strategies, when to delegate to subagents, hard cases (paywalled docs, monorepos, dormant repos, closed-source targets), and the colgrep reminder block.
- `references/legend.md` — confidence and status semantics. No spine-relative codes.
