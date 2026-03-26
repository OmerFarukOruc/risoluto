#!/usr/bin/env node

import path from "node:path";
import { parseArgs } from "node:util";

import { backfillArchiveToSqlite } from "../src/archive/backfill.js";
import { runParityCheck } from "../src/archive/parity.js";

function printUsage(): void {
  console.log(`Usage: pnpm exec tsx scripts/backfill.ts [archiveDir] [--db-path <path>]

Backfill file-based attempt/event archives into SQLite, then verify parity.

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

  const result = await backfillArchiveToSqlite({ archiveDir: args.archiveDir, dbPath: args.dbPath });
  for (const warning of result.warnings) {
    console.warn(`WARN ${warning.reference} ${warning.message}`);
  }

  console.log(`Backfilled ${result.attemptCount} attempts and ${result.eventCount} events into ${result.dbPath}`);

  const parityReport = await runParityCheck({ archiveDir: args.archiveDir, dbPath: args.dbPath });
  for (const discrepancy of parityReport.discrepancies) {
    console.error(`DISCREPANCY ${discrepancy.reference} ${discrepancy.message}`);
  }

  if (parityReport.discrepancies.length > 0) {
    console.error(`Backfill verification failed: ${parityReport.discrepancies.length} discrepancies remain`);
    return 1;
  }

  console.log(`Backfill verification passed for ${args.archiveDir}`);
  return 0;
}

process.exitCode = await main();
