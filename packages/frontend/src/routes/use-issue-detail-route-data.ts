import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  type AttemptRecord,
  type AttemptSummary,
  type IssueDetail,
  type RecentEvent,
} from "../../../../frontend/src/types.js";
import { queryKeys } from "../hooks/query-client.js";
import { fetchAttemptDetail, fetchIssueAttempts, fetchIssueDetail, postModelOverride } from "./issue-detail-api.js";
import { type AttemptsResponse } from "./issue-detail-api.js";
import { selectedAttemptFrom } from "./issue-detail-helpers.js";

type UseIssueDetailRouteDataResult = Readonly<{
  issueQuery: UseQueryResult<IssueDetail, Error>;
  attemptsQuery: UseQueryResult<AttemptsResponse, Error>;
  attempts: AttemptSummary[];
  selectedAttemptId: string | null;
  selectedAttempt: AttemptSummary | null;
  events: RecentEvent[];
  model: string;
  reasoningEffort: string;
  saveMutation: UseMutationResult<unknown, Error, void, unknown>;
  eventError: string | null;
  setSelectedAttemptId: (attemptId: string | null) => void;
  setModelValue: (value: string) => void;
  setReasoningEffortValue: (value: string) => void;
  submitModelOverride: () => Promise<void>;
}>;

export function useIssueDetailRouteData(issueIdentifier: string): UseIssueDetailRouteDataResult {
  const queryClient = useQueryClient();
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("");
  const [formDirty, setFormDirty] = useState(false);

  const issueQuery = useQuery({
    queryKey: queryKeys.issue(issueIdentifier),
    queryFn: () => fetchIssueDetail(issueIdentifier),
    enabled: issueIdentifier.length > 0,
    staleTime: 4_000,
    gcTime: 300_000,
  });

  const attemptsQuery = useQuery<AttemptsResponse, Error>({
    queryKey: queryKeys.issueAttemptsFor(issueIdentifier),
    queryFn: () => fetchIssueAttempts(issueIdentifier),
    enabled: issueIdentifier.length > 0,
    staleTime: 4_000,
    gcTime: 300_000,
  });

  const attempts = attemptsQuery.data?.attempts ?? issueQuery.data?.attempts ?? [];
  const currentAttemptId = attemptsQuery.data?.current_attempt_id ?? issueQuery.data?.currentAttemptId ?? null;

  useEffect(() => {
    setSelectedAttemptId((current) => selectedAttemptFrom(attempts, currentAttemptId, current));
  }, [attempts, currentAttemptId]);

  useEffect(() => {
    if (issueQuery.data === undefined || formDirty) {
      return;
    }
    setModel(issueQuery.data.configuredModel ?? issueQuery.data.model ?? "");
    setReasoningEffort(issueQuery.data.configuredReasoningEffort ?? issueQuery.data.reasoningEffort ?? "");
  }, [formDirty, issueQuery.data]);

  const attemptQuery = useQuery<AttemptRecord>({
    queryKey: queryKeys.events(selectedAttemptId),
    queryFn: () => fetchAttemptDetail(selectedAttemptId ?? ""),
    enabled: selectedAttemptId !== null,
    staleTime: 4_000,
    gcTime: 300_000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => postModelOverride(issueIdentifier, { model, reasoningEffort }),
    onSuccess: async () => {
      setFormDirty(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.issue(issueIdentifier) });
    },
  });

  const selectedAttempt = attempts.find((attempt) => attempt.attemptId === selectedAttemptId) ?? null;
  const events = useMemo(
    () =>
      (attemptQuery.data?.events?.length ?? 0) > 0
        ? (attemptQuery.data?.events ?? [])
        : (issueQuery.data?.recentEvents ?? []),
    [attemptQuery.data?.events, issueQuery.data?.recentEvents],
  );

  return {
    issueQuery,
    attemptsQuery,
    attempts,
    selectedAttemptId,
    selectedAttempt,
    events,
    model,
    reasoningEffort,
    saveMutation,
    eventError: attemptQuery.isError ? attemptQuery.error.message : null,
    setSelectedAttemptId,
    setModelValue: (value: string) => {
      setFormDirty(true);
      setModel(value);
    },
    setReasoningEffortValue: (value: string) => {
      setFormDirty(true);
      setReasoningEffort(value);
    },
    submitModelOverride: async () => {
      await saveMutation.mutateAsync();
    },
  };
}
