#!/usr/bin/env node

import path from "node:path";
import { parseArgs } from "node:util";

import { runParityCheck } from "../src/archive/parity.js";

function printUsage(): void {
  console.log(`Usage: pnpm exec tsx scripts/parity-check.ts [archiveDir] [--db-path <path>]

Compare file-based archives under attempts/events against SQLite parity data.

Options:
  --db-path <path>   Use a specific SQLite database path
  -h, --help         Show this help message`);
}

function parseCliArgs(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "db-path": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  return {
    help: parsed.values.help ?? false,
    archiveDir: path.resolve(parsed.positionals[0] ?? ".symphony"),
    dbPath: parsed.values["db-path"] ? path.resolve(parsed.values["db-path"]) : null,
  };
}

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return 0;
  }

  const report = await runParityCheck({ archiveDir: args.archiveDir, dbPath: args.dbPath });
  for (const warning of report.fileSnapshot.warnings) {
    console.warn(`WARN ${warning.reference} ${warning.message}`);
  }

  if (report.discrepancies.length === 0) {
    console.log(
      `Parity check passed for ${args.archiveDir}: 0 discrepancies across ${report.fileSnapshot.attempts.size} attempts`,
    );
    return 0;
  }

  for (const discrepancy of report.discrepancies) {
    console.error(`DISCREPANCY ${discrepancy.reference} ${discrepancy.message}`);
  }
  console.error(`Parity check failed for ${args.archiveDir}: ${report.discrepancies.length} discrepancies found`);
  return 1;
}

process.exitCode = await main();
