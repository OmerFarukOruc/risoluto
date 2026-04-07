# Surface Manifest

- Target: <url>
- Mode: headed desktop
- Viewport: 2560x1440
- Auth context: <anon|user|admin|custom>
- Discovery date: <yyyy-mm-dd>

## Summary

- Total surfaces discovered: 0
- Executable surfaces: 0
- Passed: 0
- Failed: 0
- Blocked: 0
- Skipped: 0

## Surface Inventory

### SURFACE-001

- surface_id: `SURFACE-001`
- parent_surface: `ROOT`
- entry_url: `<url>`
- entry_action: `initial load`
- surface_type: `route | panel | modal | menu | table | form | tab | drawer | popover | flow`
- auth_role: `anon | user | admin | custom`
- states:
  - default: `pending`
  - empty: `N/A`
  - loading: `pending`
  - populated: `pending`
  - invalid: `N/A`
  - success: `N/A`
  - error: `pending`
- interactions:
  - `<interaction 1>`
  - `<interaction 2>`
  - `<interaction 3>`
- child_surfaces:
  - `<child surface id>`
- evidence_paths:
  - `screenshots/<file>.png`
  - `videos/<file>.webm`
- status: `PASS | FAIL | BLOCKED | SKIPPED | PENDING`
- notes: `<what made this surface tricky or important>`

### SURFACE-002

- surface_id: `SURFACE-002`
- parent_surface: `SURFACE-001`
- entry_url: `<url>`
- entry_action: `<click/open/select/etc>`
- surface_type: `<type>`
- auth_role: `<role>`
- states:
  - default: `pending`
  - empty: `N/A`
  - loading: `N/A`
  - populated: `pending`
  - invalid: `N/A`
  - success: `N/A`
  - error: `pending`
- interactions:
  - `<interaction 1>`
- child_surfaces:
  - `<child surface id>`
- evidence_paths:
  - `screenshots/<file>.png`
- status: `PASS | FAIL | BLOCKED | SKIPPED | PENDING`
- notes: `<notes>`

## Graph Edges

- `SURFACE-001 -> SURFACE-002` via `<interaction>`

## Coverage Gaps

- `<surface-id>`: `<blocked or skipped reason>`

