import type { Issue } from "../core/types.js";
import type { LinearClient } from "../linear/client.js";
import type { TrackerIssueCreateInput, TrackerIssueCreateResult, TrackerPort } from "./port.js";

export class LinearTrackerAdapter implements TrackerPort {
  constructor(private readonly client: LinearClient) {}

  fetchCandidateIssues(): Promise<Issue[]> {
    return this.client.fetchCandidateIssues();
  }

  fetchIssueStatesByIds(ids: string[]): Promise<Issue[]> {
    return this.client.fetchIssueStatesByIds(ids);
  }

  fetchIssuesByStates(states: string[]): Promise<Issue[]> {
    return this.client.fetchIssuesByStates(states);
  }

  resolveStateId(stateName: string): Promise<string | null> {
    return this.client.resolveStateId(stateName);
  }

  updateIssueState(issueId: string, stateId: string): Promise<void> {
    return this.client.updateIssueState(issueId, stateId);
  }

  createComment(issueId: string, body: string): Promise<void> {
    return this.client.createComment(issueId, body);
  }

  createIssue(input: TrackerIssueCreateInput): Promise<TrackerIssueCreateResult> {
    return this.client.createIssue({
      title: input.title,
      description: input.description ?? null,
      stateName: input.stateName ?? null,
    });
  }

  async transitionIssue(issueId: string, stateId: string): Promise<{ success: boolean }> {
    try {
      await this.client.updateIssueStateStrict(issueId, stateId);
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}
