import { eq } from "drizzle-orm";

import { resolveDatabasePath, closeDatabaseConnection, openDatabaseConnection } from "../db/connection.js";
import { toAttemptInsert, toEventInsert } from "../db/attempt-store-codec.js";
import { attempts, events } from "../db/schema.js";
import { readFileArchiveSnapshot } from "./file-archive.js";
import type { BackfillResult } from "./types.js";

export async function backfillArchiveToSqlite(options: {
  archiveDir: string;
  dbPath?: string | null;
}): Promise<BackfillResult> {
  const fileSnapshot = await readFileArchiveSnapshot(options.archiveDir);
  const databasePath = resolveDatabasePath(options.archiveDir, options.dbPath);
  const connection = openDatabaseConnection({ baseDir: options.archiveDir, dbPath: options.dbPath });
  const orderedAttempts = [...fileSnapshot.attempts.values()]
    .map((entry) => entry.attempt)
    .sort(
      (left, right) => left.startedAt.localeCompare(right.startedAt) || left.attemptId.localeCompare(right.attemptId),
    );

  try {
    connection.db.transaction((tx) => {
      for (const attempt of orderedAttempts) {
        const attemptValues = toAttemptInsert(attempt);
        tx.insert(attempts)
          .values(attemptValues)
          .onConflictDoUpdate({
            target: attempts.attemptId,
            set: attemptValues,
          })
          .run();

        tx.delete(events).where(eq(events.attemptId, attempt.attemptId)).run();
        const archiveEvents = fileSnapshot.eventsByAttempt.get(attempt.attemptId) ?? [];
        if (archiveEvents.length === 0) {
          continue;
        }
        tx.insert(events)
          .values(archiveEvents.map((event, index) => toEventInsert(event, index)))
          .run();
      }
    });
  } finally {
    closeDatabaseConnection({ baseDir: options.archiveDir, dbPath: options.dbPath });
  }

  return {
    archiveDir: options.archiveDir,
    dbPath: databasePath,
    attemptCount: orderedAttempts.length,
    eventCount: [...fileSnapshot.eventsByAttempt.values()].reduce(
      (sum, archiveEvents) => sum + archiveEvents.length,
      0,
    ),
    warnings: fileSnapshot.warnings,
  };
}
