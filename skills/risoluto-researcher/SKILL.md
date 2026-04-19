---
name: risoluto-researcher
description: Research a competitor or reference project (GitHub repo URL or website URL) and extract its atomic, behavior-level features into a private ledger under `research/`, aligned feature-by-feature against Risoluto's own feature spine. Produces a per-target Markdown file plus updates to the master INDEX.md. Pure research — builds the corpus that later enables cross-target roadmap synthesis. Does NOT draft roadmap issues or assign effort/bundle estimates; that synthesis happens in a separate skill once ~10–15 targets are in the ledger. **Invoke explicitly** via the `/risoluto-researcher` slash command or by saying "use the risoluto-researcher skill on X" — auto-triggering on generic research prompts is not reliable because Claude can often do shallow research without a skill.
---

# Risoluto Researcher

Use this skill to turn a single URL — a GitHub repository or a product website — into a durable, evidence-backed feature ledger that aligns the target project against Risoluto's own feature spine. The output is private (lives under the `research/` git submodule) and is the raw material for roadmap planning and competitive decisions.

The spine lives at `research/RISOLUTO_FEATURES.md` and is **maintained manually** by Omer / a separate PR-gated skill. This skill **reads the spine** and **never rewrites it**. If the spine file is missing, stop and surface that — do not invent a spine.

## When to use

Use this skill when the user wants to:

- Pull a new target project into Risoluto's competitive research set.
- Refresh an existing per-target file because the upstream has shipped new features.
- Compare Risoluto to a reference implementation (Symphony, Aider, Sweep, Devin-style, etc.).
- Turn a roadmap intuition ("they do X better than us") into a documented, cite-able claim.

Do NOT use this skill when:

- The user is debugging Risoluto's own runtime — use `risoluto-logs`.
- The user wants to read or summarize a repo without alignment to Risoluto — a plain Explore run suffices.
- The repo being analyzed IS Risoluto itself — that belongs in the spine-maintenance workflow, not here.

## Prerequisites

Before running the skill body, verify these preconditions. If any fails, stop and tell the user what to set up first — **never fabricate an answer**.

1. `research/` exists at the repo root and is a git submodule (or a sibling private working copy). If it's missing or empty, report that and ask the user to initialize it.
2. `research/RISOLUTO_FEATURES.md` exists and is non-empty. If it's missing or empty, report that and ask the user to populate the spine before any target alignment can be meaningful.
3. Required tools available: `git`, `gh`, `defuddle` (for website clean-markdown extraction), plus standard Unix utilities.
4. For website targets in a crawl-heavy run, `agent-browser` is available; if not, fall back to `defuddle` + `WebFetch` per page.

## Inputs

- **Required:** one of
  - a GitHub repo URL (e.g., `https://github.com/openai/symphony`)
  - a website URL (e.g., `https://aider.chat`)
  - a local path to an already-cloned repo
- **Optional:** a specific version, tag, or commit SHA to pin the analysis to.
- **Optional:** a `--refresh` hint from the user to update an existing per-target file rather than create a new one.

## Outputs

1. `research/<slug>.md` — the per-target ledger (created or updated).
2. `research/INDEX.md` — master cross-project index (updated).
3. A short terminal report to the user summarizing:
   - target name + version / commit / fetch date
   - counts per legend code (`[=]`, `[R+]`, `[T+]`, `[R!]`, `[NEW]`, `[?]`)
   - top 3 roadmap candidates with one-line justifications
   - any confidence-low entries that need human review

Slug rules:
- GitHub: `<org>-<repo>`, lowercased, hyphen-separated. Strip `.git`.
  - `github.com/openai/symphony` → `openai-symphony.md`
- Website: primary hostname, lowercased, dots → hyphens, strip `www.`.
  - `https://aider.chat/docs` → `aider-chat.md`
- On collision, append `-v2`, `-v3` rather than overwriting.

## Legend

Every alignment entry carries exactly one code. Evidence must support the choice.

