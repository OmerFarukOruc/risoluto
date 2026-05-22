<goal>
Run an autonomous architecture-improvement loop in `/home/oruc/Desktop/workspace/risoluto`.

Repeatedly use the `improve-codebase-architecture` discipline to find real architecture friction, rank candidates, choose the strongest safe actionable candidate yourself, implement exactly one architecture slice, validate it, commit it atomically, record the learning, and continue from the new repo state.

Optimize for deeper modules, not aesthetic refactoring. Use this vocabulary exactly in plans, notes, commits, and explanations: module, interface, implementation, depth, seam, adapter, leverage, locality.
</goal>

<context>
Start in `/home/oruc/Desktop/workspace/risoluto`.

Read these first at the start of the goal, then reread relevant files at the start of every iteration:
- `AGENTS.md`
- nested `AGENTS.md` files under touched areas
- `README.md`
- `package.json`
- `docs/ARCHITECTURE_DEEPENING_EXECPLAN.md`
- `docs/OPERATOR_GUIDE.md`
- `docs/ROADMAP_AND_STATUS.md`
- `docs/CONFORMANCE_AUDIT.md`
- `docs/TRUST_AND_AUTH.md`
- `.impeccable.md` before any UI work
- `/home/oruc/.agents/skills/improve-codebase-architecture/SKILL.md`

Primary source areas:
- `src/cli/index.ts`
- `src/orchestrator/`
- `src/agent-runner/`
- `src/http/`
- `src/persistence/sqlite/`
- `src/workspace/`
- `src/linear/`
- `src/config/`
- `src/codex/`
- `frontend/src/`
- `tests/`
- `tests/e2e/`

Discovery commands:
- `git status --short --branch`
- `rg --files src frontend tests docs | sort`
- `rg -n "TODO|FIXME|compat|legacy|facade|adapter|interface|runtime|snapshot|store|route|handler|mock|schema" src frontend tests docs`
- Use `colgrep` for semantic architecture exploration if available and working in this environment; fall back to `rg` when it fails or is noisy.
- Use `git log --oneline -- docs/ARCHITECTURE_DEEPENING_EXECPLAN.md src frontend tests | head -40` when prior architecture context may matter.

Do not treat old architecture notes as current truth. They are context for what has already been tried. Start every iteration from the current repo state.
</context>

<constraints>
Implementation constraints:
- Implement exactly one planned architecture slice per iteration.
- Avoid unrelated cleanup.
- Add or update tests for every behavior change.
- Preserve shipped behavior unless the chosen slice has explicit authority for a behavior change.
- Keep public CLI behavior, HTTP route behavior, dashboard behavior, persistence schemas, config semantics, and documented operator workflows compatible unless authority exists.
- If a candidate needs user intent, credentials, security authority, schema or migration authority, dependency approval, or a behavior-changing decision, skip it, record the reason, and choose the next safe candidate.
- Do not ask the user to choose candidates.
- Do not widen scope after planning. If the plan is wrong, record why, abandon the candidate, and choose again.
- Do not edit generated `dist/` output by hand.
- Keep secrets out of committed files.

Architecture constraints:
- Optimize for depth: more useful implementation behind a smaller, clearer interface.
- A module earns its place only when deleting it would force meaningful complexity to reappear across callers.
- Prefer locality: behavior, tests, bugs, and future changes should concentrate in the module that owns the concept.
- Treat hypothetical seams skeptically. One adapter is usually a hypothetical seam. Two real adapters or a concrete testability/runtime need can justify a seam.
- Prefer making an existing module deeper over adding a new shallow module.
- Prefer a stable interface with focused implementation over scattering ownership across callers.
- Prefer tests through the interface that operators and callers actually use.
- Do not extract under-30-line helpers unless they create real depth, reuse, or independent testability.
- Follow the repo extraction guidance in `AGENTS.md`, including directory depth and barrel rules.

UI constraints:
- If any UI behavior, CSS, dashboard template, or frontend interaction changes, read `.impeccable.md`, run browser verification, and run relevant Playwright checks.
- Keep docs aligned when operator-visible behavior changes.
</constraints>

