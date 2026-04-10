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

## Patterns & Style

- Prefer string literal unions over `enum` unless interop requires it
- `TypeError` for type/validation violations, not `Error`
- Never union `unknown` with other types — `unknown | null` is just `unknown`
- Remove unnecessary `as SomeType` assertions when TypeScript infers correctly
- Prevent `[object Object]` in template literals — check `typeof` or use `JSON.stringify()`
- Batch consecutive `Array#push()` calls: `push(a, b, c)` not three separate calls
- Name catch parameters `error` or `error_` (when shadowing outer `error`)
- Test positive conditions first: `if (x === undefined)` not negated-then-else
- Top-level `await` in ESM entry points: `process.exitCode = await main()` not `.then()`
- Remove deprecated type aliases immediately — migrate all call sites in the same PR

## Regex

- `\w` instead of `[A-Za-z0-9_]`
- Avoid duplicate characters in classes: `\w` includes `_`, so `[\w._-]` → `[\w.-]`

## Immutability

- Spread operator for immutable updates: `{ ...obj, field: newValue }`
- `Readonly<T>` on function parameters when the function should not mutate input

## Validation

- Zod for schema-based validation — infer types from schemas: `type T = z.infer<typeof schema>`
- Validate at system boundaries (HTTP handlers, config parsing, external input), not internal calls

## Logging & Console

- No `console.log` in production source — use pino logger via `LoggerPort`
- `console.log` is acceptable in test files and scripts only
