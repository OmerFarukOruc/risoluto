import type { AttemptEvent, AttemptRecord } from "@symphony/shared";

export interface ArchiveWarning {
  reference: string;
  message: string;
}

export interface FileAttemptSnapshot {
  attempt: AttemptRecord;
  reference: string;
}

export interface FileIssueSnapshot {
  attemptIds: string[];
  reference: string | null;
}

export interface FileArchiveSnapshot {
  baseDir: string;
  attempts: Map<string, FileAttemptSnapshot>;
  eventsByAttempt: Map<string, AttemptEvent[]>;
  eventReferences: Map<string, string>;
  issues: Map<string, FileIssueSnapshot>;
  warnings: ArchiveWarning[];
}

export interface SqliteAttemptSnapshot {
  attemptId: string;
  issueIdentifier: string;
}

export interface SqliteArchiveSnapshot {
  attempts: Map<string, SqliteAttemptSnapshot>;
  eventCountsByAttempt: Map<string, number>;
  issues: Map<string, string[]>;
}

export interface ParityDiscrepancy {
  reference: string;
  message: string;
}

export interface ParityReport {
  fileSnapshot: FileArchiveSnapshot;
  sqliteSnapshot: SqliteArchiveSnapshot;
  discrepancies: ParityDiscrepancy[];
}

export interface BackfillResult {
  archiveDir: string;
  dbPath: string;
  attemptCount: number;
  eventCount: number;
  warnings: ArchiveWarning[];
}
