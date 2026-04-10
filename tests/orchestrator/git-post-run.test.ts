import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/git/pr-summary-generator.js", () => ({
  generatePrSummary: vi.fn(),
}));
vi.mock("../../src/git/merge-policy.js", () => ({
  evaluateMergePolicy: vi.fn(),
}));

import { executeGitPostRun } from "../../src/orchestrator/git-post-run.js";
import type { Issue, MergePolicy, Workspace } from "../../src/core/types.js";
import { evaluateMergePolicy } from "../../src/git/merge-policy.js";
import { generatePrSummary } from "../../src/git/pr-summary-generator.js";
import type { RepoMatch } from "../../src/git/repo-router.js";

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    identifier: "MT-42",
    title: "Fix the bug",
    description: null,
    priority: 1,
    state: "In Progress",
    branchName: "mt-42-fix-the-bug",
    url: null,
    labels: [],
    blockedBy: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function makeWorkspace(): Workspace {
  return { path: "/tmp/ws/MT-42", workspaceKey: "ws-key", createdNow: true };
}

function makeRepoMatch(overrides: Partial<RepoMatch> = {}): RepoMatch {
  return {
    repoUrl: "https://github.com/org/repo",
    defaultBranch: "main",
    identifierPrefix: "MT",
    label: null,
    githubOwner: "org",
    githubRepo: "repo",
    githubTokenEnv: "GITHUB_TOKEN",
    ...overrides,
  };
}

function makePolicy(overrides: Partial<MergePolicy> = {}): MergePolicy {
  return {
    enabled: true,
    allowedPaths: [],
    requireLabels: [],
    excludeLabels: [],
    maxChangedFiles: null,
    maxDiffLines: null,
    ...overrides,
  };
}

function makeGitManager(
  overrides: {
    pushed?: boolean;
    prUrl?: string | null;
    changedFiles?: string[];
    diffStats?: { additions: number; deletions: number };
    diffNameOnlyError?: Error;
    diffShortStatError?: Error;
  } = {},
) {
  const {
    pushed = false,
    prUrl = null,
    changedFiles = [],
    diffStats = { additions: 0, deletions: 0 },
    diffNameOnlyError,
    diffShortStatError,
  } = overrides;

  return {
    commitAndPush: vi.fn().mockResolvedValue({ pushed, branchName: "mt-42-fix-the-bug" }),
    createPullRequest: vi.fn().mockResolvedValue(prUrl ? { html_url: prUrl } : undefined),
    diffNameOnly: diffNameOnlyError
      ? vi.fn().mockRejectedValue(diffNameOnlyError)
      : vi.fn().mockResolvedValue(changedFiles),
    diffShortStat: diffShortStatError
      ? vi.fn().mockRejectedValue(diffShortStatError)
      : vi.fn().mockResolvedValue(diffStats),
    forcePushIfBranchExists: vi.fn(),
  };
}

function makeAutoMerge(overrides: Partial<{ policy: MergePolicy }> = {}) {
  return {
    policy: makePolicy(overrides.policy),
    client: {
      requestAutoMerge: vi.fn().mockResolvedValue(undefined),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
    },
  };
}

