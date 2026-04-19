#!/usr/bin/env node
// Run Stryker mutation testing against only the files currently changed vs HEAD
// (plus untracked files) under src/. Mirrors the pattern from
// https://testdouble.com/insights/keep-your-coding-agent-on-task-with-mutation-testing
// but adds a clean "nothing changed" exit and excludes test/type-only files.

import { execFileSync, spawnSync } from "node:child_process";

const TEST_SUFFIX = /\.test\.ts$/;

// Files excluded from mutation because they have no executable behavior worth mutating
// (type-only modules, CLI entrypoints covered by integration tests). Kept aligned with
// the coverage exclusions in vitest.config.ts so mutation scope matches unit-test scope.
const EXCLUDE_PATHS = new Set([
  "src/dashboard/template.ts",
  "src/orchestrator/context.ts",
  "src/orchestrator/runtime-types.ts",
  "src/dispatch/types.ts",
  "src/core/types.ts",
  "src/dispatch/entrypoint.ts",
  "src/cli/index.ts",
  "src/audit/api.ts",
  "src/prompt/api.ts",
  "src/cli/runtime-providers.ts",
  "src/setup/device-auth.ts",
  "src/dispatch/server.ts",
]);

function gitFiles(args) {
  const result = execFileSync("git", args, { encoding: "utf8" });
  return result.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

const tracked = gitFiles(["diff", "--name-only", "HEAD", "--", "src/"]);
const untracked = gitFiles(["ls-files", "--others", "--exclude-standard", "--", "src/"]);

const mutateTargets = [...new Set([...tracked, ...untracked])].filter((file) => {
  if (!file.endsWith(".ts")) return false;
  if (TEST_SUFFIX.test(file)) return false;
  if (EXCLUDE_PATHS.has(file)) return false;
  return true;
});

if (mutateTargets.length === 0) {
  console.log("No changed src/ files to mutate.");
  process.exit(0);
}

console.log(`Mutating ${mutateTargets.length} file(s):`);
for (const file of mutateTargets) console.log(`  - ${file}`);

const stryker = spawnSync("pnpm", ["exec", "stryker", "run", "-m", mutateTargets.join(",")], {
  stdio: "inherit",
});

process.exit(stryker.status ?? 1);
