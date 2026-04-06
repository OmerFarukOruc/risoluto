# Original Prompt Draft (Pre-Brainstorm)

This is the original prompt Omer crafted before running it through the Anvil pipeline. The planning phase should use this as a starting point and restructure it based on the brainstorm decisions.

---

You are about to execute a comprehensive, multi-phase UI/UX enhancement of the Risoluto dashboard to production quality. This is for the v1.0 release.

## Critical Instructions

1. **ASK ME CONSTANTLY.** Use AskUserQuestion at every phase gate, every aesthetic decision, every prioritization choice, and whenever you're unsure about direction. I'd rather you ask 20 questions than make 1 wrong assumption. Specifically ask before: changing the visual direction, removing features, altering the color palette, modifying design system tokens, touching the setup wizard flow, or making any change that affects multiple pages.

2. **SCREENSHOTS ARE MANDATORY.** Before ANY changes, boot the dev server and use agent-browser to take full-page screenshots of every page in both light and dark themes. Save them as baseline evidence. After each phase, re-screenshot changed pages to show progress. At the end, do a before/after comparison.

3. **SKILL-DRIVEN WORKFLOW.** Execute the Impeccable design skills in the order below. Each skill has deep expertise — trust its process, feed it the right context, and capture its output before moving to the next skill.

4. **VERIFY CONTINUOUSLY.** After each phase: `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`. After UI changes, run `pnpm exec playwright test --project=smoke` to catch regressions. Update visual baselines only with my explicit approval.

5. **COMMIT ATOMICALLY.** One logical change per commit, conventional commit format (`feat(ui):`, `fix(ui):`, `refactor(ui):`, `style(ui):`). Don't bundle multiple skills' changes into one commit.

## Phase 0: Setup & Baseline

### Step 0a: Design Context
- `.impeccable.md` already exists at project root with full brand, color, typography, motion, and component specs. Read it thoroughly — it defines the "Transparent. Calm. Inevitable." personality and the copper-accent, zero-radius stitch aesthetic.
- Also read the design system CSS: `frontend/src/styles/design-system.css` and `frontend/src/styles/tokens.css`.
- If `.impeccable.md` is missing or outdated for any reason, run `/teach-impeccable` and relay its questions to me.

### Step 0b: Baseline Screenshots
- Start the dev server: `pnpm run dev -- --port 4000` (this starts the backend on port 4000; Vite frontend auto-starts on port 5173).
- Use agent-browser to navigate to `http://localhost:5173` and take full-page screenshots of every page in BOTH dark and light themes:
  - `/` (Overview dashboard)
  - `/queue` (Kanban board)
  - `/issues/{id}` (Issue detail — pick an issue ID from the queue)
  - `/issues/{id}/runs` (Runs tab for an issue)
  - `/logs/{id}` (Log viewer)
  - `/runs` (Runs list)
  - `/attempts/{id}` (Attempt detail)
  - `/settings` (Settings panel)
  - `/setup` (Setup wizard)
  - `/welcome` (Welcome/onboarding)
  - `/observability` (Metrics dashboard)
  - `/audit` (Audit log)
  - `/templates` (Template editor)
  - `/git` (Git browser)
  - `/workspaces` (Workspace manager)
  - `/containers` (Container view)
  - `/notifications` (Notification center)
- Save all screenshots in a `screenshots/baseline/` directory with descriptive names (e.g., `overview-dark.png`, `queue-light.png`).
- **ASK ME:** "Baseline screenshots captured for all 17 pages in both themes. Which pages do you want to focus on most? Any pages we should skip or deprioritize?"

## Phase 1: Diagnosis

Run these three skills to map the full landscape of issues:

### Step 1a: Dogfood
Run `/dogfood` against the running app at `http://localhost:5173`. This will systematically explore every page, find bugs, UX issues, and produce a report with screenshots. Let it browse headfully.

### Step 1b: Critique
Run `/critique` to evaluate the design from a UX perspective. Feed it the baseline screenshots and ask it to score:
- Visual hierarchy
- Information architecture
- Emotional resonance
- Cognitive load
- Overall quality
- AI slop detection (critical — our design should feel handcrafted per `.impeccable.md`, not generic)