describe("executeGitPostRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generatePrSummary).mockResolvedValue(null);
    vi.mocked(evaluateMergePolicy).mockReturnValue({ allowed: true });
  });

  it("returns null pullRequestUrl when nothing was pushed and skips summary generation", async () => {
    const gitManager = makeGitManager({ pushed: false });

    const result = await executeGitPostRun(gitManager, makeWorkspace(), makeIssue(), makeRepoMatch());

    expect(result).toEqual({ pullRequestUrl: null, summary: null });
    expect(gitManager.createPullRequest).not.toHaveBeenCalled();
    expect(generatePrSummary).not.toHaveBeenCalled();
  });

  it("passes the generated summary into createPullRequest and returns it", async () => {
    const workspace = makeWorkspace();
    const issue = makeIssue();
    const repoMatch = makeRepoMatch();
    const summary = "- updated the post-run pipeline";
    const gitManager = makeGitManager({ pushed: true, prUrl: "https://github.com/org/repo/pull/99" });
    vi.mocked(generatePrSummary).mockResolvedValue(summary);

    const result = await executeGitPostRun(gitManager, workspace, issue, repoMatch);

    expect(generatePrSummary).toHaveBeenCalledWith(workspace.path, repoMatch.defaultBranch);
    expect(gitManager.createPullRequest).toHaveBeenCalledWith(repoMatch, issue, "mt-42-fix-the-bug", summary);
    expect(result).toEqual({ pullRequestUrl: "https://github.com/org/repo/pull/99", summary });
  });

  it("continues without a summary when summary generation fails", async () => {
    const gitManager = makeGitManager({ pushed: true, prUrl: "https://github.com/org/repo/pull/99" });
    vi.mocked(generatePrSummary).mockRejectedValue(new Error("codex unavailable"));

    const result = await executeGitPostRun(gitManager, makeWorkspace(), makeIssue(), makeRepoMatch());

    expect(gitManager.createPullRequest).toHaveBeenCalledWith(makeRepoMatch(), makeIssue(), "mt-42-fix-the-bug", null);
    expect(result).toEqual({ pullRequestUrl: "https://github.com/org/repo/pull/99", summary: null });
  });

  it("calls diffNameOnly and diffShortStat via gitManager and requests auto-merge when policy allows", async () => {
    const workspace = makeWorkspace();
    const issue = makeIssue({ labels: ["ready"] });
    const repoMatch = makeRepoMatch();
    const autoMerge = makeAutoMerge();
    const gitManager = makeGitManager({
      pushed: true,
      prUrl: "https://github.com/org/repo/pull/99",
      changedFiles: ["src/a.ts", "docs/notes.md"],
      diffStats: { additions: 12, deletions: 12 },
    });

    await executeGitPostRun(gitManager, workspace, issue, repoMatch, autoMerge);

    expect(gitManager.diffNameOnly).toHaveBeenCalledWith(workspace.path, repoMatch.defaultBranch);
    expect(gitManager.diffShortStat).toHaveBeenCalledWith(workspace.path, repoMatch.defaultBranch);
    expect(evaluateMergePolicy).toHaveBeenCalledWith(
      autoMerge.policy,
      ["src/a.ts", "docs/notes.md"],
      { additions: 12, deletions: 12 },
      ["ready"],
    );
    expect(autoMerge.client.requestAutoMerge).toHaveBeenCalledWith("org", "repo", 99, "squash", "GITHUB_TOKEN");
    expect(autoMerge.logger.info).toHaveBeenCalledWith(
      { issue_identifier: issue.identifier, pull_request_url: "https://github.com/org/repo/pull/99" },
      "auto-merge requested",
    );
  });

  it("logs the blocking reason when policy rejects auto-merge", async () => {
    const workspace = makeWorkspace();
    const issue = makeIssue();
    const repoMatch = makeRepoMatch();
    const autoMerge = makeAutoMerge();
    const gitManager = makeGitManager({
      pushed: true,
      prUrl: "https://github.com/org/repo/pull/99",
      changedFiles: ["docs/readme.md"],
      diffStats: { additions: 1, deletions: 0 },
    });
    vi.mocked(evaluateMergePolicy).mockReturnValue({
      allowed: false,
      reason: "outside allowed paths",
      blockedFiles: ["docs/readme.md"],
    });

    await executeGitPostRun(gitManager, workspace, issue, repoMatch, autoMerge);

    expect(autoMerge.client.requestAutoMerge).not.toHaveBeenCalled();
    expect(autoMerge.logger.info).toHaveBeenCalledWith(
      {
        issue_identifier: issue.identifier,
        pull_request_url: "https://github.com/org/repo/pull/99",
        reason: "outside allowed paths",
        blocked_files: ["docs/readme.md"],
      },
      "auto-merge blocked by policy",
    );
  });

  it("skips auto-merge when the PR URL does not contain a pull segment", async () => {
    const autoMerge = makeAutoMerge();
    const gitManager = makeGitManager({
      pushed: true,
      prUrl: "abcde123",
      changedFiles: ["src/a.ts"],
      diffStats: { additions: 1, deletions: 0 },
    });

    await executeGitPostRun(gitManager, makeWorkspace(), makeIssue(), makeRepoMatch(), autoMerge);

    expect(autoMerge.client.requestAutoMerge).not.toHaveBeenCalled();
  });

  it("skips auto-merge when the parsed pull number is zero", async () => {
    const autoMerge = makeAutoMerge();
    const gitManager = makeGitManager({
      pushed: true,
      prUrl: "https://github.com/org/repo/pull/0",
      changedFiles: ["src/a.ts"],
      diffStats: { additions: 1, deletions: 0 },
    });

    await executeGitPostRun(gitManager, makeWorkspace(), makeIssue(), makeRepoMatch(), autoMerge);

    expect(autoMerge.client.requestAutoMerge).not.toHaveBeenCalled();
  });

  it("skips auto-merge when repository metadata is missing", async () => {
    const autoMerge = makeAutoMerge();
    const gitManager = makeGitManager({
      pushed: true,
      prUrl: "https://github.com/org/repo/pull/99",
      changedFiles: ["src/a.ts"],
      diffStats: { additions: 1, deletions: 0 },
    });

    await executeGitPostRun(gitManager, makeWorkspace(), makeIssue(), makeRepoMatch({ githubOwner: null }), autoMerge);

    expect(autoMerge.client.requestAutoMerge).not.toHaveBeenCalled();
  });

  it("logs a warning when the auto-merge request fails", async () => {
    const workspace = makeWorkspace();
    const issue = makeIssue();
    const autoMerge = makeAutoMerge();
    autoMerge.client.requestAutoMerge.mockRejectedValue(new Error("not supported"));
    const gitManager = makeGitManager({
      pushed: true,
      prUrl: "https://github.com/org/repo/pull/99",
      changedFiles: ["src/a.ts"],
      diffStats: { additions: 1, deletions: 0 },
    });

    await executeGitPostRun(gitManager, workspace, issue, makeRepoMatch(), autoMerge);

    expect(autoMerge.logger.warn).toHaveBeenCalledWith(
      {
        issue_identifier: issue.identifier,
        pull_request_url: "https://github.com/org/repo/pull/99",
        error: "not supported",
      },
      "requestAutoMerge failed (non-fatal — repo may not support auto-merge)",
    );
  });

  it("logs a warning when policy evaluation itself throws", async () => {
    const workspace = makeWorkspace();
    const issue = makeIssue();
    const autoMerge = makeAutoMerge();
    const gitManager = makeGitManager({
      pushed: true,
      prUrl: "https://github.com/org/repo/pull/99",
      changedFiles: ["src/a.ts"],
      diffStats: { additions: 1, deletions: 0 },
    });
    vi.mocked(evaluateMergePolicy).mockImplementation(() => {
      throw new Error("policy blew up");
    });

    await executeGitPostRun(gitManager, workspace, issue, makeRepoMatch(), autoMerge);

    expect(autoMerge.logger.warn).toHaveBeenCalledWith(
      {
        issue_identifier: issue.identifier,
        error: "policy blew up",
      },
      "auto-merge policy evaluation failed (non-fatal)",
    );
  });

  it("passes empty changed files and zero stats to policy when diff helpers return fallback values", async () => {
    const autoMerge = makeAutoMerge();
    const gitManager = makeGitManager({
      pushed: true,
      prUrl: "https://github.com/org/repo/pull/99",
      changedFiles: [],
      diffStats: { additions: 0, deletions: 0 },
    });

    await executeGitPostRun(gitManager, makeWorkspace(), makeIssue(), makeRepoMatch(), autoMerge);

    expect(evaluateMergePolicy).toHaveBeenCalledWith(
      autoMerge.policy,
      [],
      { additions: 0, deletions: 0 },
      makeIssue().labels,
    );
  });

  it("returns null pullRequestUrl when PR response is undefined", async () => {
    const gitManager = makeGitManager({ pushed: true, prUrl: null });

    const result = await executeGitPostRun(gitManager, makeWorkspace(), makeIssue(), makeRepoMatch());

    expect(result).toEqual({ pullRequestUrl: null, summary: null });
  });

  it("passes the exact commit message and token to commitAndPush", async () => {
    const workspace = makeWorkspace();
    const issue = makeIssue();
    const repoMatch = makeRepoMatch();
    const gitManager = makeGitManager({ pushed: false });

    await executeGitPostRun(gitManager, workspace, issue, repoMatch);

    expect(gitManager.commitAndPush).toHaveBeenCalledWith(
      workspace.path,
      "MT-42: Fix the bug",
      undefined,
      "GITHUB_TOKEN",
    );
  });

  it("propagates errors from commitAndPush", async () => {
    const gitManager = makeGitManager();
    gitManager.commitAndPush.mockRejectedValue(new Error("git push failed"));

    await expect(executeGitPostRun(gitManager, makeWorkspace(), makeIssue(), makeRepoMatch())).rejects.toThrow(
      "git push failed",
    );
  });

  it("propagates errors from createPullRequest", async () => {
    const gitManager = makeGitManager({ pushed: true, prUrl: "https://github.com/org/repo/pull/99" });
    gitManager.createPullRequest.mockRejectedValue(new Error("GitHub API error"));

    await expect(executeGitPostRun(gitManager, makeWorkspace(), makeIssue(), makeRepoMatch())).rejects.toThrow(
      "GitHub API error",
    );
  });
});
