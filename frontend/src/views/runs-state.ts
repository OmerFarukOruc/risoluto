import type { AttemptRecord, AttemptSummary } from "../types";

export type SortableColumn = "run" | "status" | "started" | "duration" | "model" | "appserver" | "tokens";
export type SortDirection = "asc" | "desc";

function compareAttempts(left: AttemptSummary, right: AttemptSummary): number {
  const leftLive = left.endedAt === null;
  const rightLive = right.endedAt === null;
  if (leftLive !== rightLive) {
    return leftLive ? -1 : 1;
  }
  const leftStarted = Date.parse(left.startedAt ?? "") || 0;
  const rightStarted = Date.parse(right.startedAt ?? "") || 0;
  if (leftStarted !== rightStarted) {
    return rightStarted - leftStarted;
  }
  return (right.attemptNumber ?? 0) - (left.attemptNumber ?? 0);
}

function durationSeconds(attempt: AttemptSummary): number {
  const start = Date.parse(attempt.startedAt ?? "") || 0;
  const end = Date.parse(attempt.endedAt ?? "") || 0;
  if (!start || !end) {
    return 0;
  }
  return (end - start) / 1000;
}

function sortValue(attempt: AttemptSummary, column: SortableColumn): number | string {
  switch (column) {
    case "run":
      return attempt.attemptNumber ?? 0;
    case "status":
      return attempt.status ?? "";
    case "started":
      return Date.parse(attempt.startedAt ?? "") || 0;
    case "duration":
      return durationSeconds(attempt);
    case "model":
      return (attempt.model ?? "").toLowerCase();
    case "appserver":
      return (attempt.appServerBadge?.effectiveProvider ?? "").toLowerCase();
    case "tokens":
      return attempt.tokenUsage?.totalTokens ?? 0;
  }
}

function applySort(state: RunsState): void {
  if (state.sortColumn === null) {
    state.attempts.sort(compareAttempts);
  } else {
    const column = state.sortColumn;
    const direction = state.sortDirection === "asc" ? 1 : -1;
    state.attempts.sort((left, right) => {
      const leftValue = sortValue(left, column);
      const rightValue = sortValue(right, column);
      if (leftValue < rightValue) {
        return -direction;
      }
      if (leftValue > rightValue) {
        return direction;
      }
      return 0;
    });
  }
  if (state.activeAttemptId) {
    const index = state.attempts.findIndex((attempt) => attempt.attemptId === state.activeAttemptId);
    if (index !== -1) {
      state.focusIndex = index;
    }
  }
}

export interface RunsState {
  issueIdentifier: string;
  issueTitle: string;
  issueStatus: string | null;
  attempts: AttemptSummary[];
  currentAttemptId: string | null;
  activeAttemptId: string | null;
  focusIndex: number;
  compareAttemptIds: string[];
  loading: boolean;
  detailLoadingId: string | null;
  error: string | null;
  details: Map<string, AttemptRecord>;
  sortColumn: SortableColumn | null;
  sortDirection: SortDirection;
}

export function createRunsState(issueIdentifier: string): RunsState {
  return {
    issueIdentifier,
    issueTitle: issueIdentifier,
    issueStatus: null,
    attempts: [],
    currentAttemptId: null,
    activeAttemptId: null,
    focusIndex: 0,
    compareAttemptIds: [],
    loading: true,
    detailLoadingId: null,
    error: null,
    details: new Map<string, AttemptRecord>(),
    sortColumn: null,
    sortDirection: "desc",
  };
}

export function setRunsData(
  state: RunsState,
  payload: {
    issueIdentifier: string;
    issueTitle: string;
    issueStatus?: string | null;
    currentAttemptId: string | null;
    attempts: AttemptSummary[];
  },
): void {
  state.issueIdentifier = payload.issueIdentifier;
  state.issueTitle = payload.issueTitle;
  state.issueStatus = payload.issueStatus ?? null;
  state.currentAttemptId = payload.currentAttemptId;
  state.attempts = [...payload.attempts];
  applySort(state);
  state.loading = false;
  state.error = null;
  state.compareAttemptIds = state.compareAttemptIds.filter((attemptId) =>
    state.attempts.some((attempt) => attempt.attemptId === attemptId),
  );
  if (!state.activeAttemptId || !state.attempts.some((attempt) => attempt.attemptId === state.activeAttemptId)) {
    state.activeAttemptId = state.attempts[0]?.attemptId ?? null;
  }
  state.focusIndex = Math.max(
    0,
    state.attempts.findIndex((attempt) => attempt.attemptId === state.activeAttemptId),
  );
}

export function cycleSortColumn(state: RunsState, column: SortableColumn): void {
  if (state.sortColumn !== column) {
    state.sortColumn = column;
    state.sortDirection = "asc";
  } else if (state.sortDirection === "asc") {
    state.sortDirection = "desc";
  } else {
    state.sortColumn = null;
    state.sortDirection = "desc";
  }
  applySort(state);
}

export function setRunsError(state: RunsState, message: string): void {
  state.loading = false;
  state.error = message;
}

export function activeAttempt(state: RunsState): AttemptSummary | null {
  return state.attempts.find((attempt) => attempt.attemptId === state.activeAttemptId) ?? null;
}

export function comparedAttempts(state: RunsState): AttemptSummary[] {
  return state.compareAttemptIds
    .map((attemptId) => state.attempts.find((attempt) => attempt.attemptId === attemptId) ?? null)
    .filter((attempt): attempt is AttemptSummary => Boolean(attempt));
}

export function activeAttemptDetail(state: RunsState): AttemptRecord | null {
  if (!state.activeAttemptId) {
    return null;
  }
  return state.details.get(state.activeAttemptId) ?? null;
}

export function setActiveAttempt(state: RunsState, attemptId: string): void {
  const index = state.attempts.findIndex((attempt) => attempt.attemptId === attemptId);
  if (index === -1) {
    return;
  }
  state.activeAttemptId = attemptId;
  state.focusIndex = index;
}

export function moveActiveAttempt(state: RunsState, direction: -1 | 1): AttemptSummary | null {
  if (state.attempts.length === 0) {
    return null;
  }
  const nextIndex = Math.min(Math.max(state.focusIndex + direction, 0), state.attempts.length - 1);
  state.focusIndex = nextIndex;
  state.activeAttemptId = state.attempts[nextIndex]?.attemptId ?? null;
  return state.attempts[nextIndex] ?? null;
}

export function toggleCompareAttempt(state: RunsState, attemptId: string): boolean {
  if (state.compareAttemptIds.includes(attemptId)) {
    state.compareAttemptIds = state.compareAttemptIds.filter((selectedId) => selectedId !== attemptId);
    return true;
  }
  if (state.compareAttemptIds.length >= 2) {
    return false;
  }
  state.compareAttemptIds = [...state.compareAttemptIds, attemptId];
  return true;
}

export function clearComparedAttempts(state: RunsState): void {
  state.compareAttemptIds = [];
}

export function setAttemptDetail(state: RunsState, detail: AttemptRecord): void {
  state.details.set(detail.attemptId, detail);
  state.detailLoadingId = state.detailLoadingId === detail.attemptId ? null : state.detailLoadingId;
}

export function shouldLoadActiveDetail(state: RunsState): boolean {
  return Boolean(state.activeAttemptId && !state.details.has(state.activeAttemptId));
}
