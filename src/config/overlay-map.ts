import { isRecord } from "../utils/type-guards.js";

export interface ConfigOverlayEntry {
  path: string;
  value: unknown;
}

const dangerousKeys = new Set(["__proto__", "constructor", "prototype"]);

export function isDangerousKey(key: string): boolean {
  return dangerousKeys.has(key);
}

export function normalizeOverlayPath(pathExpression: string): string[] {
  return pathExpression
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function createOverlayRecord(): Record<string, unknown> {
  return Object.create(null) as Record<string, unknown>;
}

function sortForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableStringify);
  }
  if (!isRecord(value)) {
    return value;
  }

  const sorted = createOverlayRecord();
  for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
    sorted[key] = sortForStableStringify(value[key]);
  }
  return sorted;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableStringify(value));
}

export function isOverlayEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

export function removeOverlayValue(target: Record<string, unknown>, segments: string[]): boolean {
  if (segments.length === 0) {
    return false;
  }

  const [head, ...tail] = segments;
  if (isDangerousKey(head)) {
    throw new TypeError(`Refusing to traverse dangerous key: ${head}`);
  }
  if (head === "__proto__" || head === "constructor" || head === "prototype") {
    return false;
  }
  if (tail.length === 0) {
    if (!Object.hasOwn(target, head)) {
      return false;
    }
    delete target[head];
    return true;
  }

  const child = Object.hasOwn(target, head) ? target[head] : undefined;
  if (!isRecord(child)) {
    return false;
  }

  const removed = removeOverlayValue(child, tail);
  if (removed && Object.keys(child).length === 0) {
    delete target[head];
  }
  return removed;
}

export function setOverlayValue(target: Record<string, unknown>, segments: string[], value: unknown): void {
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index];
    if (isDangerousKey(key)) {
      throw new TypeError(`Refusing to traverse dangerous key: ${key}`);
    }
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return;
    }
    const child = Object.hasOwn(cursor, key) ? cursor[key] : undefined;
    if (!isRecord(child)) {
      const next = createOverlayRecord();
      cursor[key] = next;
      cursor = next;
      continue;
    }
    cursor = child;
  }

  const leafKey = segments.at(-1);
  if (leafKey === undefined) {
    throw new Error("overlay path must contain at least one segment");
  }
  if (isDangerousKey(leafKey)) {
    throw new TypeError(`Refusing to set dangerous key: ${leafKey}`);
  }
  if (leafKey === "__proto__" || leafKey === "constructor" || leafKey === "prototype") {
    return;
  }
  cursor[leafKey] = value;
}

function collectOverlayEntries(value: unknown, prefix: string, entries: ConfigOverlayEntry[]): void {
  if (Array.isArray(value) || !isRecord(value)) {
    if (prefix.length > 0) {
      entries.push({ path: prefix, value: structuredClone(value) });
    }
    return;
  }

  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  if (keys.length === 0) {
    if (prefix.length > 0) {
      entries.push({ path: prefix, value: {} });
    }
    return;
  }

  for (const key of keys) {
    if (isDangerousKey(key)) {
      continue;
    }
    const nextPrefix = prefix.length > 0 ? `${prefix}.${key}` : key;
    collectOverlayEntries(value[key], nextPrefix, entries);
  }
}

export function flattenOverlayMap(map: Record<string, unknown>): ConfigOverlayEntry[] {
  const entries: ConfigOverlayEntry[] = [];
  collectOverlayEntries(map, "", entries);
  return entries;
}

export function buildOverlayMap(entries: ConfigOverlayEntry[]): Record<string, unknown> {
  const overlay = createOverlayRecord();
  for (const entry of entries) {
    const segments = normalizeOverlayPath(entry.path);
    if (segments.length === 0) {
      continue;
    }
    setOverlayValue(overlay, segments, structuredClone(entry.value));
  }
  return overlay;
}
