import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runPreflight } from "../../.agents/skills/anvil-risoluto/scripts/preflight.ts";
import { normalizeStatus, readStatus } from "../../.agents/skills/anvil-risoluto/scripts/state.ts";
import {
  cleanupTempAnvilRoots,
  createRunFixture,
  createSkillsRoot,
  createTempAnvilRoot,
} from "./anvil-risoluto-fixtures.ts";

afterEach(async () => {
  await cleanupTempAnvilRoots();
});

describe("anvil-risoluto state normalization", () => {
  it("normalizes legacy skill-name phase aliases into canonical phases", async () => {
    const normalized = await normalizeStatus(
      {
        slug: "phase-alias-test",
        phase: "anvil-brainstorm",
        phase_status: "in_progress",
        active: true,
        review_round: 0,
        audit_round: 0,
        verify_cycle: 0,
        pending_phases: ["anvil-plan", "verify", "anvil-review"],
        pending_gates: ["build"],
        gate_results: {},
        claim_counts: { total: 0, open: 0, passed: 0, failed: 0, accepted_risk: 0, not_applicable: 0 },
        docs_status: "pending",
        tests_status: "pending",
        push_status: "not_started",
        integration_branch: null,
        last_failure_reason: null,
        next_required_action: "Resume brainstorming.",
        dry_run: false,
      },
      "phase-alias-test",
    );

    expect(normalized.phase).toBe("brainstorm");
    expect(normalized.pending_phases).toEqual(["plan", "verify", "review"]);
    expect(normalized.pending_gates).toEqual(["build"]);
  });
});

describe("anvil-risoluto preflight", () => {
  it("advances a local-only run without requiring GitHub or Docker", async () => {
    const root = await createTempAnvilRoot("risoluto-anvil-preflight-");
    const slug = await createRunFixture(root);
    const skillsRoot = await createSkillsRoot(root, [
      "anvil-brainstorm",
      "anvil-plan",
      "anvil-review",
      "anvil-audit",
      "anvil-execute",
      "anvil-verify",
    ]);
    const commands: string[] = [];

    const result = await runPreflight({
      root,
      slug,
      skillSearchRoots: [skillsRoot],
      runCommand: (command) => {
        commands.push(command);
        switch (command) {
          case "git status --porcelain":
            return "";
          case "git branch --show-current":
            return "main";
          case "git worktree list":
            return `${root} 0000000 [main]`;
          case "pnpm run build":
            return "";
          default:
            throw new Error(`unexpected command: ${command}`);
        }
      },
    });

    expect(result.passed).toBe(true);
    expect(commands).not.toContain("gh auth status");
    expect(commands).not.toContain("docker info");

    const status = await readStatus(path.join(root, ".anvil", slug, "status.json"));
    expect(status.phase).toBe("intake");
    expect(status.phase_status).toBe("pending");
    expect(status.active).toBe(true);
    expect(status.pending_phases).toEqual([
      "brainstorm",
      "plan",
      "review",
      "audit",
      "finalize",
      "execute",
      "verify",
      "docs-tests-closeout",
      "final-push",
    ]);

    const preflight = await readFile(path.join(root, ".anvil", slug, "preflight.md"), "utf8");
    expect(preflight).toContain("GitHub auth not required for this run");
    expect(preflight).toContain("Docker is not required for this run");
  });

  it("allows dirty integration-branch state and extra worktrees during execution", async () => {
    const root = await createTempAnvilRoot("risoluto-anvil-execution-preflight-");
    const slug = await createRunFixture(root, {
      phase: "execute",
      phase_status: "in_progress",
      integration_branch: "feat/test-run",
      pending_phases: ["execute", "verify", "docs-tests-closeout", "final-push"],
      next_required_action: "Run execution.",
    });
    const skillsRoot = await createSkillsRoot(root, [
      "anvil-brainstorm",
      "anvil-plan",
      "anvil-review",
      "anvil-audit",
      "anvil-execute",
      "anvil-verify",
    ]);

    const result = await runPreflight({
      root,
      slug,
      skillSearchRoots: [skillsRoot],
      runCommand: (command) => {
        switch (command) {
          case "git status --porcelain":
            return " M src/example.ts";
          case "git branch --show-current":
            return "feat/test-run";
          case "git worktree list":
            return `${root} 0000000 [main]\n${root}/worktrees/test-run 1111111 [feat/test-run]`;
          case "pnpm run build":
            return "";
          default:
            throw new Error(`unexpected command: ${command}`);
        }
      },
    });

    expect(result.passed).toBe(true);

    const status = await readStatus(path.join(root, ".anvil", slug, "status.json"));
    expect(status.phase).toBe("execute");
    expect(status.pending_phases).toEqual(["verify", "docs-tests-closeout", "final-push"]);

    const preflight = await readFile(path.join(root, ".anvil", slug, "preflight.md"), "utf8");
    expect(preflight).toContain(
      "working tree has in-progress changes, allowed because the run already owns execution artifacts",
    );
    expect(preflight).toContain("extra worktrees detected and allowed for an execution-phase run");
  });

  it("blocks UI runs when required conditional verification skills are missing", async () => {
    const root = await createTempAnvilRoot("risoluto-anvil-ui-preflight-");
    const slug = await createRunFixture(root, {}, { touches_ui: true });
    const skillsRoot = await createSkillsRoot(root, [
      "anvil-brainstorm",
      "anvil-plan",
      "anvil-review",
      "anvil-audit",
      "anvil-execute",
      "anvil-verify",
    ]);

    const result = await runPreflight({
      root,
      slug,
      skillSearchRoots: [skillsRoot],
      runCommand: (command) => {
        switch (command) {
          case "git status --porcelain":
            return "";
          case "git branch --show-current":
            return "main";
          case "git worktree list":
            return `${root} 0000000 [main]`;
          case "pnpm run build":
            return "";
          default:
            throw new Error(`unexpected command: ${command}`);
        }
      },
    });

    expect(result.passed).toBe(false);

    const status = await readStatus(path.join(root, ".anvil", slug, "status.json"));
    expect(status.phase).toBe("preflight");
    expect(status.phase_status).toBe("blocked");
    expect(status.active).toBe(false);
    expect(status.last_failure_reason).toContain("run touches UI and requires visual verification");

    const closeout = await readFile(path.join(root, ".anvil", slug, "closeout.md"), "utf8");
    expect(closeout).toContain("planning-only");
    expect(closeout).toContain("visual verification");
  });
});
