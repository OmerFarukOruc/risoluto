# SPEC

## Goal

Create an autonomous architecture-improvement loop for Risoluto that repeatedly finds real architecture friction, chooses the strongest safe candidate itself, implements exactly one slice, validates it, commits it, records the learning, and continues until no safe evidence-backed improvement remains.

The loop optimizes for deeper modules, not aesthetic refactoring. Every iteration must use this vocabulary exactly when judging and explaining architecture work: module, interface, implementation, depth, seam, adapter, leverage, locality.

## Non-Goals

- Do not perform broad cleanup that is not required by the chosen slice.
- Do not split files only to reduce line count.
- Do not create a seam unless there is real adapter variation or a verified reason the interface improves testability and locality.
- Do not ask the user to choose candidates.
- Do not make behavior-changing product, security, credential, schema, migration, or public-interface decisions without authority. Skip those candidates and record why.
- Do not rely on older architecture notes as current truth without re-reading current repo state.

## Inputs

- Repo path: `/home/oruc/Desktop/workspace/risoluto`
- Architecture skill: `/home/oruc/.agents/skills/improve-codebase-architecture/SKILL.md`
- Repo instructions: `AGENTS.md` and any nested `AGENTS.md` in touched areas
- Existing architecture context: `docs/ARCHITECTURE_DEEPENING_EXECPLAN.md`
- Core docs: `README.md`, `docs/OPERATOR_GUIDE.md`, `docs/ROADMAP_AND_STATUS.md`, `docs/CONFORMANCE_AUDIT.md`, `docs/TRUST_AND_AUTH.md`
- Source roots: `src/`, `frontend/src/`, `tests/`, `tests/e2e/`

## Per-Iteration Workflow

1. Start from the current repo state and inspect `git status --short --branch`.
2. Read repo instructions, README, relevant docs, tests, and source before acting.
3. Discover real architecture friction:
   - shallow modules that fail the deletion test
   - repeated ownership across callers
   - weak locality
   - behavior that is hard to test through the current interface
   - hypothetical seams with no real adapter variation
   - docs, tests, or runtime behavior that disagree
4. Rank candidates qualitatively as `Strong`, `Worth exploring`, or `Speculative`.
5. Choose the strongest safe actionable candidate without asking the user.
6. Before editing code, write a concrete plan in `PLAN.md` covering:
   - current problem
   - deeper module/interface being created or simplified
   - affected files
   - compatibility expectations
   - tests to add or update
   - docs or ADRs to update
   - validation commands
7. Implement only that one planned slice.
8. Add or update tests for every behavior change.
9. Run required validation before commit:
   `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`
10. If UI behavior changes, also perform browser verification and relevant Playwright checks.
11. If validation fails because of the change, fix it before continuing.
12. If the chosen candidate turns out wrong, record why, abandon that candidate, and choose the next best one.
13. Commit atomically after each successful iteration.
14. Record each iteration in `ATTEMPTS.md` with:
   - candidate chosen
   - reason chosen
   - files changed
   - validation result
   - what became deeper
   - next likely candidate
15. Continue until no safe, evidence-backed architecture improvement remains, or until all remaining candidates are blocked by missing credentials, missing authority, unavoidable behavior changes, or unresolved validation failures.

## Scorecard

Each iteration passes only when all of these are true:

- Evidence: the chosen candidate is backed by current repo reads, tests, docs, or runtime observations.
- Strength: the candidate is ranked `Strong`, or all `Strong` candidates are blocked and the chosen `Worth exploring` candidate is still safe and actionable.
- Depth: the change increases depth by putting more implementation behind a smaller or clearer interface.
- Locality: the change concentrates ownership so future changes or tests do not need to repeat behavior across callers.
- Seam honesty: any seam introduced or preserved has real adapter variation, or the attempt records why it is not a real seam and avoids making it central.
- Testability: behavior can be tested through the chosen module/interface more directly than before.
- Compatibility: shipped behavior, CLI behavior, HTTP routes, dashboard behavior, docs, and persisted data contracts are preserved unless an explicit authority exists.
- Validation: required commands pass before commit, and UI verification is performed when relevant.
- Memory: `PLAN.md`, `ATTEMPTS.md`, and `NOTES.md` are updated before moving to the next iteration.

Stop when a fresh current-state scan finds no `Strong` or safe `Worth exploring` candidate. Remaining candidates must be listed in `ATTEMPTS.md` or `NOTES.md` with the blocking reason.

## Feedback Loop

- Fast discovery check: targeted `rg`, source reads, and focused tests for the candidate area. Run at the start of each iteration and after the first implementation pass.
- Fast implementation check: the narrowest relevant Vitest command, typecheck, or Playwright smoke command for the touched area.
- Required pre-commit check: `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`.
- UI escalation: browser verification plus relevant `pnpm exec playwright test --project=smoke` or narrower Playwright spec when dashboard behavior changes.
- Final loop check: re-read `ATTEMPTS.md` and run a fresh candidate scan before deciding there are no safe improvements left.

## Done When

- `GOAL.md` exists and contains a complete `/goal` contract with goal, context, constraints, scorecard, done_when, feedback_loop, workflow, working_memory, human_control_surface, verification_loop, execution_rules, and output_contract blocks.
- `PLAN.md`, `ATTEMPTS.md`, `NOTES.md`, and `CONTROL.md` exist as working-memory and control files for the long-running loop.
- The contract requires one architecture slice per commit, required validation before commit, and `ATTEMPTS.md` updates after every iteration.
- The contract prevents user-choice prompts for candidate selection and requires skipping candidates that need missing user intent, credentials, security authority, or behavior-changing decisions.
- Codex config readiness has been checked with the goal-forge config script and any gaps are reported.
