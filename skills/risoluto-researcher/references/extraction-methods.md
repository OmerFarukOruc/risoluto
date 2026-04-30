# Extraction methods — how to actually hit every surface

The whole skill depends on this file. If you skip surfaces, the behavior list will be artificially short and the coverage manifest will misrepresent reality. Treat this as a checklist, not a suggestion.

## Contents

- [The surface matrix](#the-surface-matrix)
- [For a GitHub repository](#for-a-github-repository)
- [For a blog post or product website](#for-a-blog-post-or-product-website)
- [For a hybrid target (website + linked repo)](#for-a-hybrid-target-website--linked-repo)
- [Subagent prompt template — paste verbatim](#subagent-prompt-template--paste-verbatim)
- [When to stop](#when-to-stop)
- [Hard cases](#hard-cases)

## The surface matrix

Behaviors reveal themselves at different surfaces. Each surface has a different signal shape. Hit all of them or accept a lower coverage score.

| Surface | Signal | Coverage gain when hit | Cost |
|---------|--------|------------------------|------|
| README | Top-level capabilities | High (breadth) | Low |
| docs/ tree | Behavior details + rules/limits | Very high | Medium |
| CHANGELOG / release notes | Every shipped behavior with date | Very high | Low–medium |
| CLI `--help` / subcommands | Every user-facing command and flag | High | Low once binary runs |
| HTTP/RPC route tables | Every API the product exposes | High | Medium |
| OpenAPI / GraphQL schema files | Complete API contract | Very high | Low if present |
| Config schema (env, YAML, flags) | Every operator-tunable behavior | High | Medium |
| Test `describe`/`it` blocks | Behaviors enumerated in natural language | High | Low |
| Public package exports | Library-level behaviors | Medium | Medium |
| Top production deps | Capability signals (e.g., `stripe` → billing) | Medium | Low |
| Issue labels + open issue titles (≤100) | Roadmap + known gaps | Medium | Low |
| Example / demo directories | Real usage patterns | Medium | Medium |
| CI workflow files | Quality gates + delivery mechanisms | Low–medium | Low |
| Security / trust docs | Sandbox + auth behavior | Medium | Low |
| Pricing page (websites only) | Tier-specific behaviors | High for websites | Low |

## For a GitHub repository

Run these in the listed order. Don't skip ahead — signals from earlier steps inform how aggressively to dig in later steps.

### Step 1 — Clone or update the persistent cache

The skill maintains clones at `research/.cache/clones/<slug>/`, gitignored at the submodule level (see `clone-cache.md`). Reuse if present, otherwise shallow-clone:

```bash
mkdir -p research/.cache/clones

# Detect the default branch first — NOT every repo uses `main`.
# Real-world examples seen in the corpus: `master` (langchain), `dev` (oh-my-openagent), `main` (most others).
# Never assume — always read the value from the API.
DEFAULT_BRANCH=$(gh repo view <owner>/<repo> --json defaultBranchRef --jq '.defaultBranchRef.name')

if [ -d research/.cache/clones/<slug>/.git ]; then
  git -C research/.cache/clones/<slug> fetch --depth 1 origin "$DEFAULT_BRANCH"
  git -C research/.cache/clones/<slug> reset --hard "origin/$DEFAULT_BRANCH"
else
  git clone --depth 1 --branch "$DEFAULT_BRANCH" <repo-url> research/.cache/clones/<slug>
fi

# Capture revision evidence:
git -C research/.cache/clones/<slug> rev-parse --short HEAD
git -C research/.cache/clones/<slug> describe --tags --always
```

If the user pinned a version / tag / SHA, fetch that explicitly with `--branch <tag-or-sha>`.

**Defensive rules:**

- On `gh repo view` HTTP 404/403: log, mark `failed`, write a row to INDEX.md with the reason, continue with the next URL.
- On HTTP 429 (rate limit) from `gh api`: wait 60 seconds, retry once. If still blocked, note the gap in the artifact's coverage manifest and proceed with what you have.
- If `git clone --depth 1` fails (transient network), retry once after a 5s sleep. If it fails again, mark `failed` and continue.

### Step 1.5 — Early-exit heuristics (dead repos)

Before committing to a full extraction, check repo health. Dead or skeletal repos are expensive to analyze and rarely yield useful signal. Exit early and record the reason.

```bash
gh repo view <owner>/<repo> --json isArchived,pushedAt,stargazerCount,defaultBranchRef
git -C research/.cache/clones/<slug> log --oneline | wc -l
find research/.cache/clones/<slug> -type f \( -name '*.ts' -o -name '*.py' -o -name '*.go' -o -name '*.rs' -o -name '*.js' -o -name '*.ex' \) | wc -l
```

Skip — record reason in coverage manifest + summary — if:

- `isArchived: true` — target is frozen upstream.
- Last push >18 months ago AND fewer than ~5 commits in the last year — effectively dormant.
- <5 commits total — too early to have a real behavior surface.
- <10 source files (excluding lockfiles, generated, vendor dirs) — not a meaningful codebase.

Dormant-but-once-interesting repos are still worth a *shallow* pass — adopting ideas from them is fine since there's no direction to copy. But allocate ~20% of the coverage budget, not the full extraction.

### Step 1.6 — Repo health snapshot

Record these in the artifact's source manifest so the reader knows how to weight findings:

- **last_upstream_commit:** YYYY-MM-DD by author (from `git log -1 --format='%cI %an'`)
- **stars:** N (from `gh repo view --json stargazerCount`)
- **commits_in_last_90d:** N (from `git log --since=90.days.ago --oneline | wc -l`)
- **primary_languages:** top 1–2 (from `gh repo view --json languages`)
- **repo_health:** active / dormant / archived — 1 sentence justification.

### Step 2 — Read top-level signals in a single Pass 1 read

This is the broad-map pass. The Pass 1 subagent does NOT enumerate behaviors here — it just records what surfaces exist and what's roughly there. See `two-pass.md` for the surface inventory format.

- `README.md` — note the headings, count them.
- `CHANGELOG.md` / `HISTORY.md` / `docs/RELEASES.md` — note recency and entry density.
- `docs/` — record file count and top-level sections.
- `ROADMAP.md` / `docs/roadmap*` — flag for `in-flight` status hints.
- `SECURITY.md`, `TRUST.md` — sandbox + auth signals.
- `package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml` — top dependency list.

### Step 3 — Map the entry points (Pass 2: CLI surface)

- `bin/`, `cmd/`, `cli/`, `scripts/` — every binary is a surface. For each, capture `--help` output, either by reading source or (if installable without risk) by running `<binary> --help` in the cloned tree.
- `main.py` / `index.ts` / `cmd/*/main.go` — single-binary entry points.

### Step 4 — Map the service surface (Pass 2: HTTP/RPC API)

- Find HTTP router files: look for `app.get`, `router.post`, `@app.route`, `handler: func`, or framework-specific route declarations. List every route with verb + path + short description.
- If an OpenAPI file exists (`openapi.yaml`, `swagger.json`): parse and list every operation.
- If GraphQL schema files exist: list every Query, Mutation, Subscription.
- If a JSON-RPC surface exists: list every method name.

### Step 5 — Map the config surface (Pass 2: Config surface)

- Find config schema files: `config.schema.json`, `defaults.yaml`, `*.env.example`, `settings.py` with Pydantic, etc.
- List every env var referenced in code via `process.env.*`, `os.getenv`, `std::env::var`.
- List every command-line flag from the CLI entry.
- Every config key is a behavior — the behavior that key enables.

### Step 6 — Mine the tests (Pass 2: Tests)

- `tests/`, `__tests__/`, `*_test.go`, `spec/` — `colgrep` for `describe(`, `it(`, `test(`, `func Test`.
- Test names are usually phrased as "it <does a thing>" — gold for behavior-level signal.

### Step 7 — Skim the issue tracker (Pass 2: Issues)

- `gh issue list --repo <org>/<repo> --state all --label "enhancement" --limit 100` — recent feature work.
- `gh issue list --repo <org>/<repo> --state closed --limit 50` — recently shipped.
- `gh label list --repo <org>/<repo>` — labels are often a de-facto behavior taxonomy.

### Step 8 — Review CI and release machinery (Pass 2: CI workflows)

- `.github/workflows/` — CI gates reveal what the project enforces. These are often behaviors themselves (security scans, type-coverage, perf budgets).
- Release workflow — reveals artifact types shipped (Docker image, npm package, etc.).

### Step 9 — Examples / demos (Pass 2: Examples)

- `examples/`, `demo/`, `sample/` — real usage patterns. These sometimes surface behaviors not mentioned in docs (e.g., an experimental plugin used in an example).

## For a blog post or product website

Start from the given URL and (for sites) crawl depth-limited. For a single blog post, fetch only that page plus any directly linked subpages explicitly named in the post (e.g. an architecture doc the post links to). For a product website, target ~15 pages, prioritizing in this order:

1. Landing page.
2. `/features` or `/product`.
3. `/docs`, `/docs/*` (at least the table of contents and the major sections).
4. `/changelog`, `/releases`, `/updates`.
5. `/pricing` — tier-specific features are real behaviors, not just commercial noise.
6. `/security`, `/trust`, `/compliance`.
7. `/blog` — recent posts (last 6 months). Product launches often appear in blog posts before docs.
8. `/compare` / `/vs-<competitor>` — explicit feature comparisons (high signal per page).
9. `/roadmap` / `/planned` — `in-flight` status candidates.
10. `/api` / API docs subdomain.

Use `defuddle` (primary) for clean markdown extraction. Fall back to `WebFetch` if defuddle fails. For interactive / heavily-scripted pages where content is rendered client-side, use `agent-browser`.

If the site links to a GitHub repo in its footer or docs, run the repo extraction too — code reveals things marketing copy won't. The hybrid case is below.

For each page fetched, record: URL, fetch timestamp, HTTP status, and — if available — `Last-Modified` header or `Archive.org` snapshot URL.

For blog posts and websites, the artifact's revision is `sha256:<first-12-hex-chars>` of the rendered markdown of the primary URL. This is fragile to minor edits (typo fixes change the hash); that's acceptable. Future work could move to a fuzzy hash.

## For a hybrid target (website + linked repo)

Run both. Merge behaviors. If a behavior appears in both sources, the evidence block cites both, and confidence rises to `high`. If a behavior appears only in marketing copy (website) but not in the repo, note "marketing claim not verified in source" in the description and drop confidence to `medium` or `low`.

## Subagent prompt template — paste verbatim

Every Pass 1 reader and every Pass 2 surface subagent must include this block in its prompt. The colgrep reminder is the load-bearing part — without it, subagents default to Grep/Glob and miss semantic matches.

```
You are investigating surface <surface-name> for target <target-slug>.

Input: local clone at research/.cache/clones/<slug>/ OR website root at <url>.

Your job: enumerate every observable behavior this surface reveals. For each behavior, return:
- behavior-id (slug-like, e.g. cli-flag-verbose)
- one-line description
- evidence: source location (file:line or url#anchor)
- direct quote (1–3 lines from source)
- confidence (high | medium | low)
- status (shipped | in-flight | experimental | deprecated) — only when discoverable

Do NOT compare to Risoluto. Do NOT use legend codes like [R+], [T+], [R!], [=], [NEW], [?]. Do NOT include a "Comparison vs" field. Just describe what the target does, on this surface, with evidence. Cross-target comparison happens in a separate harmonization step that you are not part of.

This project has `colgrep` installed — a semantic code search tool.
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
- First query may take 30-90 seconds (model loading + index building); subsequent queries are <5 seconds.
- NEVER run colgrep in background mode — wait for the result.
- NEVER fall back to Grep/Glob while colgrep is running.
- If colgrep returns no results, try broader semantic terms or regex-only mode.

DO NOT use Grep or Glob tools — use colgrep via Bash instead.

Do not recommend or implement changes — this is read-only research.
Return a structured Markdown report under 500 lines. If your surface has more than ~80 behaviors, group them into sub-tables by sub-area (e.g., per-subcommand for CLI, per-route-prefix for HTTP).
```

## When to stop

Stop a surface-hunt when one of these is true:

- You've hit every item on that surface's checklist.
- You've hit diminishing returns — three consecutive pages/files reveal no new behaviors.
- The surface is not present in this target (e.g., no CLI because it's a pure library — record "no CLI surface" in the coverage manifest and move on).

Do NOT stop because the total behavior count feels "enough." The goal is to enumerate, not to shortlist. Shortlisting happens in the future harmonization skill.

## Hard cases

### Monorepo with many sub-packages

Detection — Pass 1 must check for monorepo signals before deciding the surface inventory:

- `lerna.json`, `pnpm-workspace.yaml`, `nx.json`, `turbo.json` (JS/TS workspaces)
- `[workspace]` block in a top-level `Cargo.toml` (Rust workspace)
- `pyproject.toml` with multiple subdirectory `pyproject.toml` files (Python workspace)
- A top-level `libs/`, `packages/`, `apps/`, or `crates/` directory containing 3+ sub-packages each with their own manifest

When a monorepo is detected, the **default** is still one artifact per top-level URL — but Pass 1's Module map must enumerate every sub-package as its own bullet, and Pass 2 must spawn one child per sub-package (in addition to the cross-cutting surfaces like docs/changelog/issues). Sub-package children own their own CLI/API/config sub-trees.

Real example: langchain's `libs/langchain`, `libs/core`, `libs/experimental`, `libs/community`, plus the integrations/ tree. Each is a Pass 2 sub-package child. Total Pass 2 children: ~5 cross-cutting surfaces + 5–10 sub-package children = 10–15 children. Cap respects the parent's children-cap (default 5; queue the rest).

If the operator instead wants each sub-package as its own ledger entry (so `targets/langchain-core.md` and `targets/langchain-experimental.md` exist as separate rows in INDEX.md), they pass each sub-package URL explicitly — e.g., `https://github.com/langchain-ai/langchain/tree/master/libs/core`. The skill detects the `tree/<branch>/<path>` form and treats each as its own target.

### Academic / training material noise

Some repos contain heavy non-source content that's not "behavior" — research papers, datasets, training fixtures, generated documentation. Detect at Pass 1:

- `.tex`, `.bib`, `.bbl`, `.pdf` files larger than 10 KB
- A `datasets/`, `data/`, `fixtures/`, `corpus/`, or `paper/` directory >50 MB
- Generated docs under `_build/`, `site/`, `dist-docs/`

These are recorded in the source manifest as "academic content present (X TeX files, Y MB datasets/)" but **not enumerated as behaviors**. The Pass 2 children skip them. The coverage manifest gets a `skipped` row with reason "academic content — not a behavior surface."

Real example: NousResearch/hermes-agent ships 434 KB of TeX + 156 KB of BibTeX style files. Treat as documentation context (record presence in summary); do not extract LaTeX-author names, citation BibKeys, or paragraph counts as behaviors.

### Mintlify / Docusaurus / MkDocs detection

Modern docs sites use generators that put markdown in non-standard locations:

- **Mintlify** — look for `mint.json`, `docs.json`, or a `docs/` tree with `.mdx` files. Surface scope: `docs/**/*.{md,mdx}` plus `mint.json` for the navigation taxonomy.
- **Docusaurus** — look for `docusaurus.config.js` or `docusaurus.config.ts`. Surface scope: `docs/**/*.{md,mdx}` plus `sidebars.js` for the navigation taxonomy.
- **MkDocs / MkDocs-Material** — look for `mkdocs.yml`. Surface scope: as configured in the YAML's `docs_dir`.
- **Astro Starlight** — look for `astro.config.mjs` with `@astrojs/starlight`. Surface scope: `src/content/docs/**/*.{md,mdx}`.

Generic `.md` and `.mdx` files outside any of these structures still count — fall back to a recursive scan from the repo root excluding `node_modules/`, `vendor/`, generated dirs.

Real examples: bytedance/deer-flow ships 275 KB of MDX (Mintlify-shaped). letta-ai/letta likely has a `docs/` Mintlify site. Recognize the generator and read its config to know which `docs_dir` to enumerate.

### Multi-language repo (Module map differentiation)

When the repo has 2+ languages each over ~10% of total source size, the Module map surface needs sub-bullets explaining where each language's responsibility lives:

- For each top-level language, identify: where the entry point is, what subsystem it owns, what it talks to.
- Common shapes: Rust backend + TS frontend (vibe-kanban). Python core + JS/TS SDK (letta). Go control plane + Python agents (less common).

Pass 1 Module map example for vibe-kanban:

```
- **Module map** — multi-language: Rust backend at `backend/` (3.7 MB), TS frontend at `frontend/` (3.4 MB), PostgreSQL schema at `migrations/` (PLpgSQL).
  - Rust: `backend/` — HTTP server, agent orchestration, DB layer.
  - TS: `frontend/` — kanban UI, real-time updates.
  - SQL: `migrations/*.sql` — schema + stored procedures.
```

Pass 2 then spawns one child per language module on top of the cross-cutting children. The children search within their language's tree using `colgrep --include="*.{rs,toml}"` or equivalent.

### Paywalled or login-required docs

Fetch what's public. Mark the paywalled pages `failed` in the coverage manifest with reason "requires login to <site>". For behaviors visible only behind auth, surface in `## Needs follow-up` rather than guessing.

### Giant codebases that don't fit in context

Delegate completely to surface-specific Pass 2 subagents — never load the full tree into the parent agent. Use `colgrep` queries with progressive narrowing. If a single surface (e.g., "the entire docs/ tree") is too big for one Pass 2 subagent, split it by sub-directory and merge the children's outputs.

### Closed-source targets where only the website exists

Run the website extraction. Cap behavior confidence at `medium` per the website-only rule in `legend.md`. Be aggressive about flagging items in `## Needs follow-up` — absence of source makes claims harder to verify.

### Very stale repos

If the most recent commit is >12 months old, set `repo_health: dormant` and note the reason in the summary. Evidence is still valid but the project may be dormant — reflect that in any future harmonization step (adopting a dormant target's idea is often fine; copying their recent direction is not possible because there is none).

### Target uses a very different stack

Do not downgrade behaviors because "their Erlang implementation isn't comparable to our TypeScript." Behaviors are observable rules, not implementations. Judge what the behavior does, not what language it's in. Runtime-specific behaviors (e.g., Erlang's OTP supervision tree shape) are still behaviors — record them. Whether they translate to Risoluto is the harmonization skill's problem.
