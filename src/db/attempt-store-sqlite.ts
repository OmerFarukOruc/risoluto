import { asc, desc, eq, sql } from "drizzle-orm";

import type { AttemptEvent, AttemptStore, AttemptRecord, SymphonyLogger } from "@symphony/shared";

import { closeDatabaseConnection, openDatabaseConnection, type SqliteConnection } from "./connection.js";
import { fromAttemptRow, fromEventRow, toAttemptInsert, toEventInsert } from "./attempt-store-codec.js";
import { attempts, events, type AttemptRow, type EventRow } from "./schema.js";

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

export class AttemptStoreSqlite implements AttemptStore {
  private connection: SqliteConnection | null = null;

  constructor(
    private readonly baseDir: string,
    private readonly logger: SymphonyLogger,
    private readonly options?: { dbPath?: string | null },
  ) {}

  async start(): Promise<void> {
    this.connection = openDatabaseConnection({ baseDir: this.baseDir, dbPath: this.options?.dbPath });
  }

  close(): void {
    closeDatabaseConnection({ baseDir: this.baseDir, dbPath: this.options?.dbPath });
    this.connection = null;
  }

  getAttempt(attemptId: string): AttemptRecord | null {
    const row = this.connectionOrOpen().db.select().from(attempts).where(eq(attempts.attemptId, attemptId)).get();
    return row ? this.hydrateAttempt(row) : null;
  }

  getAllAttempts(): AttemptRecord[] {
    return this.connectionOrOpen()
      .db.select()
      .from(attempts)
      .all()
      .map((row) => this.hydrateAttempt(row))
      .filter(isPresent);
  }

  getEvents(attemptId: string): AttemptEvent[] {
    return this.connectionOrOpen()
      .db.select()
      .from(events)
      .where(eq(events.attemptId, attemptId))
      .orderBy(asc(events.sequence))
      .all()
      .map((row) => this.hydrateEvent(row))
      .filter(isPresent);
  }

  getAttemptsForIssue(issueIdentifier: string): AttemptRecord[] {
    return this.connectionOrOpen()
      .db.select()
      .from(attempts)
      .where(eq(attempts.issueIdentifier, issueIdentifier))
      .orderBy(desc(attempts.startedAt), desc(attempts.attemptId))
      .all()
      .map((row) => this.hydrateAttempt(row))
      .filter(isPresent);
  }

  async createAttempt(attempt: AttemptRecord): Promise<void> {
    const values = toAttemptInsert(attempt);
    this.connectionOrOpen()
      .db.insert(attempts)
      .values(values)
      .onConflictDoUpdate({
        target: attempts.attemptId,
        set: values,
      })
      .run();
  }

  async updateAttempt(attemptId: string, patch: Partial<AttemptRecord>): Promise<void> {
    const current = this.getAttempt(attemptId);
    if (!current) {
      throw new Error(`unknown attempt id: ${attemptId}`);
    }
    const next = { ...current, ...patch };
    const values = toAttemptInsert(next);
    this.connectionOrOpen()
      .db.insert(attempts)
      .values(values)
      .onConflictDoUpdate({
        target: attempts.attemptId,
        set: values,
      })
      .run();
  }

  async appendEvent(event: AttemptEvent): Promise<void> {
    const connection = this.connectionOrOpen();
    const current = connection.db
      .select({ maxSequence: sql<number>`coalesce(max(${events.sequence}), -1)` })
      .from(events)
      .where(eq(events.attemptId, event.attemptId))
      .get();
    const nextSequence = (current?.maxSequence ?? -1) + 1;
    connection.db.insert(events).values(toEventInsert(event, nextSequence)).run();
  }

  private connectionOrOpen(): SqliteConnection {
    if (!this.connection) {
      this.connection = openDatabaseConnection({ baseDir: this.baseDir, dbPath: this.options?.dbPath });
    }
    return this.connection;
  }

  private hydrateAttempt(row: AttemptRow): AttemptRecord | null {
    try {
      return fromAttemptRow(row);
    } catch (error) {
      this.logger.warn({ attemptId: row.attemptId, error: String(error) }, "failed to hydrate sqlite attempt row");
      return null;
    }
  }

  private hydrateEvent(row: EventRow): AttemptEvent | null {
    try {
      return fromEventRow(row);
    } catch (error) {
      this.logger.warn({ attemptId: row.attemptId, error: String(error) }, "failed to hydrate sqlite event row");
      return null;
    }
  }
}
