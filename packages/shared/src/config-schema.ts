import { Type, type Static } from "@sinclair/typebox";

const NullableString = Type.Union([Type.String(), Type.Null()]);
const StringArray = Type.Array(Type.String());
const StringMap = Type.Record(Type.String(), Type.String());
const NumberMap = Type.Record(Type.String(), Type.Number());
const UnknownRecord = Type.Record(Type.String(), Type.Unknown());

export const ReasoningEffortSchema = Type.Union([
  Type.Literal("none"),
  Type.Literal("minimal"),
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("xhigh"),
]);

export const NotificationVerbositySchema = Type.Union([
  Type.Literal("off"),
  Type.Literal("critical"),
  Type.Literal("verbose"),
]);

export const WorkspaceStrategySchema = Type.Union([Type.Literal("directory"), Type.Literal("worktree")]);
export const CodexAuthModeSchema = Type.Union([Type.Literal("api_key"), Type.Literal("openai_login")]);
export const StateStageKindSchema = Type.Union([
  Type.Literal("backlog"),
  Type.Literal("todo"),
  Type.Literal("active"),
  Type.Literal("gate"),
  Type.Literal("terminal"),
]);

const WorkflowTrackerSchema = Type.Object({
  kind: Type.Optional(Type.String()),
  api_key: Type.Optional(Type.String()),
  endpoint: Type.Optional(Type.String()),
  project_slug: Type.Optional(Type.String()),
  active_states: Type.Optional(StringArray),
  terminal_states: Type.Optional(StringArray),
  required_label: Type.Optional(NullableString),
});

const WorkflowNotificationsSchema = Type.Object({
  slack: Type.Optional(
    Type.Object({
      webhook_url: Type.Optional(Type.String()),
      verbosity: Type.Optional(NotificationVerbositySchema),
    }),
  ),
});

const WorkflowGitHubSchema = Type.Object({
  token: Type.Optional(Type.String()),
  api_base_url: Type.Optional(Type.String()),
});

const WorkflowRepoSchema = Type.Object({
  repo_url: Type.Optional(Type.String()),
  default_branch: Type.Optional(Type.String()),
  identifier_prefix: Type.Optional(NullableString),
  label: Type.Optional(NullableString),
  github_owner: Type.Optional(NullableString),
  github_repo: Type.Optional(NullableString),
  github_token_env: Type.Optional(NullableString),
});

const WorkflowHooksSchema = Type.Object({
  timeout_ms: Type.Optional(Type.Number()),
  after_create: Type.Optional(Type.String()),
  before_run: Type.Optional(Type.String()),
  after_run: Type.Optional(Type.String()),
  before_remove: Type.Optional(Type.String()),
});

const WorkflowCodexProviderSchema = Type.Object({
  id: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
  base_url: Type.Optional(Type.String()),
  env_key: Type.Optional(Type.String()),
  env_key_instructions: Type.Optional(Type.String()),
  wire_api: Type.Optional(Type.String()),
  requires_openai_auth: Type.Optional(Type.Boolean()),
  http_headers: Type.Optional(StringMap),
  env_http_headers: Type.Optional(StringMap),
  query_params: Type.Optional(StringMap),
});

const WorkflowSandboxSchema = Type.Object({
  image: Type.Optional(Type.String()),
  network: Type.Optional(Type.String()),
  security: Type.Optional(
    Type.Object({
      no_new_privileges: Type.Optional(Type.Boolean()),
      drop_capabilities: Type.Optional(Type.Boolean()),
      gvisor: Type.Optional(Type.Boolean()),
      seccomp_profile: Type.Optional(Type.String()),
    }),
  ),
  resources: Type.Optional(
    Type.Object({
      memory: Type.Optional(Type.String()),
      memory_reservation: Type.Optional(Type.String()),
      memory_swap: Type.Optional(Type.String()),
      cpus: Type.Optional(Type.String()),
      tmpfs_size: Type.Optional(Type.String()),
    }),
  ),
  extra_mounts: Type.Optional(StringArray),
  env_passthrough: Type.Optional(StringArray),
  logs: Type.Optional(
    Type.Object({
      driver: Type.Optional(Type.String()),
      max_size: Type.Optional(Type.String()),
      max_file: Type.Optional(Type.Number()),
    }),
  ),
  egress_allowlist: Type.Optional(StringArray),
});

