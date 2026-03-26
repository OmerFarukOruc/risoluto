import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

import { getRequestId } from "../observability/tracing.js";
import { isRecord } from "../utils/type-guards.js";
import type { SymphonyLogger } from "./types.js";

function normalizeArgs(meta: unknown, message?: string): { message?: string; meta?: Record<string, unknown> } {
  if (typeof meta === "string" && message === undefined) {
    return { message: meta };
  }

  if (isRecord(meta)) {
    return { message, meta };
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

function extractKeyValueMetadata(message?: string): Record<string, string> {
  if (message === undefined) {
    return {};
  }

  const matches = message.matchAll(/\b(\w+)=([^\s]+)/g);
  const fields: Record<string, string> = {};
  for (const match of matches) {
    const key = match[1];
    const value = match[2];
    if (key !== undefined && value !== undefined) {
      fields[key] = value;
    }
  }
  return fields;
}

function buildMetadata(meta: Record<string, unknown> | undefined, message?: string): Record<string, unknown> {
  return {
    ...extractKeyValueMetadata(message),
    ...meta,
  };
}

function createPinoOptions(): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL ?? "info",
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    messageKey: "msg",
    mixin() {
      const requestId = getRequestId();
      return requestId === null ? {} : { request_id: requestId };
    },
  };
}

function createPrettyTransport(): pino.TransportSingleOptions | undefined {
  if (process.env.NODE_ENV !== "development") {
    return undefined;
  }

  return {
    target: "pino-pretty",
    options: {
      colorize: true,
      singleLine: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  };
}

export class PinoSymphonyLogger implements SymphonyLogger {
  constructor(private readonly logger: Logger) {}

  debug(meta: unknown, message?: string): void {
    const normalized = normalizeArgs(meta, message);
    this.logger.debug(buildMetadata(normalized.meta, normalized.message), normalized.message ?? "");
  }

  info(meta: unknown, message?: string): void {
    const normalized = normalizeArgs(meta, message);
    this.logger.info(buildMetadata(normalized.meta, normalized.message), normalized.message ?? "");
  }

  warn(meta: unknown, message?: string): void {
    const normalized = normalizeArgs(meta, message);
    this.logger.warn(buildMetadata(normalized.meta, normalized.message), normalized.message ?? "");
  }

  error(meta: unknown, message?: string): void {
    const normalized = normalizeArgs(meta, message);
    this.logger.error(buildMetadata(normalized.meta, normalized.message), normalized.message ?? "");
  }

  child(meta: Record<string, unknown>): SymphonyLogger {
    return new PinoSymphonyLogger(this.logger.child(meta));
  }
}

export function createPinoLogger(destination?: DestinationStream): SymphonyLogger {
  const transport = createPrettyTransport();
  const logger = destination
    ? pino(createPinoOptions(), destination)
    : transport
      ? pino(createPinoOptions(), pino.transport(transport))
      : pino(createPinoOptions());

  return new PinoSymphonyLogger(logger);
}
