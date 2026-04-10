---
paths:
  - "src/**/*"
  - "frontend/**/*"
---

# TypeScript Code Quality

## String & Array Methods

- `replaceAll()` not `.replace(/pattern/g)` for global replacements
- `.at(-1)` for last-element access, not `arr[arr.length - 1]`
- `Array.from()` or spread over `Array.prototype.slice.call()`

## Type Safety

- `unknown` not `any` for external input — narrow with type guards
- `interface` over intersection types (`type Foo = Bar & Baz`) for composition — interfaces are cached by the compiler, intersections are not
- Annotate return types on exported functions — reduces compiler workload and produces cleaner `.d.ts`
- Avoid union types with 12+ members — comparison is quadratic; use a base type with inheritance
- Prefer `undefined` over `null` consistently across the codebase

## Export Discipline

- Don't export types or functions unless used across multiple modules
- Prefer named exports — avoid default exports

## Naming

- Complete words over abbreviations (`notification` not `notif`, `configuration` not `cfg`)
- Exception: well-established abbreviations (`id`, `url`, `api`, `db`, `config` as a type name)

## Logging & Console

- No `console.log` in production source — use pino logger via `LoggerPort`
- `console.log` is acceptable in test files and scripts only
