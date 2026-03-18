/**
 * Primitive type coercion helpers for config normalization.
 *
 * These utilities safely coerce unknown values to typed primitives
 * with sensible fallbacks. All functions are pure and stateless.
 */

/**
 * Coerce an unknown value to a record (plain object).
 * Returns empty object for non-objects, null, or arrays.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Coerce an unknown value to a string.
 * Returns fallback for non-string values.
 */
export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Coerce an unknown value to a finite number.
 * Returns fallback for non-numbers or non-finite values.
 */
export function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Coerce an unknown value to a boolean.
 * Returns fallback for non-boolean values.
 */
export function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Coerce an unknown value to a string-to-string map.
 * Filters out non-string values from object entries.
 */
export function asStringMap(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

/**
 * Coerce an unknown value to a string-to-number map.
 * Filters out non-number or non-finite values from object entries.
 */
export function asNumberMap(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
}

/**
 * Coerce an unknown value to a string array.
 * Filters out non-string values and empty strings.
 * Returns fallback if result is empty or input wasn't an array.
 */
export function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const values = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return values.length > 0 ? values : fallback;
}

/**
 * Coerce an unknown value to an array of records.
 * Filters out non-object values, nulls, and arrays from the input array.
 */
export function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item),
    )
    .map((item) => item);
}

/**
 * Coerce an unknown array to a string array, filtering non-strings.
 * Unlike asStringArray, this does not require non-empty strings
 * and does not use a fallback.
 */
export function asLooseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => typeof v === "string");
}
