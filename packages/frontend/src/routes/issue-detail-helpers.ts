import { type AttemptSummary, type IssueDetail, type RecentEvent } from "../../../../frontend/src/types.js";

export function stringifyEventContent(content: unknown): string | null {
  if (content === null || content === undefined) {
    return null;
  }
  if (typeof content === "string") {
    return content;
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

export function detailUpdatedAt(detail: IssueDetail): string | null {
  return detail.updated_at ?? detail.updatedAt;
}

export function selectedAttemptFrom(
  attempts: AttemptSummary[],
  currentAttemptId: string | null,
  selectedAttemptId: string | null,
): string | null {
  if (selectedAttemptId && attempts.some((attempt) => attempt.attemptId === selectedAttemptId)) {
    return selectedAttemptId;
  }
  if (currentAttemptId && attempts.some((attempt) => attempt.attemptId === currentAttemptId)) {
    return currentAttemptId;
  }
  return attempts[0]?.attemptId ?? null;
}

export function statusLabel(status: string): string {
  return status.replaceAll(/[_-]/g, " ");
}

export function eventKey(event: RecentEvent): string {
  return [event.at, event.event, event.session_id ?? "", event.issue_id, event.message].join("|");
}