### Step 1c: Audit
Run `/audit` to check technical quality:
- Accessibility (WCAG AA compliance, focus indicators, screen reader)
- Performance (loading, rendering, animations)
- Theming (light/dark consistency)
- Responsive design (mobile, tablet, desktop)
- Anti-patterns

### Step 1d: Alignment
**ASK ME** with a structured summary:
- "Here are the top findings from dogfood, critique, and audit, organized by severity (P0-P3). Which findings should we prioritize? Any we should explicitly skip? What's the aesthetic direction — should we go bolder/louder or quieter/more refined?"
- Present the critique scores and audit scores.
- Ask about any specific pain points I've noticed.

## Phase 2: Foundation — Structure & Space

Based on Phase 1 findings and my priorities:

### Step 2a: Distill
Run `/distill` to strip unnecessary complexity. Focus on:
- Pages with too many competing elements
- Redundant UI chrome
- Information that could be progressive-disclosed
- **ASK ME** before removing anything that changes page structure.

### Step 2b: Arrange
Run `/arrange` to fix layout, spacing, and visual rhythm:
- Grid consistency across pages
- Spacing system alignment to the 8px grid tokens
- Visual hierarchy improvements
- Card/section breathing room

### Step 2c: Typeset
Run `/typeset` to refine typography:
- Verify the Space Grotesk / Manrope / IBM Plex Mono choices work
- Fix any hierarchy inconsistencies across pages
- Check readability at all sizes
- Ensure monospace code sections are well-differentiated

**ASK ME:** "Phase 2 complete — structural changes. Here's what changed [screenshots]. Does this feel right? Any adjustments before we move to visual identity?"

## Phase 3: Visual Identity

### Step 3a: Colorize
Run `/colorize` to evaluate and improve color usage:
- Is the copper accent used effectively and sparingly (per design system rules)?
- Are status colors clear and distinguishable?
- Does the palette feel warm and intentional, not generic?
- Dark/light theme color balance

### Step 3b: Intensity Direction
**ASK ME:** "Should we go `/bolder` (more visual impact, stronger personality) or `/quieter` (more refined, calmer aesthetic)? Or is the current intensity right?"
Then run the chosen skill.

### Step 3c: Clarify
Run `/clarify` to improve all UX copy:
- Empty state messages
- Error messages
- Button labels and CTAs
- Section headings
- Setup wizard instructions
- Tooltip text
- **ASK ME** about tone — should copy be more technical/operator-focused or more friendly?

**ASK ME:** "Phase 3 complete — visual identity changes. [Screenshots]. How does the personality feel now?"

## Phase 4: Production Hardening

### Step 4a: Harden
Run `/harden` for production resilience:
- Text overflow handling across all components
- Error state UI for API failures, SSE disconnects, timeouts
- Edge cases: very long issue titles, empty data, rate-limited state, 100+ items
- Loading states and skeleton screens
- Graceful degradation

### Step 4b: Adapt
Run `/adapt` for responsive design:
- Mobile layout (320px-768px) — especially sidebar drawer, kanban board, overview grid
- Tablet layout (768px-1024px)
- Large desktop (1440px+)
- Test all container query breakpoints in `frontend/src/styles/container-queries.css`
- Touch target sizes on mobile

### Step 4c: Onboard
Run `/onboard` to improve first-run experience:
- Setup wizard flow (via `/setup` and `/welcome` pages)
- Empty states on every page before data exists
- Getting-started guidance on the overview page
- Progressive disclosure of advanced features

**ASK ME:** "Phase 4 complete — production hardening. The app should now handle edge cases gracefully. [Screenshots of error states, mobile views, empty states]. Anything missing?"

## Phase 5: Delight Layer

### Step 5a: Animate
Run `/animate` to add purposeful micro-interactions:
- Page transitions (existing `frontend/src/ui/page-motion.ts` — enhance if needed)
- Card hover/focus states
- Status change animations (issue state transitions)
- Loading → loaded transitions
- Metric counter animations
- Respect `prefers-reduced-motion`
- Use existing motion tokens: `--motion-instant` (120ms), `--motion-fast` (180ms), `--motion-medium` (260ms), `--motion-slow` (420ms), `--ease-out-quart`, `--ease-out-quint`, `--ease-out-expo`

