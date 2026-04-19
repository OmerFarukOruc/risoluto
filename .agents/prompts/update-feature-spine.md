# Update Risoluto's Feature Spine (Per-PR)

## Goal

Keep `research/RISOLUTO_FEATURES.md` in sync with a just-merged PR on `main`. This is a **surgical, incremental update** — not a rebuild. Touch only the entries the PR actually affected. Accuracy is the primary objective; speed is second.

## Context

Risoluto is a local AI issue-tracker → PR orchestrator. Its canonical feature spine lives at `research/RISOLUTO_FEATURES.md` (inside a private submodule). That spine is the alignment target for the `risoluto-researcher` skill. Every merged PR to `main` that changes user-visible behavior must be reflected in the spine, or research alignment drifts.

If the spine file does not exist yet, STOP. Tell the operator to run `.agents/prompts/build-feature-spine.md` first (the bootstrap prompt). Do not attempt a rebuild from this prompt.

## Input

The merged PR number or merge-commit SHA. Paste it at the bottom of this prompt as:

```
Target PR: #<number>
```

If not given, default to the most recent merge commit on `main`:

```bash
gh pr list --repo OmerFarukOruc/risoluto --state merged --base main --limit 1 --json number,title,mergedAt
```

## Output

1. A branch in the `research/` submodule named `spine/pr-<N>`
2. A PR opened on the private research repo titled `spine: update for PR #<N> — <summary>`
3. A terminal summary listing: buckets detected, entries touched, entries added, entries marked removed, whether human review is required

**Never** auto-merge the spine PR. Your job ends at opening it.

## Prerequisites

1. `research/` submodule exists and contains `RISOLUTO_FEATURES.md`. If missing → stop with guidance.
2. `gh auth status` returns authenticated.
3. You can read the merged PR's diff (private PRs may need explicit access).

## Classification — five buckets

Every PR falls into exactly one of these. If a single PR spans multiple (rare but real — e.g., adds a feature AND refactors another module), process each bucket independently in the same run.

| Bucket | Signals | Spine action |
|---|---|---|
| ① **New feature** | new route handler, new CLI flag, new config key, new public export, new UI page/component, `feat(X):` scope with src/ changes | Draft a NEW `###` entry under the matching bundle. Fill spine template. Mark entry header `⚠️ NEW — review required`. |
| ② **Behavior change** | src/ file modified; changed constants/limits/defaults/regex/string literals; `feat(X):` or `fix(X):` scope | Find entries citing the modified file via grep. Re-read impl. Update only the specific observable behaviors that changed. Update evidence line ranges. Append footnote. |
| ③ **Feature removed** | file deleted, route/export removed, revert PR | Find entry. Mark header `⚠️ Removed in <version> (PR #<N>)`. **Do NOT delete the entry** — past research comparisons reference it. |
| ④ **Pure refactor** | `refactor(X):` scope, same observable behaviors, code moved/renamed | Update evidence file paths + line ranges + class/function names only. No behavior edits. One-line footnote. |
| ⑤ **No spine impact** | no src/ or frontend/src/ changes; docs/test/CI/chore scope; formatting/lint fixes | Exit no-op. Record a row in `## Run history`: `PR #<N> — skipped (<reason>)`. No branch, no PR. |

**Ambiguous?** If you can't confidently place a PR into one bucket (e.g., refactor that *might* have changed behavior), default to ② and flag the footnote with `⚠️ needs-review — possible behavior change, please verify`.

## Workflow

### Phase 1 — Fetch and classify

```bash
gh pr view <N> --repo OmerFarukOruc/risoluto --json number,title,body,mergedAt,mergeCommit,files,commits
```

Extract:
- `files[].path` — the list of changed files
- `commits[].messageHeadline` — conventional commit scopes
- `title` / `body` — author's intent

Filter `files[]`:
- **Keep**: `src/**`, `frontend/src/**`
- **Drop from classification**: `tests/**`, `*.test.ts`, `*.spec.ts`, `docs/**`, `.github/**`, `package.json` (unless it changed exposed deps), `pnpm-lock.yaml`, generated files

If the kept list is empty → bucket ⑤ → exit no-op (after recording `## Run history` row).

Otherwise pick primary bucket. If a PR touches multiple buckets, produce one spine-update section per bucket within the same PR.

### Phase 2 — Locate affected spine entries

For every retained src/ file, grep the spine:

```bash
grep -n "Source:.*<file-path>" research/RISOLUTO_FEATURES.md
```

- **Matches found** → those entries are update candidates (bucket ② / ③ / ④)
- **No matches, but src/ file meaningfully changed** → likely new feature (bucket ①) OR internal plumbing (no spine action). Read the changed code to decide.

Build a worklist: `[(bucket, spine-entry-title or NEW, changed-files)]`.

### Phase 3 — Apply updates per worklist item

