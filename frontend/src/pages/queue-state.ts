import type { RuntimeIssueView, WorkflowColumn } from "../types";
import { matchesIssueSearch, modelInitials, normalizePriority, repoOf, retryCountOf } from "../utils/issues";

export { modelInitials, repoOf, retryCountOf };

export interface QueueFilters {
  search: string;
  priority: string;
  model: string;
  repo: string;
  labels: Set<string>;
}

export interface QueueUiState {
  focusedColumn: number;
  focusedCard: number;
  collapsed: Set<string>;
  selected: Set<string>;
}

export function createFilters(): QueueFilters {
  return {
    search: "",
    priority: "all",
    model: "all",
    repo: "all",
    labels: new Set<string>(),
  };
}

export function isDefaultFilters(filters: QueueFilters): boolean {
  return (
    filters.search === "" &&
    filters.priority === "all" &&
    filters.model === "all" &&
    filters.repo === "all" &&
    filters.labels.size === 0
  );
}

export function hasActiveFilters(filters: QueueFilters): boolean {
  return (
    filters.search !== "" ||
    filters.priority !== "all" ||
    filters.model !== "all" ||
    filters.repo !== "all" ||
    filters.labels.size > 0
  );
}

export function createUiState(_columns: WorkflowColumn[]): QueueUiState {
  return {
    focusedColumn: 0,
    focusedCard: 0,
    collapsed: new Set<string>(),
    selected: new Set<string>(),
  };
}

export function filterColumn(column: WorkflowColumn, filters: QueueFilters): RuntimeIssueView[] {
  const issues = column.issues ?? [];
  return issues.filter((issue) => {
    if (filters.priority !== "all" && normalizePriority(issue.priority) !== filters.priority) {
      return false;
    }
    if (filters.model !== "all" && (issue.model ?? "") !== filters.model) {
      return false;
    }
    if (filters.repo !== "all" && repoOf(issue) !== filters.repo) {
      return false;
    }
    if (filters.labels.size > 0) {
      const issueLabels = new Set(issue.labels ?? []);
      for (const wanted of filters.labels) {
        if (!issueLabels.has(wanted)) return false;
      }
    }
    return matchesIssueSearch(issue, filters.search);
  });
}
