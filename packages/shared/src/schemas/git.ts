import { Type, type Static } from "@sinclair/typebox";

import { NullableStringSchema } from "./common.js";

export const GitPullViewSchema = Type.Object({
  number: Type.Number(),
  title: Type.String(),
  author: Type.String(),
  state: Type.String(),
  updatedAt: Type.String(),
  url: Type.String(),
  headBranch: Type.String(),
  checksStatus: NullableStringSchema,
});

export const GitCommitViewSchema = Type.Object({
  sha: Type.String(),
  message: Type.String(),
  author: Type.String(),
  date: Type.String(),
});

export const GitHubRepoContextSchema = Type.Object({
  description: NullableStringSchema,
  visibility: Type.String(),
  openPrCount: Type.Number(),
  pulls: Type.Array(GitPullViewSchema),
  recentCommits: Type.Array(GitCommitViewSchema),
});

export const GitRepoViewSchema = Type.Object({
  repoUrl: Type.String(),
  defaultBranch: Type.String(),
  identifierPrefix: NullableStringSchema,
  label: NullableStringSchema,
  githubOwner: NullableStringSchema,
  githubRepo: NullableStringSchema,
  configured: Type.Boolean(),
  github: Type.Optional(GitHubRepoContextSchema),
});

export const ActiveBranchViewSchema = Type.Object({
  identifier: Type.String(),
  branchName: Type.String(),
  status: Type.String(),
  workspacePath: NullableStringSchema,
  issueTitle: Type.String(),
  pullRequestUrl: NullableStringSchema,
});

export const GitContextResponseSchema = Type.Object({
  repos: Type.Array(GitRepoViewSchema),
  activeBranches: Type.Array(ActiveBranchViewSchema),
  githubAvailable: Type.Boolean(),
});

export type GitPullView = Static<typeof GitPullViewSchema>;
export type GitCommitView = Static<typeof GitCommitViewSchema>;
export type GitHubRepoContext = Static<typeof GitHubRepoContextSchema>;
export type GitRepoView = Static<typeof GitRepoViewSchema>;
export type ActiveBranchView = Static<typeof ActiveBranchViewSchema>;
export type GitContextResponse = Static<typeof GitContextResponseSchema>;
