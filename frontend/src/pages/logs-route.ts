export type LogsMode = "live" | "archive";

export function resolveInitialLogsMode(pathname: string): LogsMode {
  return pathname.startsWith("/issues/") ? "archive" : "live";
}

export function shouldFallbackToArchive(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Unknown issue identifier");
}
