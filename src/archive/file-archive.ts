import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { AttemptEvent, AttemptRecord } from "@symphony/shared";

import type { ArchiveWarning, FileArchiveSnapshot, FileIssueSnapshot } from "./types.js";

function sortAttemptsDesc(left: AttemptRecord, right: AttemptRecord): number {
  return right.startedAt.localeCompare(left.startedAt) || right.attemptId.localeCompare(left.attemptId);
}

function buildMissingReference(filePath: string): string {
  return `${filePath}:1`;
}

function addWarning(warnings: ArchiveWarning[], reference: string, message: string): void {
  warnings.push({ reference, message });
}

async function readDirectoryEntries(dirPath: string, warnings: ArchiveWarning[], label: string) {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      addWarning(warnings, buildMissingReference(dirPath), `${label} directory missing; treating as empty`);
      return [];
    }
    throw error;
  }
}

async function readOptionalFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function parseIssueIndexReferences(issueIndexText: string): Map<string, string> {
  const references = new Map<string, string>();
  const lines = issueIndexText.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^\s+"([^"]+)": \[/u);
    if (match) {
      references.set(match[1], `${index + 1}`);
    }
  }
  return references;
}

function mergeIssueIndex(
  issueIndexPath: string,
  issueIndexText: string,
  derivedIssues: Map<string, FileIssueSnapshot>,
  warnings: ArchiveWarning[],
): Map<string, FileIssueSnapshot> {
  try {
    const issueIndex = JSON.parse(issueIndexText) as Record<string, string[]>;
    const lineReferences = parseIssueIndexReferences(issueIndexText);
    for (const [issueIdentifier, indexedAttemptIds] of Object.entries(issueIndex)) {
      const derivedAttemptIds = derivedIssues.get(issueIdentifier)?.attemptIds ?? [];
      const mergedAttemptIds = [...indexedAttemptIds];
      for (const attemptId of derivedAttemptIds) {
        if (!mergedAttemptIds.includes(attemptId)) {
          mergedAttemptIds.push(attemptId);
        }
      }
      derivedIssues.set(issueIdentifier, {
        attemptIds: mergedAttemptIds,
        reference: lineReferences.has(issueIdentifier)
          ? `${issueIndexPath}:${lineReferences.get(issueIdentifier)}`
          : (derivedIssues.get(issueIdentifier)?.reference ?? buildMissingReference(issueIndexPath)),
      });
    }
    return derivedIssues;
  } catch (error) {
    addWarning(
      warnings,
      `${issueIndexPath}:1`,
      `issue index is invalid JSON; deriving ordering from attempts (${String(error)})`,
    );
    return derivedIssues;
  }
}

function buildIssueSnapshots(
  attempts: Map<string, { attempt: AttemptRecord; reference: string }>,
  issueIndexPath: string,
  issueIndexText: string | null,
  warnings: ArchiveWarning[],
): Map<string, FileIssueSnapshot> {
  const groupedAttempts = new Map<string, AttemptRecord[]>();
  for (const { attempt } of attempts.values()) {
    const entries = groupedAttempts.get(attempt.issueIdentifier) ?? [];
    entries.push(attempt);
    groupedAttempts.set(attempt.issueIdentifier, entries);
  }

  const derivedIssues = new Map<string, FileIssueSnapshot>();
  for (const [issueIdentifier, issueAttempts] of groupedAttempts) {
    const sorted = [...issueAttempts].sort(sortAttemptsDesc);
    derivedIssues.set(issueIdentifier, {
      attemptIds: sorted.map((attempt: AttemptRecord) => attempt.attemptId),
      reference: attempts.get(sorted[0].attemptId)?.reference ?? buildMissingReference(issueIndexPath),
    });
  }

  if (issueIndexText === null) {
    addWarning(
      warnings,
      buildMissingReference(issueIndexPath),
      "issue index missing; deriving per-issue ordering from attempts",
    );
    return derivedIssues;
  }

  return mergeIssueIndex(issueIndexPath, issueIndexText, derivedIssues, warnings);
}

async function readEventArchive(eventPath: string, warnings: ArchiveWarning[]): Promise<AttemptEvent[]> {
  const text = await readOptionalFile(eventPath);
  if (text === null) {
    return [];
  }

  const events: AttemptEvent[] = [];
  const lines = text.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    try {
      events.push(JSON.parse(trimmed) as AttemptEvent);
    } catch (error) {
      addWarning(warnings, `${eventPath}:${index + 1}`, `corrupt JSONL line skipped (${String(error)})`);
    }
  }

  if (events.length > 1 && new Date(events[0].at).getTime() > new Date(events.at(-1)?.at ?? 0).getTime()) {
    events.reverse();
  }

  return events;
}

export async function readFileArchiveSnapshot(baseDir: string): Promise<FileArchiveSnapshot> {
  const warnings: ArchiveWarning[] = [];
  const attempts = new Map<string, { attempt: AttemptRecord; reference: string }>();
  const eventsByAttempt = new Map<string, AttemptEvent[]>();
  const eventReferences = new Map<string, string>();
  const attemptsDir = path.join(baseDir, "attempts");
  const eventsDir = path.join(baseDir, "events");
  const issueIndexPath = path.join(baseDir, "issue-index.json");

  const attemptEntries = await readDirectoryEntries(attemptsDir, warnings, "attempt archive");
  for (const entry of [...attemptEntries].sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const attemptPath = path.join(attemptsDir, entry.name);
    try {
      const attempt = JSON.parse(await readFile(attemptPath, "utf8")) as AttemptRecord;
      attempts.set(attempt.attemptId, { attempt, reference: `${attemptPath}:1` });

      const eventPath = path.join(eventsDir, `${attempt.attemptId}.jsonl`);
      eventReferences.set(attempt.attemptId, `${eventPath}:1`);
      eventsByAttempt.set(attempt.attemptId, await readEventArchive(eventPath, warnings));
    } catch (error) {
      addWarning(warnings, `${attemptPath}:1`, `attempt archive skipped (${String(error)})`);
    }
  }

  const issues = buildIssueSnapshots(attempts, issueIndexPath, await readOptionalFile(issueIndexPath), warnings);
  await readDirectoryEntries(eventsDir, warnings, "event archive");

  return {
    baseDir,
    attempts,
    eventsByAttempt,
    eventReferences,
    issues,
    warnings,
  };
}
