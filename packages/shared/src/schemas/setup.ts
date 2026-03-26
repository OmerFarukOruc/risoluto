import { Type, type Static } from "@sinclair/typebox";

import { NullableStringSchema } from "./common.js";

export const SetupStepStatusSchema = Type.Object({
  done: Type.Boolean(),
});

export const SetupStatusResponseSchema = Type.Object({
  configured: Type.Boolean(),
  steps: Type.Object({
    masterKey: SetupStepStatusSchema,
    linearProject: SetupStepStatusSchema,
    repoRoute: SetupStepStatusSchema,
    openaiKey: SetupStepStatusSchema,
    githubToken: SetupStepStatusSchema,
  }),
});

export const MasterKeyBodySchema = Type.Object(
  {
    key: Type.Optional(Type.String()),
  },
  { additionalProperties: true },
);

export const MasterKeyResponseSchema = Type.Object({
  key: Type.String(),
});

export const OkResponseSchema = Type.Object({
  ok: Type.Boolean(),
});

export const LinearProjectSchema = Type.Object({
  id: Type.Unknown(),
  name: Type.Unknown(),
  slugId: Type.Unknown(),
  teamKey: NullableStringSchema,
});

export const LinearProjectsResponseSchema = Type.Object({
  projects: Type.Array(LinearProjectSchema),
});

export const LinearProjectSelectionBodySchema = Type.Object({
  slugId: Type.String(),
});

export const ApiKeyBodySchema = Type.Object({
  key: Type.String(),
});

export const TokenValidationResponseSchema = Type.Object({
  valid: Type.Boolean(),
});

export const CodexAuthBodySchema = Type.Object({
  authJson: Type.String(),
});

export const PkceStartResponseSchema = Type.Object({
  authUrl: Type.String(),
});

export const PkceStatusIdleSchema = Type.Object({
  status: Type.Literal("idle"),
});

export const PkceStatusPendingSchema = Type.Object({
  status: Type.Literal("pending"),
});

export const PkceStatusCompleteSchema = Type.Object({
  status: Type.Literal("complete"),
});

export const PkceStatusErrorSchema = Type.Object({
  status: Type.Literal("error"),
  error: Type.String(),
});

export const PkceStatusExpiredSchema = Type.Object({
  status: Type.Literal("expired"),
  error: Type.String(),
});

export const PkceStatusResponseSchema = Type.Union([
  PkceStatusIdleSchema,
  PkceStatusPendingSchema,
  PkceStatusCompleteSchema,
  PkceStatusErrorSchema,
  PkceStatusExpiredSchema,
]);

export const GitHubTokenBodySchema = Type.Object({
  token: Type.String(),
});

export const RepoRouteEntrySchema = Type.Object({
  repo_url: Type.String(),
  default_branch: Type.String(),
  identifier_prefix: Type.String(),
  label: Type.Optional(Type.String()),
});

export const RepoRouteCreateBodySchema = Type.Object({
  repoUrl: Type.String(),
  defaultBranch: Type.Optional(Type.String()),
  identifierPrefix: Type.String(),
  label: Type.Optional(Type.String()),
});

export const RepoRouteCreateResponseSchema = Type.Object({
  ok: Type.Boolean(),
  route: RepoRouteEntrySchema,
});

export const RepoRoutesResponseSchema = Type.Object({
  routes: Type.Array(RepoRouteEntrySchema),
});

export const RepoRouteDeleteBodySchema = Type.Object({
  index: Type.Integer(),
});

export const RepoRouteDeleteResponseSchema = Type.Object({
  ok: Type.Boolean(),
  routes: Type.Array(RepoRouteEntrySchema),
});

export const DetectDefaultBranchBodySchema = Type.Object({
  repoUrl: Type.String(),
});

export const DetectDefaultBranchResponseSchema = Type.Object({
  defaultBranch: Type.String(),
});

export const CreateTestIssueResponseSchema = Type.Object({
  ok: Type.Boolean(),
  issueIdentifier: Type.String(),
  issueUrl: Type.String(),
});

export const CreateLabelResponseSchema = Type.Object({
  ok: Type.Boolean(),
  labelId: Type.String(),
  labelName: Type.String(),
  alreadyExists: Type.Boolean(),
});

export const CreateProjectBodySchema = Type.Object({
  name: Type.String(),
});

export const CreateProjectResponseSchema = Type.Object({
  ok: Type.Boolean(),
  project: Type.Object({
    id: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    slugId: Type.String(),
    url: NullableStringSchema,
    teamKey: Type.String(),
  }),
});

export const PromptTemplateResponseSchema = Type.Object({
  template: Type.String(),
  isDefault: Type.Boolean(),
});

export const PromptTemplateBodySchema = Type.Object({
  template: Type.String(),
});

export const PromptTemplateUpdateResponseSchema = Type.Object({
  ok: Type.Boolean(),
  isDefault: Type.Boolean(),
});

export type SetupStepStatus = Static<typeof SetupStepStatusSchema>;
export type SetupStatusResponse = Static<typeof SetupStatusResponseSchema>;
export type MasterKeyBody = Static<typeof MasterKeyBodySchema>;
export type MasterKeyResponse = Static<typeof MasterKeyResponseSchema>;
export type OkResponse = Static<typeof OkResponseSchema>;
export type LinearProject = Static<typeof LinearProjectSchema>;
export type LinearProjectsResponse = Static<typeof LinearProjectsResponseSchema>;
export type LinearProjectSelectionBody = Static<typeof LinearProjectSelectionBodySchema>;
export type ApiKeyBody = Static<typeof ApiKeyBodySchema>;
export type TokenValidationResponse = Static<typeof TokenValidationResponseSchema>;
export type CodexAuthBody = Static<typeof CodexAuthBodySchema>;
export type PkceStartResponse = Static<typeof PkceStartResponseSchema>;
export type PkceStatusResponse = Static<typeof PkceStatusResponseSchema>;
export type GitHubTokenBody = Static<typeof GitHubTokenBodySchema>;
export type RepoRouteEntry = Static<typeof RepoRouteEntrySchema>;
export type RepoRouteCreateBody = Static<typeof RepoRouteCreateBodySchema>;
export type RepoRouteCreateResponse = Static<typeof RepoRouteCreateResponseSchema>;
export type RepoRoutesResponse = Static<typeof RepoRoutesResponseSchema>;
export type RepoRouteDeleteBody = Static<typeof RepoRouteDeleteBodySchema>;
export type RepoRouteDeleteResponse = Static<typeof RepoRouteDeleteResponseSchema>;
export type DetectDefaultBranchBody = Static<typeof DetectDefaultBranchBodySchema>;
export type DetectDefaultBranchResponse = Static<typeof DetectDefaultBranchResponseSchema>;
export type CreateTestIssueResponse = Static<typeof CreateTestIssueResponseSchema>;
export type CreateLabelResponse = Static<typeof CreateLabelResponseSchema>;
export type CreateProjectBody = Static<typeof CreateProjectBodySchema>;
export type CreateProjectResponse = Static<typeof CreateProjectResponseSchema>;
export type PromptTemplateResponse = Static<typeof PromptTemplateResponseSchema>;
export type PromptTemplateBody = Static<typeof PromptTemplateBodySchema>;
export type PromptTemplateUpdateResponse = Static<typeof PromptTemplateUpdateResponseSchema>;
