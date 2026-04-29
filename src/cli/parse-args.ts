import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { createLogger } from "../core/logger.js";
import { initErrorTracking } from "../core/error-tracking.js";
import type { RisolutoLogger } from "../core/types.js";

function parsePortValue(rawPort: string | undefined): number | undefined {
  if (rawPort === undefined) return undefined;
  // Reject empty, non-digit, and leading-zero forms (e.g. "00000004000")
  // which would otherwise pass the old \d+ check and silently coerce. Also
  // enforce a real TCP port range (1–65535) — 0 means "any free port" and
  // is not something anvil should inherit unintentionally.
  if (!/^[1-9]\d*$/.test(rawPort)) {
    throw new TypeError(
      `invalid --port value: ${rawPort}. Expected an integer between 1 and 65535 with no leading zeros.`,
    );
  }
  const value = Number(rawPort);
  if (value < 1 || value > 65535) {
    throw new TypeError(`invalid --port value: ${rawPort}. Expected an integer between 1 and 65535.`);
  }
  return value;
}

export function parseCliArgs(argv: string[]): {
  dataDir: string;
  archiveDir: string;
  selectedPort: number | undefined;
  logger: RisolutoLogger;
} {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      port: { type: "string" },
      "data-dir": { type: "string" },
    },
  });

  const logger = createLogger();
  initErrorTracking(logger.child({ component: "error-tracking" }));
  const dataDir = path.resolve(parsed.values["data-dir"] ?? process.env.DATA_DIR ?? path.join(homedir(), ".risoluto"));
  const archiveDir = path.resolve(path.join(dataDir, "archives"));
  // Precedence: explicit --port CLI flag > ANVIL_BACKEND_PORT env var > config.server.port.
  // External orchestrators may set ANVIL_BACKEND_PORT on the parent process
  // so parallel child runs bind unique backend ports.
  const selectedPort = parsePortValue(parsed.values.port) ?? parsePortValue(process.env.ANVIL_BACKEND_PORT);
  return { dataDir, archiveDir, selectedPort, logger };
}
