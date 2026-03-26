import { QueryClient, queryOptions } from "@tanstack/react-query";

export type SetupStatusResponse = Readonly<{
  configured: boolean;
}>;

export type SetupRoutingState = "checking" | "ready" | "setup-required";

export const queryKeys = {
  state: ["state"] as const,
  runtime: ["runtime-info"] as const,
  config: ["config"] as const,
  secrets: ["secrets"] as const,
  issues: ["issues"] as const,
  issue: (issueIdentifier: string) => ["issues", issueIdentifier] as const,
  issueAttempts: ["issue-attempts"] as const,
  issueAttemptsFor: (issueIdentifier: string) => ["issue-attempts", issueIdentifier] as const,
  events: (attemptId: string | null) => ["events", attemptId] as const,
  setupStatus: ["setup-status"] as const,
  setupStatusDetail: ["setup-status", "detail"] as const,
  setupRepoRoutes: ["setup-repo-routes"] as const,
  setupPkceStatus: ["setup-pkce-status"] as const,
} as const;

async function fetchSetupStatus(): Promise<SetupStatusResponse> {
  const response = await fetch("/api/v1/setup/status");
  if (!response.ok) {
    throw new Error(`Setup status request failed with ${response.status}.`);
  }
  return (await response.json()) as SetupStatusResponse;
}

export const setupStatusQueryOptions = queryOptions({
  queryKey: queryKeys.setupStatus,
  queryFn: fetchSetupStatus,
  staleTime: 4_000,
  gcTime: 300_000,
  meta: { poll: true },
});

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function resolveSetupRoutingState(data: SetupStatusResponse | undefined, hasError: boolean): SetupRoutingState {
  if (data === undefined) {
    return hasError ? "ready" : "checking";
  }
  return data.configured ? "ready" : "setup-required";
}
