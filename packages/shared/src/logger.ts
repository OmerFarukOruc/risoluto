/**
 * Structured logger interface used throughout Symphony.
 *
 * All call sites pass metadata as the first argument and an optional
 * human-readable message as the second.  Implementations must accept
 * both `(string)` and `(Record<string, unknown>, string?)` call styles.
 */
export type { SymphonyLogger } from "../../../src/core/types.js";
