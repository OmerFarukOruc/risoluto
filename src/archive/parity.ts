import path from "node:path";

import { readFileArchiveSnapshot } from "./file-archive.js";
import { readSqliteArchiveSnapshot } from "./sqlite-archive.js";
import type { FileArchiveSnapshot, ParityDiscrepancy, ParityReport, SqliteArchiveSnapshot } from "./types.js";

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function issueReference(fileSnapshot: FileArchiveSnapshot, issueIdentifier: string): string {
  return (
    fileSnapshot.issues.get(issueIdentifier)?.reference ??
    fileSnapshot.attempts.get(fileSnapshot.issues.get(issueIdentifier)?.attemptIds[0] ?? "")?.reference ??
    `${path.join(fileSnapshot.baseDir, "issue-index.json")}:1`
  );
}

function attemptReference(fileSnapshot: FileArchiveSnapshot, attemptId: string): string {
  const fileName = `${attemptId}.json`;
  return (
    fileSnapshot.attempts.get(attemptId)?.reference ?? `${path.join(fileSnapshot.baseDir, "attempts", fileName)}:1`
  );
}

function eventReference(fileSnapshot: FileArchiveSnapshot, attemptId: string): string {
  const fileName = `${attemptId}.jsonl`;
  return fileSnapshot.eventReferences.get(attemptId) ?? `${path.join(fileSnapshot.baseDir, "events", fileName)}:1`;
}

function checkIssueDiscrepancies(
  fileSnapshot: FileArchiveSnapshot,
  sqliteSnapshot: SqliteArchiveSnapshot,
  pushDiscrepancy: (reference: string, message: string) => void,
): void {
  const issueIdentifiers = [...new Set([...fileSnapshot.issues.keys(), ...sqliteSnapshot.issues.keys()])].sort();
  for (const issueIdentifier of issueIdentifiers) {
    const fileOrdering = fileSnapshot.issues.get(issueIdentifier)?.attemptIds ?? [];
    const sqliteOrdering = sqliteSnapshot.issues.get(issueIdentifier) ?? [];
    const reference = issueReference(fileSnapshot, issueIdentifier);

    if (fileOrdering.length !== sqliteOrdering.length) {
      pushDiscrepancy(
        reference,
        `issue ${issueIdentifier} attempt count mismatch: files=${fileOrdering.length}, sqlite=${sqliteOrdering.length}`,
      );
    }

    const fileLatestAttempt = fileOrdering[0] ?? null;
    const sqliteLatestAttempt = sqliteOrdering[0] ?? null;
    if (fileLatestAttempt !== sqliteLatestAttempt) {
      pushDiscrepancy(
        reference,
        `issue ${issueIdentifier} latest attempt mismatch: files=${fileLatestAttempt}, sqlite=${sqliteLatestAttempt}`,
      );
    }

    if (!arraysEqual(fileOrdering, sqliteOrdering)) {
      pushDiscrepancy(
        reference,
        `issue ${issueIdentifier} ordering mismatch: files=[${fileOrdering.join(", ")}], sqlite=[${sqliteOrdering.join(", ")}]`,
      );
    }
  }
}

function checkAttemptDiscrepancies(
  fileSnapshot: FileArchiveSnapshot,
  sqliteSnapshot: SqliteArchiveSnapshot,
  pushDiscrepancy: (reference: string, message: string) => void,
): void {
  const attemptIds = [...new Set([...fileSnapshot.attempts.keys(), ...sqliteSnapshot.attempts.keys()])].sort();
  for (const attemptId of attemptIds) {
    const fileAttempt = fileSnapshot.attempts.get(attemptId);
    const sqliteAttempt = sqliteSnapshot.attempts.get(attemptId);
    if (!fileAttempt) {
      pushDiscrepancy(
        attemptReference(fileSnapshot, attemptId),
        `attempt missing from file archive but present in sqlite: ${attemptId}`,
      );
      continue;
    }
    if (!sqliteAttempt) {
      pushDiscrepancy(
        attemptReference(fileSnapshot, attemptId),
        `attempt missing from sqlite but present in file archive: ${attemptId}`,
      );
      continue;
    }

    const fileEventCount = fileSnapshot.eventsByAttempt.get(attemptId)?.length ?? 0;
    const sqliteEventCount = sqliteSnapshot.eventCountsByAttempt.get(attemptId) ?? 0;
    if (fileEventCount !== sqliteEventCount) {
      pushDiscrepancy(
        eventReference(fileSnapshot, attemptId),
        `attempt ${attemptId} event count mismatch: files=${fileEventCount}, sqlite=${sqliteEventCount}`,
      );
    }

    if (fileAttempt.attempt.issueIdentifier !== sqliteAttempt.issueIdentifier) {
      pushDiscrepancy(
        attemptReference(fileSnapshot, attemptId),
        `attempt ${attemptId} issue mismatch: files=${fileAttempt.attempt.issueIdentifier}, sqlite=${sqliteAttempt.issueIdentifier}`,
      );
    }
  }
}

function buildDiscrepancies(
  fileSnapshot: FileArchiveSnapshot,
  sqliteSnapshot: SqliteArchiveSnapshot,
): ParityDiscrepancy[] {
  const discrepancies: ParityDiscrepancy[] = [];
  const pushDiscrepancy = (reference: string, message: string) => {
    discrepancies.push({ reference, message });
  };

  if (fileSnapshot.attempts.size !== sqliteSnapshot.attempts.size) {
    pushDiscrepancy(
      `${path.join(fileSnapshot.baseDir, "issue-index.json")}:1`,
      `attempt count mismatch: files=${fileSnapshot.attempts.size}, sqlite=${sqliteSnapshot.attempts.size}`,
    );
  }

  const fileEventTotal = [...fileSnapshot.eventsByAttempt.values()].reduce((sum, events) => sum + events.length, 0);
  const sqliteEventTotal = [...sqliteSnapshot.eventCountsByAttempt.values()].reduce((sum, count) => sum + count, 0);
  if (fileEventTotal !== sqliteEventTotal) {
    pushDiscrepancy(
      `${path.join(fileSnapshot.baseDir, "issue-index.json")}:1`,
      `event count mismatch: files=${fileEventTotal}, sqlite=${sqliteEventTotal}`,
    );
  }

  checkIssueDiscrepancies(fileSnapshot, sqliteSnapshot, pushDiscrepancy);
  checkAttemptDiscrepancies(fileSnapshot, sqliteSnapshot, pushDiscrepancy);

  return discrepancies;
}

export async function runParityCheck(options: { archiveDir: string; dbPath?: string | null }): Promise<ParityReport> {
  const fileSnapshot = await readFileArchiveSnapshot(options.archiveDir);
  const sqliteSnapshot = await readSqliteArchiveSnapshot(options.archiveDir, options.dbPath);
  return {
    fileSnapshot,
    sqliteSnapshot,
    discrepancies: buildDiscrepancies(fileSnapshot, sqliteSnapshot),
  };
}