### Step 5b: Delight
Run `/delight` to add personality:
- Success states (issue completed, PR merged)
- Empty states with character
- Satisfying interactions (drag-drop on kanban, dismiss toast)
- Subtle touches that reward engagement
- **Nothing that blocks workflow** — per `.impeccable.md`: "Never decorative animation. Motion should reflect real state."

**ASK ME:** "Phase 5 complete — delight layer. [Screenshots/descriptions of animations]. Too much? Too subtle? Any specific interactions you want enhanced or removed?"

## Phase 6: System Consolidation

### Step 6a: Normalize
Run `/normalize` to realign everything to the design system:
- Verify all changes use existing design tokens (no magic numbers)
- Typography scale compliance
- Spacing scale compliance
- Color token usage (no raw hex values outside `design-system.css`/`tokens.css`)
- Component pattern consistency

### Step 6b: Extract
Run `/extract` to consolidate reusable patterns:
- Any new component patterns that emerged during enhancement
- Design tokens that should be formalized
- CSS that can be DRYed up across the 36 CSS files

### Step 6c: Optimize
Run `/optimize` for performance:
- CSS bundle analysis (36 CSS files — any that can merge?)
- Font loading strategy (Space Grotesk, Manrope, IBM Plex Mono)
- Animation performance (GPU-accelerated transforms only)
- SSE/polling efficiency on the UI side
- Skeleton/loading perceived performance

**ASK ME:** "Phase 6 complete — system consolidated. Design system is tight. Performance optimized. Ready for final polish?"

## Phase 7: Final Polish & Verification

### Step 7a: Polish
Run `/polish` as the absolute final pass:
- Pixel-level alignment
- Spacing consistency
- Typography micro-adjustments
- Color/contrast final check
- Interaction state completeness (hover, focus, active, disabled)
- Icon consistency
- Form field consistency
- Edge case presentation

### Step 7b: After Screenshots
Use agent-browser to take the same screenshots as baseline (all 17 pages, both themes). Save in `screenshots/after/`.

### Step 7c: Visual Diff
Present a before/after comparison for each page. Highlight the most impactful changes.

### Step 7d: Test Suite
Run the full verification:
```bash
pnpm run build && pnpm run lint && pnpm run format:check && pnpm test
pnpm exec playwright test --project=smoke
```
If visual baselines need updating, **ASK ME** before running `--update-snapshots`.

### Step 7e: Final Report
**ASK ME** with a final summary:
- Critique score improvement (before vs after)
- Audit score improvement
- List of all changes by page
- Any remaining items for a future pass
- "Ready to ship v1.0?"

## Technical Context

- **Stack**: Vanilla TypeScript SPA, Vite 8, pure CSS with design tokens, ESM
- **Routes**: 15 core pages (20 total route registrations including aliases and parameterized sub-routes)
- **Design system**: Copper accent, zero-radius stitch, Space Grotesk + Manrope + IBM Plex Mono
- **CSS**: 36 files in `frontend/src/styles/`, design tokens in `design-system.css` + `tokens.css` + `polish-tokens.css`
- **Components**: 22 component modules in `frontend/src/components/`
- **Views**: 48 view modules in `frontend/src/views/`
- **UI/Shell**: 23 modules in `frontend/src/ui/` (includes page-motion, theme, sidebar, shell)
- **Pages**: 26 page modules in `frontend/src/pages/`
- **Tests**: 121 E2E smoke tests across 17 specs, 7 visual regression baselines across 4 specs
- **Dev server**: `pnpm run dev -- --port 4000` → backend on 4000, Vite frontend on `http://localhost:5173`
- **Verify**: `pnpm run build && pnpm run lint && pnpm run format:check && pnpm test`

## Rules

- Never bypass pre-commit or pre-push hooks.
- Never modify `design-system.css` or `tokens.css` token values without asking me first.
- Never remove functionality — this is a UX enhancement pass, not a feature cut.
- Always preserve dark/light theme parity.
- Always maintain WCAG AA contrast compliance.
- If a skill's suggestions conflict with `.impeccable.md` or the existing design system, ask me which to follow.
- Use conventional commits: `feat(ui):`, `fix(ui):`, `refactor(ui):`, `style(ui):`.
- After any CSS or view file changes, run `pnpm exec playwright test --project=smoke` before moving on.
