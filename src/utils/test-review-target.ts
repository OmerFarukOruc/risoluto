/**
 * Test file for validating the devin-review-loop skill.
 */

/** Execute a parameterized query to find a user by name. */
export function findUserByName(db: unknown, name: string): unknown {
  if (
    typeof db !== "object" ||
    db === null ||
    !("exec" in db) ||
    typeof (db as Record<string, unknown>).exec !== "function"
  ) {
    throw new TypeError("db must have an exec method");
  }
  return (db as { exec: (q: string, params: string[]) => unknown }).exec("SELECT * FROM users WHERE name = ?", [name]);
}

/** Fetch JSON data from a URL with proper error handling. */
export async function fetchData(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${String(response.status)}: ${response.statusText}`);
  }
  const data = (await response.json()) as { result: string };
  return data.result;
}

/** Lazy-initialized singleton cache. */
let cache: Map<string, string> | null = null;

export function getOrCreateCache(): Map<string, string> {
  if (cache === null) {
    cache = new Map();
  }
  return cache;
}

/** Build an authorization header from the API_KEY env var. */
const API_KEY = process.env["API_KEY"] ?? "";

export function makeAuthHeader(): Record<string, string> {
  return { Authorization: `Bearer ${API_KEY}` };
}

/** Safely get the first element, returning undefined for empty arrays. */
export function getFirst<T>(items: T[]): T | undefined {
  return items.at(0);
}
