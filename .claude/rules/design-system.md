---
paths:
  - "frontend/**/*"
---

# Design System Reference

Full token definitions, component vocabulary, and brand guidelines are in `.impeccable.md` at the repo root. Read it before any UI work.

## Key Conventions

- **Component classes**: `mc-*` prefix (e.g., `mc-card`, `mc-badge`, `mc-button`)
- **Brand color**: copper `#c96e4a` — used for primary actions and brand accents
- **Typography**: Manrope (headings), IBM Plex Mono (code/data), Space Grotesk (stats)
- **Themes**: light and dark are both first-class — never hardcode colors
- **Tokens**: all values defined as CSS custom properties

## Status Colors

Use semantic color tokens, not raw values:

| Token | Usage |
|---|---|
| `var(--status-running)` | In-progress state |
| `var(--status-success)` | Completed successfully |
| `var(--status-error)` | Failed state |
| `var(--status-warning)` | Degraded/warning state |
| `var(--status-queued)` | Waiting in queue |
| `var(--status-stalled)` | Stall detected |
| `var(--status-cancelled)` | Cancelled by user |

## Design Principles

1. **Transparent** — show what the system is doing, not a polished facade
2. **Partnered** — the UI is a co-pilot's console, not a passive dashboard
3. **Alive** — real-time updates, SSE streams, subtle motion for state changes