**Bucket ① — New feature:**
1. Determine target bundle (one of the 11 from `docs/ROADMAP_AND_STATUS.md`)
2. Read the new code end-to-end
3. Draft entry using the spine template:
   ```markdown
   ### <Feature title> ⚠️ NEW — review required

   - **Description:** 1–3 sentences
   - **How it works:** 2–4 sentences
   - **Observable behaviors:**
     - <5–8 concrete rules/limits/defaults/UX>
   - **Evidence:**
     - Source: `<file>:<lines>` — `<ClassName>` / `<functionName>`
     - … (≥2 citations)
   - **Shipped in:** <next-version-tag or "main @ YYYY-MM-DD">
   - **Related GitHub issues:** #<N> (this PR), #<linked-issues>

   > Added 2026-04-19 (PR #<N>): <1-sentence summary of what this feature enables>
   ```
4. Insert at the end of the matching bundle section

**Bucket ② — Behavior change:**
1. For each affected entry, re-read the post-merge implementation at cited files
2. Diff against the entry's current observable-behaviors list
3. Update only the specific behaviors that changed. Leave untouched behaviors alone.
4. Refresh evidence line ranges if code shifted
5. Append a footnote BELOW the existing entry body, ABOVE any prior footnotes:
   ```markdown
   > Updated 2026-04-19 (PR #<N>): <which behaviors changed; e.g., "default poll interval reduced from 30000 to 15000; added polling.fast_mode config key">
   ```

**Bucket ③ — Feature removed:**
1. Find the entry
2. Modify the header line to: `### <Original title> ⚠️ Removed in <version> (PR #<N>)`
3. Prepend a `> REMOVED` blockquote at the top of the entry body:
   ```markdown
   > **REMOVED 2026-04-19 (PR #<N>):** <1–2 sentence reason; e.g., "deprecated since v0.5.0; consolidated into new unified notification channel">
   ```
4. Leave all behavior/evidence content intact below. Historical reference.

**Bucket ④ — Pure refactor:**
1. Find affected entries
2. Update file paths / line ranges / class-function names in the `**Evidence:**` block
3. Append a single-line footnote: `> Refactor 2026-04-19 (PR #<N>): <what moved where>`
4. Do NOT touch observable-behaviors or description

### Phase 4 — Update run history and summary

At the top of the spine file (right below the version metadata), find `## Run history`. Prepend a row:

```markdown
| 2026-04-19 | PR #<N> | <bucket> | <bundle> | <short summary> |
```

If the `## Run history` table doesn't exist yet, create it with columns: `Date | PR | Bucket | Bundle | Summary`.

Update the per-bundle counts in `## Summary` if a new entry was added or an entry was marked removed.

### Phase 5 — Commit and open PR

```bash
cd research
git checkout -b spine/pr-<N>
git add RISOLUTO_FEATURES.md
git commit -m "spine: update for PR #<N> — <bundle> (<bucket>)"
git push -u origin spine/pr-<N>
gh pr create --title "spine: update for PR #<N> — <short summary>" \
  --body "$(cat <<'EOF'
Auto-generated spine update for public-repo PR #<N>.

**Bucket(s):** <list>
**Bundle(s):** <list>
**Entries touched:** <count> updated, <count> added, <count> marked removed
**Needs review:** <yes / no — list any ⚠️ needs-review or ⚠️ NEW flags>

## Diff summary
<brief per-entry summary>

Close this PR without merging if the classification is wrong.
EOF
)"
```

Return the PR URL in the terminal summary.

## Anti-patterns — do not

- ❌ Rebuild or overwrite the spine from scratch — always surgical
- ❌ Delete removed-feature entries (use the ⚠️ Removed marker)
- ❌ Overwrite existing footnotes — always append
- ❌ Invent new bundles — use the 11 from `docs/ROADMAP_AND_STATUS.md` verbatim
- ❌ Classify as ⑤ (no-op) just because you don't want to read code — if src/ changed, read it
- ❌ Auto-merge the spine PR
- ❌ Skip the ⚠️ NEW flag on new-feature entries — operator must consciously approve new entries
- ❌ Update evidence line ranges without actually opening the file — stale line numbers are a silent-failure hazard

## Self-check before opening the spine PR

- [ ] Every src/ or frontend/src/ file in the PR diff is accounted for: matched an entry, spawned a new entry, or explicitly classified as internal plumbing (with justification recorded in the PR body)
- [ ] Every updated entry has a new footnote with the PR number and date
- [ ] New-feature entries are flagged `⚠️ NEW — review required`
- [ ] Removed entries use the ⚠️ Removed marker and retain their body content
- [ ] `## Run history` row appended
- [ ] `## Summary` counts refreshed if entry count changed
- [ ] Commit message follows `spine: ...` convention
- [ ] PR body lists bucket(s), bundle(s), entries touched, and review flags

## Terminal summary format

When done, print:

```
Spine update for PR #<N>:
  Bucket(s):       <list>
  Bundle(s):       <list>
  Entries updated: <n>
  Entries added:   <n>
  Entries removed: <n>
  Needs review:    <yes/no> — <reasons>
  Spine PR:        <url>
```

---

## Target PR

<!-- Paste the PR number here. Example: "Target PR: #400" -->
