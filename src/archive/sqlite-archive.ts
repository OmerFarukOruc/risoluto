import { asc, desc, sql } from "drizzle-orm";

import { closeDatabaseConnection, openDatabaseConnection } from "../db/connection.js";
import { attempts, events } from "../db/schema.js";
import type { SqliteArchiveSnapshot } from "./types.js";

export async function readSqliteArchiveSnapshot(
  baseDir: string,
  dbPath?: string | null,
): Promise<SqliteArchiveSnapshot> {
  const connection = openDatabaseConnection({ baseDir, dbPath });
  try {
    const attemptRows = connection.db
      .select({
        attemptId: attempts.attemptId,
        issueIdentifier: attempts.issueIdentifier,
      })
      .from(attempts)
      .orderBy(asc(attempts.issueIdentifier), desc(attempts.startedAt), desc(attempts.attemptId))
      .all();

    const attemptMap = new Map(attemptRows.map((row) => [row.attemptId, row]));
    const issues = new Map<string, string[]>();
    for (const row of attemptRows) {
      const issueAttempts = issues.get(row.issueIdentifier) ?? [];
      issueAttempts.push(row.attemptId);
      issues.set(row.issueIdentifier, issueAttempts);
    }

    const eventCounts = connection.db
      .select({
        attemptId: events.attemptId,
        count: sql<number>`count(*)`,
      })
      .from(events)
      .groupBy(events.attemptId)
      .all();

    return {
      attempts: attemptMap,
      eventCountsByAttempt: new Map(eventCounts.map((row) => [row.attemptId, row.count])),
      issues,
    };
  } finally {
    closeDatabaseConnection({ baseDir, dbPath });
  }
}