| Symbol | Code | Meaning |
|--------|------|---------|
| ⚖️ | `[=]` | **Parity.** Both implement the capability at comparable fidelity and behavior. Small naming differences don't downgrade parity. |
| 🟢 | `[R+]` | **Risoluto stronger.** Both implement it, but Risoluto ships more behavior, better defaults, deeper UX, or stricter guarantees. |
| 🔴 | `[T+]` | **Target stronger.** Both implement it, but the target does it better — deeper, faster, more ergonomic, or covers cases Risoluto doesn't. **These are prime roadmap-study candidates.** |
| ⭐ | `[R!]` | **Risoluto-only.** Risoluto implements it; the target does not. Differentiator. Worth noting in positioning, not in roadmap. |
| ✨ | `[NEW]` | **Target-novel.** Target has a feature that is **not on Risoluto's spine at all.** Every `[NEW]` is a roadmap-candidate unless explicitly rejected. |
| ❓ | `[?]` | **Unclear.** Evidence is ambiguous, thin, or contradictory. Flag for human follow-up — never silently assume parity or a gap. |

**Important:** `[R!]` applies to items on the spine that the target lacks. `[NEW]` applies to items off the spine entirely. The distinction matters — the first is a win to defend, the second is a gap to consider filling.

## Evidence bar — non-negotiable

Every feature entry — both spine-aligned and target-novel — MUST carry all four evidence fields. If any field cannot be filled, drop the entry's confidence to `low` and mark the legend code `[?]`. Never silently ship a claim without evidence.

1. **Source location** — file path + line range, or URL + section anchor. Must be specific enough that a reader can verify in ≤30 seconds.
2. **Direct quote** — 1–3 line verbatim excerpt from the source (README line, doc paragraph, code comment, commit message). Quote faithfully; do not paraphrase inside the quote block.
3. **Version / commit / fetch date**
   - Repo: git commit SHA (short, 7+ chars) + human-readable version (tag, release, or "default branch @ YYYY-MM-DD").
   - Website: fetch date + Archive.org snapshot URL when available.
4. **Confidence** — `high` / `medium` / `low`.
   - `high` — evidence is direct, unambiguous, and recent.
   - `medium` — evidence implies the feature but doesn't nail every detail.
   - `low` — evidence is indirect (e.g., issue discussion, marketing copy). These entries MUST appear in the target file's `## Needs follow-up` section.

## Coverage strategy — why 100% extraction is a fiction and how we approach it

No single LLM pass can guarantee full feature extraction from a non-trivial repo. The skill approaches completeness through five mechanisms. If any one of them is skipped, misses compound.

1. **Two-pass design.** Pass 1 is spine-driven (walk Risoluto's spine, hunt in target). Pass 2 is target-first (walk the target's own structure and enumerate everything, ignoring spine). Features only found in Pass 2 become `[NEW]`. Skipping Pass 2 is the #1 cause of `[NEW]` under-reporting.

2. **Surface enumeration, not free-form exploration.** Before feature extraction, enumerate every source surface that could reveal a feature, then hit each systematically. The full surface list lives in `references/extraction-methods.md`. At minimum, for repos: README headings, docs/ tree, CHANGELOG, release notes, CLI `--help` for every subcommand, HTTP/GraphQL route tables, OpenAPI/schema files, config schema (env vars + YAML + flags), test `describe`/`it` blocks, public API exports, top 20 production dependencies, issue labels, open-issue titles (≤100).

3. **Parallel subagents per surface.** Spawn one `Explore` subagent per surface type — each returns a structured list of features with evidence. Main agent merges and dedups. A single serial walk will miss things that parallel specialized walks catch.

   **Every subagent prompt MUST include this colgrep command reference** (the project has `colgrep` installed, a semantic code search tool — subagents default to Grep/Glob unless explicitly told otherwise):

   ```
   This project has `colgrep` installed - a semantic code search tool.
   Use `colgrep` (via Bash) as your PRIMARY search tool instead of Grep/Glob.

   COLGREP COMMANDS:
   - Semantic search:      colgrep "error handling" -k 10
   - Regex + semantic:     colgrep -e "fn.*test" "unit tests"
   - Pattern only:         colgrep -e "async fn"
   - Search in path:       colgrep "query" ./src/api
   - Filter by type:       colgrep --include="*.rs" "query"
   - Multiple types:       colgrep --include="*.{ts,tsx}" "query"
   - List files only:      colgrep -l "query"
   - Exclude tests:        colgrep --exclude="*_test.go" "query"
   - Whole word:           colgrep -e "test" -w "testing"

   COLGREP BEHAVIOR:
   - First query may take 30-90 seconds (model loading + index building); subsequent queries are <5 seconds
   - NEVER run colgrep in background mode — wait for the result
   - NEVER fall back to Grep/Glob while colgrep is running
   - If colgrep returns no results, try broader semantic terms or regex-only mode

   DO NOT use Grep or Glob tools — use colgrep via Bash instead.
   ```

   Paste that verbatim into every surface-subagent prompt. Without it, subagents default to Grep and miss semantic matches.

