/**
 * Sorted, deduped log buffer for real-time log streaming.
 * Events are kept in timestamp order (configurable direction).
 * New events are inserted at the correct position via binary search.
 */

import type { RecentEvent } from "../types.js";

export type SortDirection = "desc" | "asc";

export interface LogBuffer {
  events(): RecentEvent[];
  insert(event: RecentEvent): boolean;
  load(events: RecentEvent[]): void;
  setDirection(direction: SortDirection): void;
  direction(): SortDirection;
  size(): number;
}

function eventKey(e: RecentEvent): string {
  return `${e.at}|${e.event}|${e.message}|${e.session_id ?? ""}`;
}

export function createLogBuffer(initialDirection: SortDirection = "desc"): LogBuffer {
  let dir = initialDirection;
  const items: RecentEvent[] = [];
  const seen = new Set<string>();

  function compare(a: RecentEvent, b: RecentEvent): number {
    const cmp = a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
    return dir === "desc" ? -cmp : cmp;
  }

  function binaryInsertIndex(event: RecentEvent): number {
    let lo = 0;
    let hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (compare(items[mid], event) <= 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  return {
    events: () => items,
    insert(event) {
      const key = eventKey(event);
      if (seen.has(key)) return false;
      seen.add(key);
      const idx = binaryInsertIndex(event);
      items.splice(idx, 0, event);
      return true;
    },
    load(events) {
      for (const e of events) {
        const key = eventKey(e);
        if (!seen.has(key)) {
          seen.add(key);
          items.push(e);
        }
      }
      items.sort(compare);
    },
    setDirection(newDir) {
      if (newDir === dir) return;
      dir = newDir;
      items.sort(compare);
    },
    direction: () => dir,
    size: () => items.length,
  };
}
