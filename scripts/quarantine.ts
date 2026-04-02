#!/usr/bin/env tsx
/**
 * CLI helper for managing the flaky test quarantine registry.
 *
 * Usage:
 *   npx tsx scripts/quarantine.ts add --test "test name" --file "path/to/test.ts"
 *   npx tsx scripts/quarantine.ts remove --test "test name"
 *   npx tsx scripts/quarantine.ts list
 *
 * The quarantine has a hard cap of 5 entries to prevent overuse.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

interface QuarantineEntry {
  testName: string;
  file: string;
  quarantinedAt: string;
  passCount: number;
}

const QUARANTINE_PATH = path.resolve(import.meta.dirname, "../quarantine.json");
const MAX_QUARANTINED = 5;

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

function saveEntries(entries: QuarantineEntry[]): void {
  writeFileSync(QUARANTINE_PATH, JSON.stringify(entries, null, 2) + "\n", "utf-8");
}

function addEntry(testName: string, file: string): void {
  const entries = loadEntries();

  if (entries.length >= MAX_QUARANTINED) {
    console.error(
      `Error: Quarantine is at capacity (${MAX_QUARANTINED} tests). Remove an entry before adding a new one.`,
    );
    process.exitCode = 1;
    return;
  }

  if (entries.some((entry) => entry.testName === testName && entry.file === file)) {
    console.error(`Error: Test "${testName}" in "${file}" is already quarantined.`);
    process.exitCode = 1;
    return;
  }

  const resolvedFile = path.resolve(file);
  if (!existsSync(resolvedFile)) {
    console.error(`Error: File does not exist: ${file}`);
    process.exitCode = 1;
    return;
  }

  const relativePath = path.relative(process.cwd(), resolvedFile);

  entries.push({
    testName,
    file: relativePath,
    quarantinedAt: new Date().toISOString(),
    passCount: 0,
  });

  saveEntries(entries);
  console.log(`Quarantined: "${testName}" in ${relativePath}`);
  console.log(`Quarantine usage: ${entries.length}/${MAX_QUARANTINED}`);
}

function removeEntry(testName: string): void {
  const entries = loadEntries();
  const index = entries.findIndex((entry) => entry.testName === testName);

  if (index === -1) {
    console.error(`Error: Test "${testName}" is not quarantined.`);
    process.exitCode = 1;
    return;
  }

  const removed = entries.splice(index, 1)[0];
  saveEntries(entries);
  console.log(`Unquarantined: "${removed.testName}" from ${removed.file}`);
  console.log(`Quarantine usage: ${entries.length}/${MAX_QUARANTINED}`);
}

function listEntries(): void {
  const entries = loadEntries();

  if (entries.length === 0) {
    console.log("Quarantine is empty.");
    return;
  }

  console.log(`Quarantined tests (${entries.length}/${MAX_QUARANTINED}):\n`);

  for (const entry of entries) {
    const age = Math.floor((Date.now() - new Date(entry.quarantinedAt).getTime()) / 86_400_000);
    console.log(`  - "${entry.testName}"`);
    console.log(`    File: ${entry.file}`);
    console.log(`    Quarantined: ${entry.quarantinedAt} (${age}d ago)`);
    console.log(`    Pass count: ${entry.passCount}/5`);
    console.log();
  }
}

/* ── Main ─────────────────────────────────────────────────────────────── */

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    test: { type: "string" },
    file: { type: "string" },
  },
});

const command = positionals[0];

switch (command) {
  case "add": {
    if (!values.test || !values.file) {
      console.error("Usage: npx tsx scripts/quarantine.ts add --test <name> --file <path>");
      process.exitCode = 1;
      break;
    }
    addEntry(values.test, values.file);
    break;
  }
  case "remove": {
    if (!values.test) {
      console.error("Usage: npx tsx scripts/quarantine.ts remove --test <name>");
      process.exitCode = 1;
      break;
    }
    removeEntry(values.test);
    break;
  }
  case "list": {
    listEntries();
    break;
  }
  default: {
    console.error("Usage: npx tsx scripts/quarantine.ts <add|remove|list>");
    console.error("  add    --test <name> --file <path>  Add a test to quarantine");
    console.error("  remove --test <name>                Remove a test from quarantine");
    console.error("  list                                Show quarantined tests");
    process.exitCode = 1;
  }
}
