import type { RuntimeSnapshot } from "../types";

export interface HeaderStatusCounts {
  running: number;
  queued: number;
  retrying: number;
}

export type HeaderStatusKey = keyof HeaderStatusCounts;

const ZERO: HeaderStatusCounts = { running: 0, queued: 0, retrying: 0 };

export function computeHeaderStatusCounts(snapshot: RuntimeSnapshot | null): HeaderStatusCounts {
  if (!snapshot) {
    return { ...ZERO };
  }
  return {
    running: (snapshot.running ?? []).length,
    queued: (snapshot.queued ?? []).length,
    retrying: (snapshot.retrying ?? []).length,
  };
}

export function totalHeaderStatusCount(counts: HeaderStatusCounts): number {
  return counts.running + counts.queued + counts.retrying;
}
