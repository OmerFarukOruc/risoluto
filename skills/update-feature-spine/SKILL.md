---
name: update-feature-spine
description: Explicit-invocation only. Updates `research/RISOLUTO_FEATURES.md` surgically after a merged PR on `main` and opens a spine PR in the private `research/` submodule. Does NOT auto-trigger on natural-language prompts — invoke via the `/update-feature-spine` slash command, by explicitly naming the skill ("use update-feature-spine for PR #400"), or from a Claude Code routine that passes a GitHub `pull_request.closed` + `merged: true` event payload.
allowed-tools: Bash, Read, Edit, Grep, Agent
---

# Update Feature Spine (per merged PR)

Surgical, incremental maintenance of Risoluto's canonical feature spine at
`research/RISOLUTO_FEATURES.md` (private submodule). Run once per merged PR on
`main`. Opens a spine PR in the `research/` submodule — **never** in the public
Risoluto repo, and **never** auto-merges.

The full, authoritative workflow lives at
`.agents/prompts/update-feature-spine.md`. Read that file end-to-end before
acting — this SKILL.md is a thin operator-facing wrapper. When the source
prompt and this file disagree, the source prompt wins.

## When to run

Run **only** when one of these is true:

1. The user invokes `/update-feature-spine` (optionally with a PR number or SHA).
2. The user explicitly names the skill: "use update-feature-spine for PR #400".
3. A Claude Code routine fires the skill with a GitHub `pull_request.closed` +
   `merged: true` payload on `base.ref == main`.

Do **not** run on generic prompts like "update the docs", "did this PR change
behavior?", or "check the feature list". If in doubt, ask — do not auto-invoke.

## Inputs (in order of precedence)

1. Explicit PR number in the invocation (`#400`, `400`, `PR 400`).
2. Explicit merge-commit SHA.
3. GitHub webhook payload (routine mode) — read
   `pull_request.number`, `pull_request.merge_commit_sha`, `pull_request.merged`,
   and confirm `base.ref == main`. Exit no-op if `merged != true`.
4. Fallback — most recent merged PR on `main`:

   ```bash
   gh pr list --repo OmerFarukOruc/risoluto --state merged --base main \
     --limit 1 --json number,title,mergedAt
   ```

Self-contained from here on — do not prompt the user mid-run. If a required
prerequisite fails, stop cleanly and report (see Preconditions).

## Preconditions (stop if any fails)

- `research/` submodule exists at repo root and contains
  `RISOLUTO_FEATURES.md`. If missing → stop and tell the operator to run
  `.agents/prompts/build-feature-spine.md` first. **Do not attempt a rebuild
  from this skill.**
- `gh auth status` is authenticated.
- The target PR's diff is readable (private PRs may require access).

## The five buckets (verbatim from source prompt)

Every PR falls into exactly one bucket. If a PR genuinely spans multiple
(e.g., adds a feature and refactors another module), process each bucket
independently in the same run.

| Bucket | Signals | Spine action |
|---|---|---|
| ① **New feature** | new route handler, new CLI flag, new config key, new public export, new UI page/component, `feat(X):` scope with src/ changes | Draft a NEW `###` entry under the matching bundle. Fill spine template. Mark header `⚠️ NEW — review required`. |
| ② **Behavior change** | src/ file modified; changed constants/limits/defaults/regex/string literals; `feat(X):` or `fix(X):` scope | Find entries citing the modified file via grep. Re-read impl. Update only the specific observable behaviors that changed. Update evidence line ranges. Append footnote. |
| ③ **Feature removed** | file deleted, route/export removed, revert PR | Find entry. Mark header `⚠️ Removed in <version> (PR #<N>)`. **Do NOT delete the entry** — past research comparisons reference it. |
| ④ **Pure refactor** | `refactor(X):` scope, same observable behaviors, code moved/renamed | Update evidence file paths + line ranges + class/function names only. No behavior edits. One-line footnote. |
| ⑤ **No spine impact** | no src/ or frontend/src/ changes; docs/test/CI/chore scope; formatting/lint fixes | Exit no-op. Record a row in `## Run history`: `PR #<N> — skipped (<reason>)`. No branch, no PR. |

