import type { SymphonyLogger } from "./types.js";
import { createPinoLogger } from "./pino-logger.js";

export function createLogger(): SymphonyLogger {
  return createPinoLogger();
}
