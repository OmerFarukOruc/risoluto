import { TypeCompiler } from "@sinclair/typebox/compiler";
import { describe, expect, it } from "vitest";
import { schemas } from "@symphony/shared";

import { buildOpenApiDocument } from "../../src/http/openapi.js";
import { serializeSnapshot } from "../../src/http/route-helpers.js";

const fixedTimestamp = "2026-03-25T10:15:30.000Z";

function assertSchemaMatch(schema: Parameters<typeof TypeCompiler.Compile>[0], value: unknown): boolean {
  const validator = TypeCompiler.Compile(schema);
  const isValid = validator.Check(value);
  if (!isValid) {
    const errors = [...validator.Errors(value)].map((error) => `${error.path}: ${error.message}`).join("; ");
    throw new Error(`Schema validation failed: ${errors}`);
  }
  return true;
}

function createRuntimeSnapshotFixture() {
  return {
    generatedAt: fixedTimestamp,
    counts: { running: 1, retrying: 1, queued: 1, completed: 1 },
    queued: [{ identifier: "MT-41", title: "Queued fixture" }],
    running: [
      {
        issueId: "issue-42",
        identifier: "MT-42",
        title: "Characterize HTTP routes",
        state: "Todo",
        workspaceKey: "MT-42",
        workspacePath: "/tmp/workspaces/MT-42",
        branchName: "symphony/mt-42",
        pullRequestUrl: "https://github.com/acme/app/pull/42",
        message: null,
        status: "running",
        updatedAt: fixedTimestamp,
        attempt: 1,
        error: null,
      },
    ],
    retrying: [
      {
        issueId: "issue-43",
        identifier: "MT-43",
        title: "Retry fixture",
        state: "In Progress",
        workspaceKey: "MT-43",
        workspacePath: "/tmp/workspaces/MT-43",
        branchName: "symphony/mt-43",
        pullRequestUrl: null,
        message: null,
        status: "retrying",
        updatedAt: fixedTimestamp,
        attempt: 2,
        error: "Transient failure",
      },
    ],
    completed: [
      {
        issueId: "issue-44",
        identifier: "MT-44",
        title: "Completed fixture",
        state: "Done",
        workspaceKey: "MT-44",
        workspacePath: "/tmp/workspaces/MT-44",
        message: null,
        status: "completed",
        updatedAt: fixedTimestamp,
        attempt: 1,
        error: null,
      },
    ],
    workflowColumns: [
      { key: "todo", label: "Todo", kind: "active", terminal: false, count: 1, issues: [{ identifier: "MT-42" }] },
      { key: "done", label: "Done", kind: "terminal", terminal: true, count: 1, issues: [{ identifier: "MT-44" }] },
    ],
    codexTotals: { inputTokens: 12, outputTokens: 7, totalTokens: 19, secondsRunning: 31 },
    rateLimits: { remaining: 99 },
    recentEvents: [
      {
        at: fixedTimestamp,
        issueId: "issue-42",
        issueIdentifier: "MT-42",
        sessionId: "session-1",
        event: "queued",
        message: "Queued by fixture",
        content: null,
        metadata: { source: "characterization" },
      },
    ],
    stallEvents: [
      {
        at: fixedTimestamp,
        issueId: "issue-43",
        issueIdentifier: "MT-43",
        silentMs: 1200,
        timeoutMs: 2400,
      },
    ],
    systemHealth: {
      status: "healthy",
      checkedAt: fixedTimestamp,
      runningCount: 1,
      message: "All systems nominal",
    },
  };
}