export const WorkflowSchema = Type.Object({
  tracker: Type.Optional(WorkflowTrackerSchema),
  notifications: Type.Optional(WorkflowNotificationsSchema),
  github: Type.Optional(WorkflowGitHubSchema),
  repos: Type.Optional(Type.Array(WorkflowRepoSchema)),
  polling: Type.Optional(Type.Object({ interval_ms: Type.Optional(Type.Number()) })),
  hooks: Type.Optional(WorkflowHooksSchema),
  workspace: Type.Optional(
    Type.Object({
      root: Type.Optional(Type.String()),
      strategy: Type.Optional(WorkspaceStrategySchema),
      branch_prefix: Type.Optional(Type.String()),
    }),
  ),
  agent: Type.Optional(
    Type.Object({
      max_concurrent_agents: Type.Optional(Type.Number()),
      max_concurrent_agents_by_state: Type.Optional(NumberMap),
      max_turns: Type.Optional(Type.Number()),
      max_retry_backoff_ms: Type.Optional(Type.Number()),
      max_continuation_attempts: Type.Optional(Type.Number()),
      success_state: Type.Optional(NullableString),
      stall_timeout_ms: Type.Optional(Type.Number()),
    }),
  ),
  codex: Type.Optional(
    Type.Object({
      command: Type.Optional(Type.String()),
      model: Type.Optional(Type.String()),
      reasoning_effort: Type.Optional(ReasoningEffortSchema),
      approval_policy: Type.Optional(Type.Union([Type.String(), UnknownRecord])),
      thread_sandbox: Type.Optional(Type.String()),
      turn_sandbox_policy: Type.Optional(Type.Object({ type: Type.String() }, { additionalProperties: true })),
      read_timeout_ms: Type.Optional(Type.Number()),
      turn_timeout_ms: Type.Optional(Type.Number()),
      drain_timeout_ms: Type.Optional(Type.Number()),
      startup_timeout_ms: Type.Optional(Type.Number()),
      stall_timeout_ms: Type.Optional(Type.Number()),
      auth: Type.Optional(
        Type.Object({
          mode: Type.Optional(CodexAuthModeSchema),
          source_home: Type.Optional(Type.String()),
        }),
      ),
      provider: Type.Optional(WorkflowCodexProviderSchema),
      sandbox: Type.Optional(WorkflowSandboxSchema),
    }),
  ),
  state_machine: Type.Optional(
    Type.Object({
      stages: Type.Optional(Type.Array(Type.Object({ name: Type.String(), kind: StateStageKindSchema }))),
      transitions: Type.Optional(Type.Record(Type.String(), StringArray)),
    }),
  ),
  server: Type.Optional(Type.Object({ port: Type.Optional(Type.Number()) })),
});

export const TrackerConfigSchema = Type.Object({
  kind: Type.String(),
  apiKey: Type.String(),
  endpoint: Type.String(),
  projectSlug: NullableString,
  activeStates: StringArray,
  terminalStates: StringArray,
  requiredLabel: NullableString,
});

export const PollingConfigSchema = Type.Object({
  intervalMs: Type.Number(),
});

export const WorkspaceConfigSchema = Type.Object({
  root: Type.String(),
  hooks: Type.Object({
    afterCreate: NullableString,
    beforeRun: NullableString,
    afterRun: NullableString,
    beforeRemove: NullableString,
    timeoutMs: Type.Number(),
  }),
  strategy: WorkspaceStrategySchema,
  branchPrefix: Type.String(),
});

