# Clone cache contract

The skill maintains a persistent local cache of repo clones at `research/.cache/clones/<slug>/`. It is gitignored at the submodule level, never committed, and never auto-purged. This file documents the contract.

## Why persistent (not /tmp)

Earlier versions cloned into `/tmp/risoluto-research/<slug>/` and discarded the clone after every run. That worked but had two costs:

1. **Re-cloning is slow** when an operator wants to re-inspect a target by hand (e.g., to verify a behavior the artifact recorded). Persistent clones make ad-hoc inspection cheap.
2. **`--refresh` runs always pay the full clone cost.** Even when the upstream hasn't moved, the next research run starts from nothing. With a persistent cache, `--refresh` becomes a fetch + reset, not a fresh clone.

The trade-off is disk usage. Each `--depth 1` clone is typically 50–300 MB for a small/medium agent project. Mega-monorepos (langchain, agno) can exceed 500 MB even at depth=1 because of vendored notebooks, generated docs, and embedded fixtures. With ~20 targets in the corpus, expect 5–20 GB cumulative depending on mix. If that's a problem, manual cleanup is fine — the skill re-clones on next demand.

## Layout

```
research/.cache/
└── clones/
    ├── all-hands-ai-openhands/
    │   ├── .git/           (shallow, depth=1)
    │   ├── README.md
    │   ├── src/
    │   └── ...
    ├── sourcegraph-amp/
    │   └── ...
    └── ...
```

Path: `research/.cache/clones/<slug>/`.

The submodule's `.gitignore` contains `.cache/`, so nothing under `.cache/` is ever staged or committed. Verify with `git -C research check-ignore .cache/clones/example/`.

## Lifecycle

### First research run

```bash
mkdir -p research/.cache/clones
DEFAULT_BRANCH=$(gh repo view <owner>/<repo> --json defaultBranchRef --jq '.defaultBranchRef.name')
git clone --depth 1 --branch "$DEFAULT_BRANCH" <repo-url> research/.cache/clones/<slug>
```

Capture revision:

```bash
REVISION=$(git -C research/.cache/clones/<slug> rev-parse --short HEAD)
```

Write `REVISION` into the artifact's source manifest as the `revision` field.

### Subsequent runs (skip path)

If `<slug>` is already in `INDEX.md` and `--refresh` was not passed, the skill skips this URL entirely — the clone is irrelevant; nothing fetches.

### Subsequent runs (--refresh path)

Reuse the existing clone:

```bash
if [ -d research/.cache/clones/<slug>/.git ]; then
  git -C research/.cache/clones/<slug> fetch --depth 1 origin "$DEFAULT_BRANCH"
  git -C research/.cache/clones/<slug> reset --hard "origin/$DEFAULT_BRANCH"
else
  # Cache was manually cleaned; re-clone.
  git clone --depth 1 --branch "$DEFAULT_BRANCH" <repo-url> research/.cache/clones/<slug>
fi
REVISION=$(git -C research/.cache/clones/<slug> rev-parse --short HEAD)
```

Append a Run history row to the artifact and update the INDEX row in place per `template-index.md` § "Update rules" rule 3.

### Manual cleanup

Operator removes a single clone:

```bash
rm -rf research/.cache/clones/<slug>
```

Or all clones:

```bash
rm -rf research/.cache/clones
```

The skill never auto-purges. Re-runs simply re-clone if the directory is missing.

## When to unshallow

The default clone is `--depth 1` — only the latest commit. This is sufficient for behavior extraction. Unshallow only when:

- The user explicitly asks for historical analysis (e.g., "when was this behavior introduced?").
- A Pass 2 surface needs `git log` analysis (rare — the skill does not currently rely on git history for any behavior).

To unshallow:

```bash
git -C research/.cache/clones/<slug> fetch --unshallow
```

This is a one-way operation in practice — the skill doesn't re-shallow afterward. If disk becomes an issue, manual cleanup + re-shallow is fine.

## Blog posts and websites

Web targets do not produce a clone. The fetched markdown is computed in-memory by the Pass 1 / Pass 2 subagents and written to `<artifact>.md` directly. The revision is `sha256:<first-12-hex-chars>` of the rendered markdown.

There is no `research/.cache/web/` cache today. If the same blog post is fetched twice (e.g., one researcher runs it, then another researcher re-runs with `--refresh`), each run does a fresh fetch. Acceptable today; future work could add a fetched-markdown cache keyed by URL.

## Concurrency

Multiple parent subagents may write to different `research/.cache/clones/<slug>/` directories simultaneously — safe, since each owns a unique slug. The only contention point is the parent shell creating `research/.cache/clones/` if it doesn't exist; `mkdir -p` is idempotent.

Two simultaneous `--refresh` runs against the same slug would race on the clone reset. The skill does not currently lock — if the operator hits this case, ask them to serialize the two runs. In practice, `--refresh` is rare and operator-driven, so the race window is small.

## Anti-patterns

- ❌ Cloning to a path outside `research/.cache/clones/`. The cache contract assumes one canonical location.
- ❌ Committing `.cache/`. The submodule's `.gitignore` should be checked before any submodule commit. If `.cache/clones/` ever ends up staged, something went wrong.
- ❌ Using `--mirror` or full-history clones by default. The behavior surface doesn't need history; full clones balloon disk for no signal.
- ❌ Re-cloning every run instead of fetch+reset. Wastes bandwidth and time. Reuse the existing directory.