<scorecard>
Primary score: one validated committed iteration that increases architecture depth without behavior regression.

An iteration passes only when all checklist items are true:
- Evidence: current repo reads, docs, tests, or runtime observations prove the friction is real.
- Rank: the chosen candidate is `Strong`, or all `Strong` candidates are blocked and the chosen `Worth exploring` candidate is safe and actionable.
- Depth: the slice moves meaningful implementation behind a clearer interface.
- Locality: ownership becomes more local, with less repeated behavior across callers.
- Seam honesty: any seam is backed by real adapter variation or a documented testability/runtime need. Hypothetical seams are simplified or avoided.
- Leverage: callers get more behavior from less knowledge of implementation details.
- Testability: tests exercise behavior through the intended interface.
- Compatibility: expected behavior stays stable, including docs/tests/runtime agreements.
- Scope: the diff contains only the planned slice plus required tests/docs.
- Validation: `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test` passes before commit.
- UI gate: if UI behavior changed, browser verification and relevant Playwright checks pass or are recorded with exact blockers.
- Memory: `PLAN.md`, `ATTEMPTS.md`, and `NOTES.md` are updated before moving on.
- Commit: the slice is committed atomically with a conventional message that describes the architecture slice.

Candidate ranking rubric:
- `Strong`: current evidence shows repeated ownership, weak locality, hard-to-test behavior through the current interface, docs/tests/runtime disagreement, or a shallow module that fails the deletion test; the improvement is safe, testable, and compatible.
- `Worth exploring`: evidence suggests friction, but the safest implementation may require more current-state reading or a very small probe. Choose only if no unblocked `Strong` candidate exists.
- `Speculative`: mostly aesthetic, preference-driven, dependent on a hypothetical seam, or missing proof that locality/leverage/testability improve. Do not implement.

Scoring method:
- Inspect `PLAN.md` for the current candidate plan.
- Inspect `ATTEMPTS.md` for the completed iteration record.
- Inspect `git diff --stat HEAD~1..HEAD` and `git show --name-only --stat HEAD` after each commit.
- Run or review validation command output.
- Re-run discovery against the new repo state before the next iteration.

Stop condition:
- Stop only when a fresh current-state scan finds no safe evidence-backed `Strong` candidate and no safe `Worth exploring` candidate.
- Record remaining `Speculative` or blocked candidates in `ATTEMPTS.md` or `NOTES.md` with exact reasons.
</scorecard>

<done_when>
The autonomous loop is complete when all of these concrete conditions are met:
- `ATTEMPTS.md` contains one row per iteration, including candidate chosen, reason chosen, files changed, validation result, what became deeper, and next likely candidate.
- Every successful iteration has an atomic git commit visible in `git log --oneline`.
- Every committed slice passed `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test` before commit.
- Every UI behavior slice also records browser verification and relevant Playwright results in `ATTEMPTS.md`.
- `NOTES.md` records durable architecture learnings, blockers, skipped candidates, and any docs/tests/runtime disagreements found.
- `PLAN.md` reflects the latest phase and either the current slice plan or the final no-safe-candidate conclusion.
- A final fresh scan from current repo state found no safe evidence-backed architecture improvement remaining, or all remaining candidates are explicitly blocked by missing credentials, missing authority, unavoidable behavior changes, or unresolved validation failures.
- `git status --short --branch` is clean except for unrelated pre-existing user changes that were preserved and clearly called out.
</done_when>

<feedback_loop>
Fast check:
- At the start of each iteration, read `CONTROL.md`, `PLAN.md`, `ATTEMPTS.md`, `NOTES.md`, and `git status --short --branch`.
- Run targeted discovery with `rg`, file reads, and focused source/test inspection.
- Expected runtime: 5 to 20 minutes per candidate scan, depending on area size.
- Cadence: every iteration before planning, after abandoning a candidate, and before declaring no safe candidates remain.
- Proxy validity: current source, docs, and tests reveal whether friction is real and whether depth/locality/leverage can improve without behavior change.