4. **Coverage manifest as a first-class output.** Every target file ends with `## Coverage manifest`: a table of every surface scanned (with file count / byte size / fetch status) and every surface skipped (with reason — "private", "404", "paywalled", "too-large-for-single-pass"). Under-coverage becomes visible and you can re-run with targeted refreshes.

5. **Inversion test for `[R!]`.** Never mark a spine item `[R!]` from silence. The skill must actively search the target (record grep queries, docs pages read, etc.) and note what was searched before concluding absence. Silence + no search = `[?]`, not `[R!]`.

Treat these as hard requirements. If any mechanism is skipped or impossible (e.g., subagents unavailable in the environment), say so explicitly in the report so the user can calibrate trust in the result.

## Workflow

### 1) Detect input type and resolve the source

Branch on the URL:

- Looks like `github.com/<org>/<repo>`: treat as GitHub repo.
- Anything else with a hostname: treat as website.
- Absolute path on disk that is a git repo: treat as pre-cloned local repo.

For **GitHub repos**, clone shallowly into a scratch dir:

```bash
mkdir -p /tmp/risoluto-research
git clone --depth 1 <repo-url> /tmp/risoluto-research/<slug>
# Capture commit + tag for the evidence block:
( cd /tmp/risoluto-research/<slug> && git rev-parse --short HEAD && git describe --tags --always )
```

If the user pinned a version, use `--branch <tag>` or fetch and checkout the tag explicitly.

For **websites**, do a depth-limited crawl starting from the URL:

- Fetch the landing page.
- Follow links matching: `/features`, `/pricing`, `/docs*`, `/changelog*`, `/blog*`, `/product*`, `/roadmap*`, `/compare*`, `/security*`.
- Cap at ~15 pages. Prefer `defuddle` for clean markdown extraction; fall back to `WebFetch` per page.
- If the site links to a GitHub repo, also pull that repo's README + CHANGELOG (not a full clone).
- Record the fetch date on every evidence line.

**Delegate this step to an `Explore` subagent when the target is large** — you don't want the crawl or the clone's tree walking to pollute the main context. Instruct the subagent to return a structured brief listing surfaces it found (docs pages, README sections, top-level code directories) rather than raw dumps. Tell it to use `colgrep` as its primary search tool.

### 2) Load and normalize the spine

Read `research/RISOLUTO_FEATURES.md`. Parse it into a flat list of spine entries. The spine format is user-controlled, so be tolerant — expect headings at `##` or `###` level with a short description under each. Capture:

- `spine_id` — a stable identifier (use the heading slug if present, otherwise the lowercased heading text).
- `title` — the human-readable feature name.
- `description` — whatever sits under the heading, trimmed.

If the spine is very large (>200 entries), skim it and group entries by the top-level section headings so you can triage which sections the target is likely to touch before going feature-by-feature.

### 3) Align target → spine

For each spine entry, go hunt in the target's extracted material (README, docs, code, changelog). For each feature, you are asking two questions:

1. Does the target have this feature at all?
2. If yes, is their implementation weaker, comparable, or stronger than Risoluto's?

Output exactly one `[=]` / `[R+]` / `[T+]` / `[R!]` / `[?]` per spine entry. Fill the full record (see template below). A spine entry with zero signal in the target is `[R!]` — but only after you've actually searched. A spine entry with partial-but-unclear signal is `[?]`, not `[R!]` — the difference matters for roadmap decisions.

### 4) Discover target-novel features

Now walk the target's own surface with fresh eyes — not cross-referenced to the spine. Look for capabilities the target documents or implements that don't appear anywhere in the spine. Each one becomes a `[NEW]` entry. These are the single most valuable outputs of this skill because they expand the question space for the roadmap.

Be aggressive here. "They have CLI completion and we don't" counts. "They expose a Prometheus histogram for X and we only have a counter" counts. Every observable difference that isn't already on the spine is potentially `[NEW]`.

### 5) Write the per-target file

Use the template in `references/template-target.md` verbatim as the skeleton, then fill every section. Key rules:

