import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLogger } from "../../src/core/logger.js";
import type { AttemptEvent, AttemptRecord } from "../../src/core/types.js";
import { AttemptStoreSqlite } from "../../src/db/attempt-store-sqlite.js";
import { closeDatabaseConnection, resolveDatabasePath } from "../../src/db/connection.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "symphony-db-attempt-store-"));
  tempDirs.push(dir);
  return dir;
}

function createAttempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    attemptId: "attempt-1",
    issueId: "issue-1",
    issueIdentifier: "DB-42",
    title: "SQLite attempt store",
    workspaceKey: "DB-42",
    workspacePath: "/tmp/symphony/DB-42",
    status: "running",
    attemptNumber: 1,
    startedAt: "2026-03-26T10:00:00.000Z",
    endedAt: null,
    model: "gpt-5.4",
    reasoningEffort: "high",
    modelSource: "default",
    threadId: null,
    turnId: null,
    turnCount: 1,
    errorCode: null,
    errorMessage: null,
    tokenUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    pullRequestUrl: null,
    stopSignal: null,
    ...overrides,
  };
}

function createEvent(overrides: Partial<AttemptEvent> = {}): AttemptEvent {
  return {
    attemptId: "attempt-1",
    at: "2026-03-26T10:01:00.000Z",
    issueId: "issue-1",
    issueIdentifier: "DB-42",
    sessionId: "session-1",
    event: "attempt.updated",
    message: "updated",
    content: "delta",
    metadata: { phase: "run" },
    usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
    rateLimits: { requestsRemaining: 10 },
    ...overrides,
  };
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    closeDatabaseConnection({ baseDir: dir });
    await rm(dir, { recursive: true, force: true });
  }
  delete process.env.DB_PATH;
});

describe("AttemptStoreSqlite", () => {
  it("creates updates and fetches attempts", async () => {
    const baseDir = await createTempDir();
    const store = new AttemptStoreSqlite(baseDir, createLogger());
    await store.start();

    const attempt = createAttempt();
    await store.createAttempt(attempt);
    await store.updateAttempt(attempt.attemptId, {
      status: "completed",
      endedAt: "2026-03-26T10:02:00.000Z",
    });

    expect(store.getAttempt(attempt.attemptId)).toEqual({
      ...attempt,
      status: "completed",
      endedAt: "2026-03-26T10:02:00.000Z",
    });
    expect(store.getAttemptsForIssue("DB-42")).toHaveLength(1);
    expect(store.getAllAttempts()).toHaveLength(1);
  });

  it("stores events in append order", async () => {
    const baseDir = await createTempDir();
    const store = new AttemptStoreSqlite(baseDir, createLogger());
    await store.start();
    await store.createAttempt(createAttempt());

    const firstEvent = createEvent({
      at: "2026-03-26T10:01:00.000Z",
      event: "attempt.started",
      message: "started",
    });
    const secondEvent = createEvent({
      at: "2026-03-26T10:02:00.000Z",
      event: "attempt.completed",
      message: "completed",
      content: null,
    });

    await store.appendEvent(firstEvent);
    await store.appendEvent(secondEvent);

    expect(store.getEvents("attempt-1")).toEqual([firstEvent, secondEvent]);
  });

  it("resolves database path from DB_PATH env when provided", async () => {
    const baseDir = await createTempDir();
    process.env.DB_PATH = path.join(baseDir, "custom", "runtime.sqlite");

    expect(resolveDatabasePath(baseDir)).toBe(path.resolve(baseDir, "custom", "runtime.sqlite"));

    const store = new AttemptStoreSqlite(baseDir, createLogger());
    await store.start();
    await store.createAttempt(createAttempt());

    expect(store.getAttempt("attempt-1")).not.toBeNull();
  });
});
