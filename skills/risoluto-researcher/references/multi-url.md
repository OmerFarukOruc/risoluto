# Multi-URL fan-out

The skill accepts one or more URLs in a single invocation and processes them in parallel. This file documents the parse → filter → queue → spawn → merge sequence and the skip-on-collision policy.

## Argument shape

URLs are whitespace- or newline-separated. No prefixes, no flags per URL — type detection is automatic.

```
/risoluto-researcher https://github.com/All-Hands-AI/OpenHands
/risoluto-researcher https://github.com/A/B https://github.com/C/D https://blog.example.com/post
/risoluto-researcher \
  https://github.com/A/B \
  https://github.com/C/D
/risoluto-researcher --refresh https://github.com/A/B https://github.com/C/D
```

The single optional flag is `--refresh`. It applies to **every URL listed after it on the same invocation**. To refresh some URLs but not others, run two invocations.

## Step 1 — parse

Tokenize the args by whitespace and newlines. For each non-flag token:

- If it matches `^https?://github\.com/[^/]+/[^/]+/?$` → `target_type=repo`.
- Else if it matches `^https?://[^/]+(/.*)?$` → `target_type=website`.
- Else → parse error. Stop and surface the offending token; do not partially proceed.

Compute the `slug` per the rules in `SKILL.md` § "Slug rules". If two URLs in the same invocation produce the same slug, append `-v2`, `-v3` to the second and surface a warning — this usually means the user passed the same target twice, but a v2 path keeps the run safe.

Record per URL:

```json
{
  "url": "https://github.com/All-Hands-AI/OpenHands",
  "target_type": "repo",
  "slug": "all-hands-ai-openhands",
  "refresh": false
}
```

## Step 2 — filter against the ledger

Read `research/INDEX.md`. For each URL:

1. Look up `slug` in `## Targets`.
2. If found AND `refresh: false` → mark `mode: skip`. Log to the operator: `<slug> already researched on <captured> at <revision>. Skipping. Pass --refresh <url> to re-run.`
3. If found AND `refresh: true` → mark `mode: refresh`.
4. If not found → mark `mode: new`.

After the filter, partition the URLs into `to_run = [new + refresh]` and `to_skip`. If `to_run` is empty, exit cleanly with a one-line summary listing the skipped URLs and the suggestion to pass `--refresh`. Do not spawn any subagents.

## Step 3 — queue and spawn

Spawn up to **5 parent subagents in parallel** in a single assistant message (multiple `Agent` tool uses in one turn). Queue the rest. As each parent completes, dequeue the next and spawn it.

Why 5: it matches the operator's existing concurrency cap for parallel workers. Going higher has been observed to crash at 15 (per operator memory). Each parent itself fans out internally to up to 5 Pass 2 children, so worst-case total in flight is 25 nested. If a run wobbles, dial children to 3 in `two-pass.md` and re-run.

Each parent's prompt must include:

- The URL it's researching.
- The slug.
- The target type (repo or website).
- Whether this is a `new` or `refresh` run.
- The full per-target workflow from `SKILL.md` § "Workflow" steps 4–8.
- The colgrep reminder block from `extraction-methods.md` § "Subagent prompt template".

Parents do NOT share context. Each operates independently and writes to its own `targets/<slug>.md`. The orchestrator (this skill, in the calling agent) is responsible for the ledger update.

## Step 4 — handle parent results

Each parent returns a structured payload:

```json
{
  "slug": "all-hands-ai-openhands",
  "url": "https://github.com/All-Hands-AI/OpenHands",
  "type": "repo",
  "revision": "a3f2c1e",
  "fetched_at": "2026-04-30",
  "behavior_count": 297,
  "artifact_path": "research/targets/all-hands-ai-openhands.md",
  "status": "researched",
  "duration_seconds": 612,
  "failure_reason": null
}
```

If the parent crashed or timed out, the structured payload is missing — the calling agent records the URL with `status: failed` and the failure reason captured from the agent tool's error.

## Step 5 — atomic ledger update

After ALL parents (in this batch) return — including queued ones that complete later — update `research/INDEX.md` once:

1. For each parent result with `status: researched`: append a row to `## Targets`.
2. For each parent result with `status: refreshed`: update the existing row in place — flip status, bump revision, bump captured, recompute features.
3. For each parent result with `status: failed`: append a row with `revision: -`, `features: 0`, `artifact: -`, `status: failed`. Append a footnote to `## Failure footnotes`.
4. Append one row to `## Run history` covering all URLs in this invocation:

```
| 2026-04-30 | https://github.com/A/B, https://github.com/C/D | 2 researched, 0 refreshed, 0 skipped, 0 failed |
```

Do the update as a single atomic write — never destructively rewrite the file. Use Edit to insert/replace specific rows. The in-place update contract is enforced in `template-index.md` § "Update rules".

## Step 6 — final report

Report back per `SKILL.md` § "Workflow" step 9. The report aggregates across all URLs in this invocation, including skipped and failed.

## Concurrency behavior in detail

- **Parents in flight:** at most 5. The 6th URL's parent doesn't start until one of the first 5 completes.
- **Children per parent:** at most 5. Fan-out is internal to each parent; children inherit no awareness of other parents.
- **Worst-case nested:** 25 total. This is acceptable but worth watching. If transcripts show timeouts or token exhaustion, dial children to 3 — see `two-pass.md` § "Adjusting concurrency".
- **No cross-parent dependencies.** A parent never waits on another parent. The ledger update is the only synchronization point, and it happens after all parents in this batch return.

## What multi-URL does NOT do

- It does **not** synthesize across URLs in a single run. The harmonization skill (future) reads the corpus afterward.
- It does **not** rebuild the ledger from scratch. Always in-place updates.
- It does **not** do any spine alignment, feature comparison, or roadmap drafting.
- It does **not** unshallow clones across URLs to make them comparable. Each clone is independent.
