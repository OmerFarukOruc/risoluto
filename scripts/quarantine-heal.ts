#!/usr/bin/env tsx
/**
 * Nightly quarantine healing script.
 *
 * Reads Vitest JSON output and updates `quarantine.json`:
 * - Tests that passed: increment `passCount`
 * - Tests that failed: reset `passCount` to 0
 * - Tests with `passCount >= 5`: auto-removed (healed)
 * - Entries whose file no longer exists: auto-removed
 *
 * Writes atomically via temp file + rename to prevent corruption.
 *
 * Usage:
 *   npx tsx scripts/quarantine-heal.ts --results reports/vitest-results.json
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

interface QuarantineEntry {
  testName: string;
  file: string;
  quarantinedAt: string;
  passCount: number;
}

interface VitestTestResult {
  name: string;
  status: "passed" | "failed" | "skipped" | "pending";
}

interface VitestTestFile {
  filepath: string;
  tests: VitestTestResult[];
}

interface VitestJsonOutput {
  testResults: VitestTestFile[];
}

const QUARANTINE_PATH = path.resolve(import.meta.dirname, "../quarantine.json");
const HEAL_THRESHOLD = 5;

function loadEntries(): QuarantineEntry[] {
  try {
    const raw = readFileSync(QUARANTINE_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as QuarantineEntry[];
  } catch {
    return [];
  }
}

function loadTestResults(resultsPath: string): Map<string, Map<string, string>> {
  const resultMap = new Map<string, Map<string, string>>();

  try {
    const raw = readFileSync(resultsPath, "utf-8");
    const output: VitestJsonOutput = JSON.parse(raw);

    for (const fileResult of output.testResults) {
      const normalizedPath = path.resolve(fileResult.filepath);
      const testMap = new Map<string, string>();

      for (const test of fileResult.tests) {
        testMap.set(test.name, test.status);
      }

      resultMap.set(normalizedPath, testMap);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error reading test results: ${message}`);
    process.exitCode = 1;
  }

  return resultMap;
}

function saveEntriesAtomically(entries: QuarantineEntry[]): void {
  const tmpPath = QUARANTINE_PATH + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(entries, null, 2) + "\n", "utf-8");
  renameSync(tmpPath, QUARANTINE_PATH);
}

/* ── Main ─────────────────────────────────────────────────────────────── */

const { values } = parseArgs({
  options: {
    results: { type: "string" },
  },
});

if (!values.results) {
  console.error("Usage: npx tsx scripts/quarantine-heal.ts --results <path-to-vitest-json>");
  process.exitCode = 1;
} else {
  const entries = loadEntries();

  if (entries.length === 0) {
    console.log("Quarantine is empty — nothing to heal.");
    process.exit(0);
  }

  const resultsPath = path.resolve(values.results);
  if (!existsSync(resultsPath)) {
    console.error(`Error: Results file does not exist: ${values.results}`);
    process.exitCode = 1;
  } else {
    const testResults = loadTestResults(resultsPath);

    if (process.exitCode === 1) {
      // loadTestResults already set exitCode on error
      process.exit(1);
    }

    const healed: QuarantineEntry[] = [];
    const staleRemoved: QuarantineEntry[] = [];
    const stillQuarantined: QuarantineEntry[] = [];
    const failedReset: QuarantineEntry[] = [];

    const remaining: QuarantineEntry[] = [];

    for (const entry of entries) {
      const resolvedFile = path.resolve(entry.file);

      // Auto-remove entries whose file no longer exists
      if (!existsSync(resolvedFile)) {
        staleRemoved.push(entry);
        continue;
      }

      const fileResults = testResults.get(resolvedFile);
      const testStatus = fileResults?.get(entry.testName);

      if (testStatus === "passed") {
        const updatedEntry = { ...entry, passCount: entry.passCount + 1 };

        if (updatedEntry.passCount >= HEAL_THRESHOLD) {
          healed.push(updatedEntry);
        } else {
          remaining.push(updatedEntry);
          stillQuarantined.push(updatedEntry);
        }
      } else if (testStatus === "failed") {
        const resetEntry = { ...entry, passCount: 0 };
        remaining.push(resetEntry);
        failedReset.push(resetEntry);
      } else {
        // Test was skipped, not found in results, or had another status — keep as-is
        remaining.push(entry);
        stillQuarantined.push(entry);
      }
    }

    saveEntriesAtomically(remaining);

    // Report
    console.log("Quarantine healing report:");
    console.log(`  Total entries processed: ${entries.length}`);

    if (healed.length > 0) {
      console.log(`\n  Healed (auto-removed after ${HEAL_THRESHOLD} consecutive passes):`);
      for (const entry of healed) {
        console.log(`    - "${entry.testName}" (${entry.file})`);
      }
    }

    if (staleRemoved.length > 0) {
      console.log("\n  Stale (file no longer exists, auto-removed):");
      for (const entry of staleRemoved) {
        console.log(`    - "${entry.testName}" (${entry.file})`);
      }
    }

    if (failedReset.length > 0) {
      console.log("\n  Failed (passCount reset to 0):");
      for (const entry of failedReset) {
        console.log(`    - "${entry.testName}" (${entry.file})`);
      }
    }

    if (stillQuarantined.length > 0) {
      console.log("\n  Still quarantined:");
      for (const entry of stillQuarantined) {
        console.log(`    - "${entry.testName}" (${entry.file}) — passCount: ${entry.passCount}/5`);
      }
    }

    console.log(`\n  Remaining quarantined: ${remaining.length}`);

    const changed = healed.length > 0 || staleRemoved.length > 0 || failedReset.length > 0;
    if (changed) {
      console.log("\n  quarantine.json was updated.");
    } else {
      console.log("\n  No changes to quarantine.json.");
    }
  }
}