- One heading per feature (spine-aligned features under `## Spine alignment`, novel features under `## Target-novel features`).
- The observable-behaviors list is not optional. If you can't list at least 2 observable behaviors, the entry isn't detailed enough yet — go dig further.
- The comparison-vs-Risoluto field must name the specific Risoluto surface you're comparing against (e.g., `src/orchestrator/worker-launcher.ts` or "the webhook health panel at `/settings`"), not generic hand-waving.

### 6) Flag candidate signal (do NOT draft roadmap)

Roadmap synthesis is deliberately deferred until the corpus has ~10–15 targets. A `[T+]` seen in one target is weak signal; the same `[T+]` seen across many targets is strong signal. Per-target roadmap drafting biases toward whichever target was analyzed first and produces noise.

Instead, add a lightweight `## Candidate flags` section at the bottom of the per-target file. One line per `[T+]` and `[NEW]` entry:

```markdown
## Candidate flags

Light triage signal. Not a roadmap. Roadmap synthesis happens in a separate skill once the research corpus is large enough (~10–15 targets). Do NOT draft effort estimates, bundle assignments, or Risoluto touch points here.

- **<title>** (`[T+]` | `[NEW]`) — signal: **interesting** | **noise** | **out-of-scope** — <1 sentence on why>
```

Flags map as follows:

- **interesting** — worth remembering for future cross-target synthesis. The feature solves a real user problem that maps to Risoluto's positioning.
- **noise** — the target does this because of their specific architecture/stack; adopting it would be cargo-culting. Low signal for Risoluto.
- **out-of-scope** — clearly outside Risoluto's problem space (e.g., a GUI-only feature when Risoluto is headless; billing for a SaaS when Risoluto is local-first).

Do not filter by signal at this stage — record all entries. The synthesis skill will weight signals across the corpus.

### 7) Update INDEX.md

Read the current `research/INDEX.md`. Update or insert the row for this target. The index uses the template in `references/template-index.md`. It's essentially a matrix: rows = targets, columns = spine-section groupings, cells = counts of each legend code for that target × section.

Do not rewrite the whole INDEX from scratch on every run — this is an append/update operation, and destructive rewrites will corrupt prior runs.

### 8) Report back to the user

Produce a short report (≤150 words) covering:

- File(s) written, with paths.
- Legend-code totals (e.g., "⚖️ 12 · 🟢 4 · 🔴 7 · ⭐ 3 · ✨ 9 · ❓ 2").
- Top 3 roadmap candidates, one line each.
- Any `low`-confidence entries that went into `## Needs follow-up`.
- Anything the skill could not verify (e.g., paywalled docs, dead links, repos too large to crawl in one pass).

## Quality self-check before declaring done

Before you claim the ledger is written, verify:

- [ ] `research/<slug>.md` exists and parses as valid Markdown.
- [ ] Every legend entry has all four evidence fields populated (source, quote, version/date, confidence).
- [ ] `## Coverage manifest` is populated with every surface attempted AND every surface skipped-with-reason.
- [ ] Every `[R!]` entry has a `Searched for:` line listing ≥3 distinct search attempts (the inversion test). `[R!]` with no searches recorded = downgrade to `[?]`.
- [ ] `## Target-novel features` is non-empty for a non-trivial target. If it IS empty, you almost certainly under-explored — re-run Pass 2 before shipping.
- [ ] `research/INDEX.md` was updated in place (row parsed, row updated/appended) — NOT destructively rewritten.
- [ ] No spine entry is silently dropped — each one gets a code or an explicit `[?]` with explanation.
- [ ] Evidence links are specific (file:line or URL#anchor), not just a repo-root URL.
- [ ] `## Candidate flags` section lists every `[T+]` and `[NEW]` with a single-line signal tag (`interesting` / `noise` / `out-of-scope`). No effort estimates, no bundle assignments, no Risoluto touch points — that synthesis is deferred.
- [ ] Run history row appended to the per-target file (spine SHA + target SHA + delta from previous run).

Treat this checklist as a hard gate. If any box can't be ticked, say so in the report instead of declaring success.

## Reference files

For the exact shape of the per-target and index files, see:

- `references/template-target.md` — full template for `<slug>.md`, with every section, field, and example.
- `references/template-index.md` — INDEX.md row format and legend-totals aggregation.
- `references/extraction-methods.md` — detailed guidance on clone/crawl strategies, when to delegate to subagents, and how to handle large or weird targets (paywalled docs, monorepos, DX-heavy repos that hide features in `examples/`).