Focused implementation check:
- Run the narrowest relevant tests for touched code, such as `pnpm test -- tests/orchestrator/run-lifecycle-coordinator.test.ts` or the nearest frontend/backend Vitest file.
- Run typecheck or build early when import shapes or public interfaces change.
- Expected runtime: 1 to 10 minutes.
- Cadence: after the first implementation pass and after each fix.

Required broad check before every commit:
- `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`
- Expected runtime: about 1 to 3 minutes in a warm repo, but let the command finish.
- Cadence: exactly before each atomic commit.

UI escalation check:
- If UI behavior changes, run browser verification against the changed route, exercise the affected interaction, inspect console/network when relevant, and run the relevant Playwright check.
- Use `pnpm exec playwright test --project=smoke` or a narrower matching spec when safe. Use `pnpm exec playwright test --project=visual` when visual layout changed and snapshots are intentionally updated.

Slow/final check:
- Before final completion, run the required broad check one more time unless it already ran after the final commit and no files changed since.
- Re-read `ATTEMPTS.md` and `NOTES.md`, then perform a fresh current-state candidate scan.
</feedback_loop>

<workflow>
Repeat this loop until the stop condition is met:

1. Orient
- Read `CONTROL.md`.
- Run `git status --short --branch`.
- Identify unrelated pre-existing changes and preserve them.
- Read repo instructions and relevant docs/source/tests for the area under consideration.
- Read `/home/oruc/.agents/skills/improve-codebase-architecture/SKILL.md` when the architecture rubric needs refreshing.

2. Discover
- Use the `improve-codebase-architecture` vocabulary and deletion test.
- Look for shallow modules that fail the deletion test, repeated ownership across callers, weak locality, behavior hard to test through the current interface, hypothetical seams with no real adapter variation, and docs/tests/runtime disagreement.
- Record durable observations in `NOTES.md`.

3. Rank
- Build a short candidate list in `PLAN.md`.
- Rank each candidate as `Strong`, `Worth exploring`, or `Speculative`.
- Include evidence paths, likely affected files, expected depth/locality/leverage, and blockers.

4. Choose
- Choose the strongest safe actionable candidate yourself.
- Do not ask the user to choose.
- If the best candidate needs missing user intent, credentials, security authority, dependency approval, schema/migration authority, public-interface authority, or behavior-changing authority, skip it, record why, and choose the next safe candidate.

5. Plan before edits
- Update `PLAN.md` before editing code.
- The plan must cover current problem, deeper module/interface being created or simplified, affected files, compatibility expectations, tests to add or update, docs or ADRs to update, and validation commands.

6. Implement one slice
- Edit only the planned files plus required tests/docs.
- Prefer existing repo patterns and existing module vocabulary.
- Keep public interfaces stable unless the plan has explicit authority.
- If the chosen candidate turns out wrong, stop editing, record why in `ATTEMPTS.md`, revert only your own incomplete changes if safe, and choose the next candidate.

7. Validate
- Run focused tests first.
- Fix failures caused by the change.
- Run `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`.
- If UI behavior changed, complete browser verification and relevant Playwright checks.
- If validation cannot pass because of missing credentials or environmental limits unrelated to the change, record exact evidence and choose a safer candidate if possible.

8. Record
- Update `ATTEMPTS.md` with candidate chosen, reason chosen, files changed, validation result, what became deeper, and next likely candidate.
- Update `NOTES.md` with durable learnings and blockers.
- Update `PLAN.md` with the completed phase and next candidate hypothesis.

9. Commit
- Commit atomically after successful validation.
- Use a concise conventional commit message such as `refactor: deepen <module> <interface>` or another commitlint-compatible scope/message.

10. Continue
- Start the next iteration from the new repo state.
- Never reuse an old candidate without re-checking current source, docs, tests, and git state.
</workflow>

<working_memory>
Maintain these files throughout the run:

- `PLAN.md`: current phase, active candidate list, chosen candidate plan, validation commands, and next step.
- `ATTEMPTS.md`: append-only iteration ledger. Update after every successful slice, abandoned candidate, blocked candidate, or failed experiment.
- `NOTES.md`: chronological durable notes, current-state discoveries, docs/tests/runtime disagreements, skipped candidates, and architecture lessons.
- `CONTROL.md`: compact human control surface. Reread before every phase change, strategic pivot, expensive step, or sidecar input.

