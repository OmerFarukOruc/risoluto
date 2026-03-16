# Symphony runtime reference

Use this file only when the main `SKILL.md` workflow is not enough. It keeps the deep lookup material out of the early read path.

## Source selection rules

- Use `./symphony-logs` first for historical issue inspection.
- Use raw archive files only when the helper is unavailable, the index is missing, you need raw verification, or the user explicitly asked for raw files.
- Use the local API first for live-state questions such as `now`, `current`, `still running`, `active`, or `stalled again`.
- Always name the exact helper command, archive file path(s), or API endpoint(s) that support your answer.
- If API evidence is unavailable, say live state could not be verified and that your answer is archive-only.
- Never infer current worker state from archive files alone.

## Archive layout

Symphony archives attempts under a log directory that defaults to `.symphony/` next to the workflow file. Startup can override that with `--log-dir`, and the helper script can override it with `--dir`.

```text
.symphony/
├── issue-index.json              # { "NIN-6": ["attemptA", "attemptB"], ... }
├── attempts/
│   └── {attemptId}.json          # one JSON file per archived attempt
└── events/
    └── {attemptId}.jsonl         # NDJSON event stream, one JSON object per line
```

## Attempt metadata fields

Attempt files contain the durable run summary. Important fields include:

- `attemptId`, `issueId`, `issueIdentifier`, `title`
- `workspaceKey`, `workspacePath`
- `status` (`running`, `completed`, `failed`, `timed_out`, `stalled`, `cancelled`, `paused`)
- `attemptNumber`, `startedAt`, `endedAt`
- `model`, `reasoningEffort`, `modelSource`
- `threadId`, `turnId`, `turnCount`
- `errorCode`, `errorMessage`
- `tokenUsage`

## Event fields

Each event line in `events/{attemptId}.jsonl` can include:

- `at`, `attemptId`, `issueId`, `issueIdentifier`, `sessionId`
- `event`, `message`
- optional `content`, `usage`, `rateLimits`

Common events include:

- `item_started` / `item_completed` for reasoning steps, commands, file changes, or tool activity
- `turn_completed` with token usage in the `usage` field
- `rate_limits_updated`
- `worker_stalled`
- `worker_failed`
- `model_selection_updated`

## Direct file fallback details

If the helper script is unavailable or fails, fall back to the archive files directly.

When you use this path, report the exact file path(s) you inspected.

### Normal path: issue index exists

```bash
# Step 1: resolve issue -> attempt IDs
jq '."NIN-6"' .symphony/issue-index.json

# Step 2: inspect attempt metadata
cat .symphony/attempts/<attemptId>.json

# Step 3: inspect recent events
tail -50 .symphony/events/<attemptId>.jsonl

# Step 4: narrow to failures when relevant
grep -i 'error\|fail\|crash\|timeout\|stall' .symphony/events/<attemptId>.jsonl
```

### Fallback path: `issue-index.json` is missing

Do not stop at "index missing." Fall back to scanning attempt metadata files for the issue identifier, then use the matched `attemptId` values to inspect the corresponding event streams.

Use the same logic the helper uses conceptually:

1. scan `.symphony/attempts/*.json`
2. find attempt records where `issueIdentifier` matches the target issue
3. collect their `attemptId` values
4. open `.symphony/events/{attemptId}.jsonl`

When you take this fallback path, tell the user you are scanning archived attempt metadata because the index file is missing.

## Local API endpoint notes

Default local server examples:

```bash
curl http://127.0.0.1:4000/api/v1/state
curl http://127.0.0.1:4000/api/v1/NIN-6
curl http://127.0.0.1:4000/api/v1/NIN-6/attempts
curl http://127.0.0.1:4000/api/v1/attempts/<attemptId>
```

Use each endpoint deliberately:

- `/api/v1/state` -> full runtime snapshot: running, retrying, queued, completed, token totals, recent events
- `/api/v1/NIN-6` -> one issue detail plus recent events and archived attempts
- `/api/v1/NIN-6/attempts` -> all attempts for the issue plus `current_attempt_id`
- `/api/v1/attempts/<attemptId>` -> one attempt record plus `events`

When you use the API for live-state claims, name the exact endpoint in the answer. If the API cannot be reached, say live state is unverified rather than inferring it from archive history.

## Event ordering caveat

Be careful about event ordering:

- raw `.jsonl` event files are written in chronological order, so later lines are newer
- API responses that come from `getEvents()` are returned newest-first

That means:

- when reading the raw file directly, the tail is the newest part of the run
- when reading `events` from the HTTP API, the first entries are the newest events

Do not mix these two orderings in your summary.

## Round-two sandbox benchmark note

This skill was rerun against the controlled archive fixture at `tests/fixtures/symphony-archive-sandbox/.symphony` using the same three eval prompts already tracked in `evals/evals.json`, with baseline vs with-skill comparisons judged under the tighter provenance-focused expectations.

Result summary:

- The skill retained a clear advantage under the stricter rubric.
- Baseline answers were generally correct, but the with-skill answers were more consistent about naming exact evidence sources and separating archive history from live-state claims.
- The strongest gains were on `MT-42` and `NIN-3`, where the skill reliably listed exact archive sources and explicitly stated when live state could not be verified from archive-only evidence.
- `NIN-6` also improved in a meaningful way because the with-skill answer used a repeatable provenance contract instead of a plain descriptive summary.

Practical takeaway: the current workflow and reporting guidance still hold up when grading explicitly rewards exact provenance, archive-only labeling, and strict separation between historical evidence and current worker-state claims.
