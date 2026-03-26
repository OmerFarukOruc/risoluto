import { type AttemptRecord, type AttemptSummary, type IssueDetail } from "../../../../frontend/src/types.js";

export type AttemptsResponse = Readonly<{
  attempts: AttemptSummary[];
  current_attempt_id: string | null;
}>;

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body = (await response.text()) || `${response.status} ${response.statusText}`;
    throw new Error(body);
  }
  return (await response.json()) as T;
}

export function fetchIssueDetail(issueIdentifier: string): Promise<IssueDetail> {
  return fetchJson<IssueDetail>(`/api/v1/${encodeURIComponent(issueIdentifier)}`);
}

export function fetchIssueAttempts(issueIdentifier: string): Promise<AttemptsResponse> {
  return fetchJson<AttemptsResponse>(`/api/v1/${encodeURIComponent(issueIdentifier)}/attempts`);
}

export function fetchAttemptDetail(attemptId: string): Promise<AttemptRecord> {
  return fetchJson<AttemptRecord>(`/api/v1/attempts/${encodeURIComponent(attemptId)}`);
}

export function postModelOverride(
  issueIdentifier: string,
  payload: Readonly<{ model: string; reasoningEffort: string }>,
): Promise<unknown> {
  return fetchJson(`/api/v1/${encodeURIComponent(issueIdentifier)}/model`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: payload.model.trim(),
      reasoning_effort: payload.reasoningEffort || null,
    }),
  });
}