Update cadence:
- Update `PLAN.md` before editing and after each phase change.
- Update `ATTEMPTS.md` after each meaningful approach, whether successful, abandoned, blocked, or failed.
- Update `NOTES.md` when discovering context that should survive compaction.
- Update `CONTROL.md` only when the user changes operating knobs or when a status field needs refreshing.
</working_memory>

<human_control_surface>
Use `CONTROL.md` as the compact operator panel for this long-running goal.

Before each phase change, strategic pivot, expensive step, or sidecar ingestion, reread `CONTROL.md`. If it changed, summarize the relevant change in `PLAN.md` and adapt before proceeding.

`CONTROL.md` may narrow priorities, pause work, or require approval for specific risky actions. It cannot weaken this `GOAL.md`, the scorecard, or the done_when criteria.

Default behavior:
- Choose candidates autonomously.
- Skip candidates requiring missing user intent, credentials, security authority, schema/migration authority, public-interface authority, dependency approval, or behavior-changing decisions.
- Do not ask the user to choose candidates.
- Treat the repo path as the only allowed project scope unless `CONTROL.md` is edited by the user.
</human_control_surface>

<verification_loop>
For every iteration:

1. Before edits:
- `git status --short --branch`
- Read relevant instructions, docs, tests, and source.

2. During implementation:
- Run focused tests nearest to the touched behavior.
- Run typecheck/build early when interfaces or imports change.

3. Before commit:
- `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`

4. UI-specific verification:
- If UI behavior, CSS, dashboard templates, frontend routes, or operator interactions changed, run browser verification against the changed route.
- Exercise the affected interaction.
- Inspect console/network when errors, requests, timing, or CSS risk is relevant.
- Run relevant Playwright checks, usually `pnpm exec playwright test --project=smoke` or a narrower matching spec. Use visual checks when layout changed.
- Record route, interaction, and result in `ATTEMPTS.md`.

5. Docs and contracts:
- If operator behavior, trust posture, auth, config, API response shape, or runtime behavior changed, update `README.md` and relevant `docs/*.md`.
- If OpenAPI/schema parity is affected, update the relevant schema and tests.

6. Failure handling:
- If validation fails because of the change, fix it before commit.
- If validation fails for missing credentials, missing external services, or another environmental blocker, record exact command output and choose a candidate that can be completed safely if one exists.
</verification_loop>

<execution_rules>
- Check git status before edits.
- Preserve unrelated user changes.
- Prefer `rg` over `grep` when available.
- Use `colgrep` for semantic architecture exploration if available and working; fall back to `rg` when needed.
- Use the runtime patch/edit tool for manual edits when available.
- Read context files before implementation.
- Batch independent file reads in parallel when the runtime supports it.
- Keep the goal scorecard current: know the primary checklist, passing threshold, regression checks, scoring method, and stop condition.
- Use the fastest representative feedback check while iterating; reserve slower checks for escalation points and final verification.
- Maintain `PLAN.md`, `ATTEMPTS.md`, `NOTES.md`, and `CONTROL.md`.
- Update `ATTEMPTS.md` after each meaningful approach so future iterations do not repeat work without new evidence.
- Run focused tests before broad tests.
- Do not paper over failures.
- Do not widen scope.
- Do not ask the user to choose candidates.
- Do not run destructive commands or revert unrelated user changes.
- Do not edit generated output by hand.
- Keep the final answer concise.
</execution_rules>

<output_contract>
After each successful iteration:
- Leave one atomic commit.
- Update `ATTEMPTS.md`, `PLAN.md`, and `NOTES.md`.
- Continue automatically to the next iteration unless the stop condition is met.

When the stop condition is met, final response should include:
- Number of successful committed iterations.
- Final commit range or latest commit hash.
- Required validation result.
- Final reason no safe evidence-backed architecture improvement remains.
- Any remaining blocked or speculative candidates and their reasons.
- Confirmation that unrelated pre-existing changes were preserved.
</output_contract>
