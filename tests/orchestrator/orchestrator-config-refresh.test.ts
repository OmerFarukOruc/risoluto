import { describe, expect, it } from "vitest";

import { createLogger } from "../../src/core/logger.js";
import type { ServiceConfig } from "../../src/core/types.js";
import { Orchestrator } from "../../src/orchestrator/orchestrator.js";

function createConfig(overrides?: Partial<ServiceConfig>): ServiceConfig {
  return {
    tracker: {
      kind: "linear",
      apiKey: "linear-token",
      endpoint: "https://api.linear.app/graphql",
      projectSlug: "EXAMPLE",
      activeStates: ["Backlog", "Todo", "In Progress"],
      terminalStates: ["Done", "Canceled"],
    },
    polling: { intervalMs: 30000 },
    workspace: {
      root: "/tmp/risoluto",
      strategy: "directory",
      branchPrefix: "risoluto/",
      hooks: {
        afterCreate: null,
        beforeRun: null,
        afterRun: null,
        beforeRemove: null,
        timeoutMs: 1000,
      },
    },
    agent: {
      maxConcurrentAgents: 1,
      maxConcurrentAgentsByState: {},
      maxTurns: 1,
      maxRetryBackoffMs: 300000,
      maxContinuationAttempts: 1,
      stallTimeoutMs: 1200000,
      successState: null,
      preflightCommands: [],
    },
    codex: {
      command: "codex app-server",
      model: "gpt-5.4",
      reasoningEffort: "high",
      approvalPolicy: "never",
      threadSandbox: "danger-full-access",
      turnSandboxPolicy: { type: "dangerFullAccess" },
      readTimeoutMs: 1000,
      turnTimeoutMs: 10000,
      drainTimeoutMs: 0,
      startupTimeoutMs: 5000,
      stallTimeoutMs: 10000,
      auth: {
        mode: "api_key",
        sourceHome: "/tmp/unused-codex-home",
      },
      provider: null,
      personality: "friendly",
      selfReview: false,
      structuredOutput: false,
      sandbox: {
        image: "risoluto-codex:latest",
        network: "",
        security: { noNewPrivileges: true, dropCapabilities: true, gvisor: false, seccompProfile: "" },
        resources: { memory: "4g", memoryReservation: "1g", memorySwap: "4g", cpus: "2.0", tmpfsSize: "512m" },
        extraMounts: [],
        envPassthrough: [],
        logs: { driver: "json-file", maxSize: "50m", maxFile: 3 },
        egressAllowlist: [],
      },
    },
    server: { port: 4000 },
    notifications: { slack: null },
    github: null,
    repos: [],
    stateMachine: null,
    ...overrides,
  };
}

describe("Orchestrator config refresh", () => {
  it("invalidates cached workflow columns when config stateMachine changes", () => {
    let config = createConfig();
    let onConfigChange: (() => void) | null = null;

    const orchestrator = new Orchestrator({
      attemptStore: {
        start: async () => undefined,
        getAttempt: () => null,
        getAllAttempts: () => [],
        getEvents: () => [],
        getAttemptsForIssue: () => [],
        createAttempt: async () => undefined,
        updateAttempt: async () => undefined,
        appendEvent: async () => undefined,
        sumArchivedSeconds: () => 0,
        sumCostUsd: () => 0,
        sumArchivedTokens: () => ({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
      },
      configStore: {
        getConfig: () => config,
        subscribe: (listener: () => void) => {
          onConfigChange = listener;
          return () => {
            onConfigChange = null;
          };
        },
      } as never,
      tracker: {} as never,
      workspaceManager: {} as never,
      agentRunner: {} as never,
      issueConfigStore: { loadAll: () => [] } as never,
      logger: createLogger(),
      resolveTemplate: async () => "",
    });

    const initialColumns = orchestrator.getSnapshot().workflowColumns.map((column) => column.label);
    expect(initialColumns).toEqual(["Backlog", "Todo", "In Progress", "Done", "Canceled"]);

    config = createConfig({
      stateMachine: {
        stages: [
          { name: "Backlog", kind: "backlog" },
          { name: "Todo", kind: "todo" },
          { name: "In Progress", kind: "active" },
          { name: "In Review", kind: "gate" },
          { name: "Done", kind: "terminal" },
          { name: "Canceled", kind: "terminal" },
        ],
        transitions: {},
      },
    });

    onConfigChange?.();

    const refreshedColumns = orchestrator.getSnapshot().workflowColumns.map((column) => column.label);
    expect(refreshedColumns).toEqual(["Backlog", "Todo", "In Progress", "In Review", "Done", "Canceled"]);
  });
});
