import pino, { type Logger } from "pino";

import type { SymphonyLogger } from "./types.js";

function normalizeArgs(meta: unknown, message?: string): { message?: string; meta?: Record<string, unknown> } {
  if (typeof meta === "string" && message === undefined) {
    return { message: meta };
  }

  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return { message, meta: meta as Record<string, unknown> };
  }

  if (meta === undefined) {
    return { message };
  }

  return {
    message,
    meta: {
      value: meta,
    },
  };
}

class PinoSymphonyLogger implements SymphonyLogger {
  constructor(private readonly logger: Logger) {}

  debug(meta: unknown, message?: string): void {
    const normalized = normalizeArgs(meta, message);
    this.logger.debug(normalized.meta ?? {}, normalized.message ?? "");
  }

  info(meta: unknown, message?: string): void {
    const normalized = normalizeArgs(meta, message);
    this.logger.info(normalized.meta ?? {}, normalized.message ?? "");
  }

  warn(meta: unknown, message?: string): void {
    const normalized = normalizeArgs(meta, message);
    this.logger.warn(normalized.meta ?? {}, normalized.message ?? "");
  }

  error(meta: unknown, message?: string): void {
    const normalized = normalizeArgs(meta, message);
    this.logger.error(normalized.meta ?? {}, normalized.message ?? "");
  }

  child(meta: Record<string, unknown>): SymphonyLogger {
    return new PinoSymphonyLogger(this.logger.child(meta));
  }
}

export function createLogger(): SymphonyLogger {
  const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    messageKey: "msg",
  });

  return new PinoSymphonyLogger(logger);
}
