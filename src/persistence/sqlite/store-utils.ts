/**
 * Shared helpers for SQLite-backed time-series stores.
 *
 * `clampLimit` is the canonical limit-normaliser used by both the cost
 * sample store and the health probe sample store — keep new ring-buffer
 * stores using this rather than rolling their own bounds.
 */

const DEFAULT_LIMIT = 64;
const MAX_LIMIT = 4096;

/** Normalises a caller-supplied limit to a sane bounded integer. */
export function clampLimit(limit: number | undefined, defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT): number {
  if (limit === undefined) return defaultLimit;
  if (!Number.isFinite(limit) || limit <= 0) return defaultLimit;
  return Math.min(Math.floor(limit), maxLimit);
}