describe("shared route schemas", () => {
  it("validates control-plane fixtures against shared schemas", () => {
    const stateResponse = serializeSnapshot(createRuntimeSnapshotFixture() as never);
    expect(assertSchemaMatch(schemas.RuntimeSnapshotResponseSchema, stateResponse)).toBe(true);

    assertSchemaMatch(schemas.RuntimeResponseSchema, {
      version: "9.9.9-characterization",
      workflow_path: "/tmp/WORKFLOW.fixture.md",
      data_dir: "/tmp/symphony-data",
      feature_flags: { DUAL_WRITE: true },
      provider_summary: "Codex",
    });

    assertSchemaMatch(schemas.RefreshResponseSchema, {
      queued: true,
      coalesced: false,
      requested_at: fixedTimestamp,
    });

    assertSchemaMatch(schemas.TransitionsResponseSchema, {
      transitions: {
        todo: ["todo", "in progress"],
        "in progress": ["in progress", "done"],
        done: ["done"],
      },
    });

    assertSchemaMatch(schemas.IssueDetailSchema, {
      issueId: "issue-42",
      identifier: "MT-42",
      title: "Characterize HTTP routes",
      state: "Todo",
      attempts: [{ attemptId: "attempt-1", status: "completed" }],
      currentAttemptId: "attempt-live",
    });

    assertSchemaMatch(schemas.AttemptListResponseSchema, {
      attempts: [{ attemptId: "attempt-1", status: "completed" }],
      current_attempt_id: "attempt-live",
    });

    assertSchemaMatch(schemas.AttemptDetailSchema, {
      attemptId: "attempt-1",
      status: "completed",
      events: [{ at: fixedTimestamp, event: "finished" }],
    });

    assertSchemaMatch(schemas.AbortResponseSchema, {
      ok: true,
      status: "stopping",
      already_stopping: false,
      requested_at: fixedTimestamp,
    });

    assertSchemaMatch(schemas.ModelUpdateResponseSchema, {
      updated: true,
      restarted: false,
      applies_next_attempt: true,
      selection: {
        model: "gpt-5.4",
        reasoning_effort: "high",
        source: "override",
      },
    });

    assertSchemaMatch(schemas.TransitionSuccessResponseSchema, {
      ok: true,
      from: "Todo",
      to: "In Progress",
    });

    assertSchemaMatch(schemas.GitContextResponseSchema, {
      githubAvailable: false,
      repos: [
        {
          repoUrl: "https://github.com/acme/app.git",
          defaultBranch: "main",
          identifierPrefix: "MT",
          label: null,
          githubOwner: "acme",
          githubRepo: "app",
          configured: true,
        },
      ],
      activeBranches: [
        {
          identifier: "MT-42",
          branchName: "symphony/mt-42",
          status: "running",
          workspacePath: "/tmp/workspaces/MT-42",
          issueTitle: "Characterize HTTP routes",
          pullRequestUrl: "https://github.com/acme/app/pull/42",
        },
      ],
    });

    assertSchemaMatch(schemas.WorkspaceInventoryResponseSchema, {
      workspaces: [
        {
          workspace_key: "MT-42",
          path: "/tmp/workspaces/MT-42",
          status: "running",
          strategy: "directory",
          issue: {
            identifier: "MT-42",
            title: "Characterize HTTP routes",
            state: "Todo",
          },
          disk_bytes: 1024,
          last_modified_at: fixedTimestamp,
        },
      ],
      generated_at: fixedTimestamp,
      total: 1,
      active: 1,
      orphaned: 0,
    });
  });

  it("validates config, secrets, setup, and dispatch fixtures against shared schemas", () => {
    expect(
      assertSchemaMatch(schemas.ConfigValueSchema, {
        tracker: { kind: "linear", project_slug: "symphony" },
        codex: { auth: "[REDACTED]" },
      }),
    ).toBe(true);

    assertSchemaMatch(schemas.ConfigSchemaResponseSchema, {
      overlay_put_body_examples: [{ codex: { model: "gpt-5.4" } }],
      routes: {
        get_effective_config: "GET /api/v1/config",
        put_overlay: "PUT /api/v1/config/overlay",
      },
    });

    assertSchemaMatch(schemas.ConfigOverlayResponseSchema, {
      overlay: { codex: { model: "gpt-5.4" } },
    });

    assertSchemaMatch(schemas.ConfigOverlayUpdateResponseSchema, {
      updated: true,
      overlay: { codex: { model: "gpt-5.4" }, server: { port: 4010 } },
    });

    assertSchemaMatch(schemas.SecretListResponseSchema, { keys: ["OPENAI_API_KEY"] });
    assertSchemaMatch(schemas.SecretValueBodySchema, { value: "ghp-characterization" });

    assertSchemaMatch(schemas.SetupStatusResponseSchema, {
      configured: false,
      steps: {
        masterKey: { done: false },
        linearProject: { done: false },
        repoRoute: { done: false },
        openaiKey: { done: false },
        githubToken: { done: false },
      },
    });

    assertSchemaMatch(schemas.MasterKeyResponseSchema, {
      key: "a".repeat(64),
    });
    assertSchemaMatch(schemas.LinearProjectsResponseSchema, {
      projects: [
        { id: "project-1", name: "Symphony", slugId: "symphony", teamKey: "ENG" },
        { id: "project-2", name: "Platform", slugId: "platform", teamKey: null },
      ],
    });
    assertSchemaMatch(schemas.OkResponseSchema, { ok: true });
    assertSchemaMatch(schemas.TokenValidationResponseSchema, { valid: true });
    assertSchemaMatch(schemas.PkceStartResponseSchema, { authUrl: "https://auth.example.com/start" });
    assertSchemaMatch(schemas.PkceStatusResponseSchema, { status: "pending" });
    assertSchemaMatch(schemas.RepoRouteCreateResponseSchema, {
      ok: true,
      route: {
        repo_url: "https://github.com/acme/app",
        default_branch: "main",
        identifier_prefix: "MT",
      },
    });
    assertSchemaMatch(schemas.RepoRoutesResponseSchema, {
      routes: [
        {
          repo_url: "https://github.com/acme/app",
          default_branch: "main",
          identifier_prefix: "MT",
        },
      ],
    });
    assertSchemaMatch(schemas.DetectDefaultBranchResponseSchema, { defaultBranch: "trunk" });
    assertSchemaMatch(schemas.CreateTestIssueResponseSchema, {
      ok: true,
      issueIdentifier: "ENG-101",
      issueUrl: "https://linear.app/issue/ENG-101",
    });
    assertSchemaMatch(schemas.CreateLabelResponseSchema, {
      ok: true,
      labelId: "label-1",
      labelName: "symphony",
      alreadyExists: false,
    });
    assertSchemaMatch(schemas.CreateProjectResponseSchema, {
      ok: true,
      project: {
        id: "project-2",
        name: "New Symphony",
        slugId: "new-symphony",
        url: "https://linear.app/project/new-symphony",
        teamKey: "ENG",
      },
    });
    assertSchemaMatch(schemas.PromptTemplateResponseSchema, {
      template: "You are a coding agent",
      isDefault: false,
    });
    assertSchemaMatch(schemas.PromptTemplateUpdateResponseSchema, {
      ok: true,
      isDefault: false,
    });

    assertSchemaMatch(schemas.DataPlaneHealthSchema, { status: "ok", activeDispatches: 0 });
    assertSchemaMatch(schemas.StringErrorSchema, { error: "unauthorized" });
    assertSchemaMatch(schemas.DispatchAbortResponseSchema, { status: "aborted" });
    assertSchemaMatch(schemas.DispatchRequestSchema, {
      issue: { id: "issue-1", identifier: "MT-42", title: "Dispatch fixture" },
      attempt: 1,
      modelSelection: { model: "gpt-5.4", reasoningEffort: "high", source: "override" },
      promptTemplate: "You are a coding agent",
      workspace: { key: "MT-42", path: "/tmp/mt-42" },
      config: {
        tracker: {
          kind: "linear",
          apiKey: "linear-secret",
          endpoint: "https://api.linear.app/graphql",
          projectSlug: null,
          activeStates: ["Todo"],
          terminalStates: ["Done"],
          requiredLabel: null,
        },
        polling: { intervalMs: 60_000 },
        workspace: {
          root: "/tmp",
          hooks: {
            afterCreate: null,
            beforeRun: null,
            afterRun: null,
            beforeRemove: null,
            timeoutMs: 1000,
          },
          strategy: "directory",
          branchPrefix: "symphony/",
        },
        agent: {
          maxConcurrentAgents: 1,
          maxConcurrentAgentsByState: {},
          maxTurns: 12,
          maxRetryBackoffMs: 60_000,
          maxContinuationAttempts: 1,
          successState: null,
          stallTimeoutMs: 120_000,
        },
        codex: {
          command: "codex",
          model: "gpt-5.4",
          reasoningEffort: null,
          approvalPolicy: "never",
          threadSandbox: "danger-full-access",
          turnSandboxPolicy: { type: "danger-full-access" },
          readTimeoutMs: 1000,
          turnTimeoutMs: 1000,
          drainTimeoutMs: 1000,
          startupTimeoutMs: 1000,
          stallTimeoutMs: 1000,
          auth: { mode: "api_key", sourceHome: "/tmp/auth" },
          provider: null,
          sandbox: {
            image: "node:22",
            network: "bridge",
            security: {
              noNewPrivileges: true,
              dropCapabilities: true,
              gvisor: false,
              seccompProfile: "default",
            },
            resources: {
              memory: "1g",
              memoryReservation: "512m",
              memorySwap: "1g",
              cpus: "1",
              tmpfsSize: "64m",
            },
            extraMounts: [],
            envPassthrough: [],
            logs: {
              driver: "json-file",
              maxSize: "10m",
              maxFile: 3,
            },
            egressAllowlist: [],
          },
        },
        server: { port: 4000 },
        repos: [],
      },
      codexRuntimeConfigToml: "model = 'gpt-5.4'",
      codexRuntimeAuthJsonBase64: null,
      codexRequiredEnvNames: [],
    });
  });

  it("builds an OpenAPI document referencing shared schemas", () => {
    const document = buildOpenApiDocument();
    assertSchemaMatch(schemas.OpenApiDocumentSchema, document);
    expect(document.paths["/api/v1/state"]).toBeDefined();
    expect(document.paths["/api/v1/setup/status"]).toBeDefined();
    expect(document.paths["/api/v1/workspaces/{workspace_key}"]).toBeDefined();
  });
});
