---
paths:
  - "frontend/**/*"
---

# Frontend Conventions

## Design System

Full token definitions, component vocabulary, and brand guidelines are in `.impeccable.md` at the repo root. Read it before any UI work.

## Component Classes

All component classes use the `mc-*` prefix (e.g., `mc-card`, `mc-badge`, `mc-button`). Never introduce unprefixed component classes.

## CSS

- Use CSS custom properties for all color, spacing, and typography values — no hardcoded values
- Status colors use semantic tokens: `var(--status-running)`, `var(--status-success)`, `var(--status-error)`, `var(--status-warning)`
- Light and dark themes are both first-class — test both when modifying colors

## State Management

- URL state for navigation and filters (router params)
- Module-level state for view-scoped data
- SSE for real-time updates from the backend

## React 19

- Functional components only — no class components
- Prefer composition over prop drilling
- Custom hooks for shared stateful logic — prefix with `use`
- Define component props with a named `interface` — do not use `React.FC`
- Type callback props explicitly: `onSelect: (id: string) => void`