export const AgentConfigSchema = Type.Object({
  maxConcurrentAgents: Type.Number(),
  maxConcurrentAgentsByState: NumberMap,
  maxTurns: Type.Number(),
  maxRetryBackoffMs: Type.Number(),
  maxContinuationAttempts: Type.Number(),
  successState: NullableString,
  stallTimeoutMs: Type.Number(),
});

const CodexProviderConfigSchema = Type.Object({
  id: NullableString,
  name: NullableString,
  baseUrl: NullableString,
  envKey: NullableString,
  envKeyInstructions: NullableString,
  wireApi: NullableString,
  requiresOpenaiAuth: Type.Boolean(),
  httpHeaders: StringMap,
  envHttpHeaders: StringMap,
  queryParams: StringMap,
});

export const CodexConfigSchema = Type.Object({
  command: Type.String(),
  model: Type.String(),
  reasoningEffort: Type.Union([ReasoningEffortSchema, Type.Null()]),
  approvalPolicy: Type.Union([Type.String(), UnknownRecord]),
  threadSandbox: Type.String(),
  turnSandboxPolicy: Type.Object({ type: Type.String() }, { additionalProperties: true }),
  readTimeoutMs: Type.Number(),
  turnTimeoutMs: Type.Number(),
  drainTimeoutMs: Type.Number(),
  startupTimeoutMs: Type.Number(),
  stallTimeoutMs: Type.Number(),
  auth: Type.Object({
    mode: CodexAuthModeSchema,
    sourceHome: Type.String(),
  }),
  provider: Type.Union([CodexProviderConfigSchema, Type.Null()]),
  sandbox: Type.Object({
    image: Type.String(),
    network: Type.String(),
    security: Type.Object({
      noNewPrivileges: Type.Boolean(),
      dropCapabilities: Type.Boolean(),
      gvisor: Type.Boolean(),
      seccompProfile: Type.String(),
    }),
    resources: Type.Object({
      memory: Type.String(),
      memoryReservation: Type.String(),
      memorySwap: Type.String(),
      cpus: Type.String(),
      tmpfsSize: Type.String(),
    }),
    extraMounts: StringArray,
    envPassthrough: StringArray,
    logs: Type.Object({
      driver: Type.String(),
      maxSize: Type.String(),
      maxFile: Type.Number(),
    }),
    egressAllowlist: StringArray,
  }),
});

export const ServerConfigSchema = Type.Object({
  port: Type.Number(),
});

const NotificationConfigSchema = Type.Object({
  slack: Type.Union([
    Type.Object({
      webhookUrl: Type.String(),
      verbosity: NotificationVerbositySchema,
    }),
    Type.Null(),
  ]),
});

const GitHubConfigSchema = Type.Object({
  token: Type.String(),
  apiBaseUrl: Type.String(),
});

const RepoConfigSchema = Type.Object({
  repoUrl: Type.String(),
  defaultBranch: Type.String(),
  identifierPrefix: NullableString,
  label: NullableString,
  githubOwner: Type.Optional(NullableString),
  githubRepo: Type.Optional(NullableString),
  githubTokenEnv: Type.Optional(NullableString),
});

const StateMachineConfigSchema = Type.Object({
  stages: Type.Array(
    Type.Object({
      name: Type.String(),
      kind: StateStageKindSchema,
    }),
  ),
  transitions: Type.Record(Type.String(), StringArray),
});

export const ServiceConfigSchema = Type.Object({
  tracker: TrackerConfigSchema,
  notifications: Type.Optional(NotificationConfigSchema),
  github: Type.Optional(Type.Union([GitHubConfigSchema, Type.Null()])),
  repos: Type.Optional(Type.Array(RepoConfigSchema)),
  polling: PollingConfigSchema,
  workspace: WorkspaceConfigSchema,
  agent: AgentConfigSchema,
  codex: CodexConfigSchema,
  stateMachine: Type.Optional(Type.Union([StateMachineConfigSchema, Type.Null()])),
  server: ServerConfigSchema,
});

export type WorkflowConfigInput = Static<typeof WorkflowSchema>;
export type ServiceConfigValue = Static<typeof ServiceConfigSchema>;