**Ambiguous?** Default to ② and flag the footnote with
`⚠️ needs-review — possible behavior change, please verify`.

## Workflow (summary — see source prompt for full detail)

1. **Fetch & classify** — `gh pr view <N> --json number,title,body,mergedAt,mergeCommit,files,commits`.
   Keep `src/**` and `frontend/src/**`; drop tests, docs, `.github/`, lockfiles,
   generated files. Empty kept list → bucket ⑤.
2. **Locate affected entries** —
   `grep -n "Source:.*<file-path>" research/RISOLUTO_FEATURES.md` for each kept
   file. No matches + meaningful src/ change → candidate for bucket ①.
3. **Apply updates** per bucket, using the templates in the source prompt
   (§ "Phase 3 — Apply updates per worklist item"). Large PRs may be delegated
   to an `Explore` subagent for file reading; synthesis stays here.
4. **Run history + summary** — prepend a row to `## Run history` at the top of
   the spine file:

   ```markdown
   | 2026-04-19 | PR #<N> | <bucket> | <bundle> | <short summary> |
   ```

   Create the table if missing (columns: Date | PR | Bucket | Bundle | Summary).
   Refresh per-bundle counts in `## Summary` when entry count changes.
5. **Commit + open PR — in the `research/` submodule only**:

   ```bash
   cd research
   git checkout -b spine/pr-<N>
   git add RISOLUTO_FEATURES.md
   git commit -m "spine: update for PR #<N> — <bundle> (<bucket>)"
   git push -u origin spine/pr-<N>
   gh pr create --title "spine: update for PR #<N> — <short summary>" \
     --body "..."   # body format in source prompt § Phase 5
   ```

   **Never** open the spine PR in the public `risoluto` repo. **Never**
   auto-merge the spine PR — the operator reviews and merges.

Bucket ⑤ (no-op) still records the `## Run history` row and exits cleanly so
routine-driven runs leave an audit trail. No branch, no PR, no commit in that
case (the row is added to the in-tree spine only if the operator asks; default
is to emit the would-be row in the terminal summary and skip the file edit —
see source prompt § "Phase 4").

## Anti-patterns — do not

- ❌ Rebuild or overwrite the spine from scratch — always surgical
- ❌ Delete removed-feature entries (use the ⚠️ Removed marker, keep the body)
- ❌ Overwrite existing footnotes — always append
- ❌ Invent new bundles — use the 11 from `docs/ROADMAP_AND_STATUS.md` verbatim
- ❌ Classify as ⑤ just to avoid reading code — if src/ changed, read it
- ❌ Auto-merge the spine PR
- ❌ Skip the ⚠️ NEW flag on new-feature entries
- ❌ Update evidence line ranges without opening the file — stale line numbers
  are a silent-failure hazard
- ❌ Open the spine PR in the public `OmerFarukOruc/risoluto` repo

## Self-check before opening the spine PR

- [ ] Every `src/**` or `frontend/src/**` file in the PR diff is accounted for:
      matched an entry, spawned a new entry, or explicitly classified as
      internal plumbing (with justification in the PR body)
- [ ] Every updated entry has a new footnote with the PR number and date
- [ ] New-feature entries are flagged `⚠️ NEW — review required`
- [ ] Removed entries use the `⚠️ Removed` marker and retain their body
- [ ] `## Run history` row appended
- [ ] `## Summary` counts refreshed if entry count changed
- [ ] Commit message follows `spine: update for PR #<N> — <bundle> (<bucket>)`
- [ ] PR body lists bucket(s), bundle(s), entries touched, and review flags
- [ ] PR was opened in `research/` submodule, not the public repo

## Terminal summary format (always print, even on no-op)

```
Spine update for PR #<N>:
  Bucket(s):       <list>
  Bundle(s):       <list>
  Entries updated: <n>
  Entries added:   <n>
  Entries removed: <n>
  Needs review:    <yes/no> — <reasons>
  Spine PR:        <url or "none — bucket ⑤ no-op">
```
