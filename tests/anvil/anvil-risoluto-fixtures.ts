import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { writeStatus, type AnvilStatus } from "../../.agents/skills/anvil-risoluto/scripts/state.ts";

const tempDirs: string[] = [];

export async function createTempAnvilRoot(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

export async function cleanupTempAnvilRoots(): Promise<void> {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
}

export async function createSkillsRoot(root: string, skillNames: string[]): Promise<string> {
  const skillsRoot = path.join(root, "skill-roots");
  for (const skillName of skillNames) {
    const skillDir = path.join(skillsRoot, skillName);
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `# ${skillName}\n`, "utf8");
  }
  return skillsRoot;
}

export async function createRunFixture(
  root: string,
  statusPatch: Partial<AnvilStatus> = {},
  bundlePatch: Record<string, unknown> = {},
): Promise<string> {
  const slug = statusPatch.slug ?? "test-run";
  const runDir = path.join(root, ".anvil", slug);
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(root, ".anvil", "ACTIVE_RUN"), `${slug}\n`, "utf8");
  await writeFile(path.join(runDir, "pipeline.log"), "# Pipeline Log\n\n", "utf8");
  await writeFile(path.join(runDir, "handoff.md"), "# Handoff\n", "utf8");
  await writeFile(path.join(runDir, "preflight.md"), "# Preflight\n", "utf8");
  await writeFile(
    path.join(runDir, "bundle.json"),
    `${JSON.stringify(
      {
        slug,
        title: "Test Run",
        source_type: "manual",
        source_items: [],
        risk_level: "standard",
        touches_ui: false,
        touches_backend: false,
        touches_docs: true,
        touches_tests: true,
        requires_github_auth: false,
        requires_linear_api: false,
        requires_docker: false,
        requires_ui_test: false,
        verification_surfaces: [],
        ...bundlePatch,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeStatus(path.join(runDir, "status.json"), {
    slug,
    phase: "preflight",
    phase_status: "in_progress",
    active: true,
    review_round: 0,
    audit_round: 0,
    verify_cycle: 0,
    max_review_rounds: 3,
    max_audit_rounds: 2,
    max_verify_cycles: 3,
    pending_phases: [
      "intake",
      "brainstorm",
      "plan",
      "review",
      "audit",
      "finalize",
      "execute",
      "verify",
      "docs-tests-closeout",
      "final-push",
    ],
    pending_gates: [],
    gate_results: {},
    claim_counts: {
      total: 0,
      open: 0,
      passed: 0,
      failed: 0,
      accepted_risk: 0,
      not_applicable: 0,
    },
    docs_status: "pending",
    tests_status: "pending",
    push_status: "not_started",
    integration_branch: null,
    last_failure_reason: null,
    next_required_action: "Run preflight.",
    dry_run: false,
    ...statusPatch,
  });
  return slug;
}
