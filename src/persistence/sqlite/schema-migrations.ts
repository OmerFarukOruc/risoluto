import type BetterSqlite3 from "better-sqlite3";

type SqliteDb = InstanceType<typeof BetterSqlite3>;

function bumpSchemaVersion(sqlite: SqliteDb, version: number): void {
  sqlite
    .prepare("INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)")
    .run(version, new Date().toISOString());
}

function hasSchemaVersion(sqlite: SqliteDb, version: number): boolean {
  const row = sqlite.prepare("SELECT version FROM schema_version WHERE version = ?").get(version) as
    | { version: number }
    | undefined;
  return row !== undefined;
}

function seedBaseSchemaVersion(sqlite: SqliteDb): void {
  const versionRow = sqlite.prepare("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1").get() as
    | { version: number }
    | undefined;
  if (!versionRow || versionRow.version < 3) {
    bumpSchemaVersion(sqlite, 3);
  }
}

function applyV4Migration(sqlite: SqliteDb): void {
  if (hasSchemaVersion(sqlite, 4)) return;
  try {
    sqlite.exec("ALTER TABLE attempts ADD COLUMN summary TEXT");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("duplicate column name: summary")) throw err;
  }
  bumpSchemaVersion(sqlite, 4);
}

function applyV5Migration(sqlite: SqliteDb): void {
  if (hasSchemaVersion(sqlite, 5)) return;
  try {
    sqlite.exec(`
      CREATE TABLE attempt_checkpoints (
        checkpoint_id INTEGER PRIMARY KEY AUTOINCREMENT,
        attempt_id    TEXT NOT NULL,
        ordinal       INTEGER NOT NULL,
        trigger       TEXT NOT NULL,
        event_cursor  INTEGER,
        status        TEXT NOT NULL,
        thread_id     TEXT,
        turn_id       TEXT,
        turn_count    INTEGER NOT NULL DEFAULT 0,
        input_tokens  INTEGER,
        output_tokens INTEGER,
        total_tokens  INTEGER,
        metadata      TEXT,
        created_at    TEXT NOT NULL,
        UNIQUE(attempt_id, ordinal)
      )
    `);
    sqlite.exec("CREATE INDEX idx_attempt_checkpoints_attempt_id ON attempt_checkpoints(attempt_id)");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("already exists")) throw err;
  }
  bumpSchemaVersion(sqlite, 5);
}

function applyV6Migration(sqlite: SqliteDb): void {
  if (hasSchemaVersion(sqlite, 6)) return;

  const existingColumns = sqlite.prepare("SELECT name FROM pragma_table_info('pull_requests')").all() as Array<{
    name: string;
  }>;
  const hasTable = existingColumns.length > 0;
  const hasCanonicalShape =
    hasTable &&
    existingColumns.some((column) => column.name === "pr_id") &&
    existingColumns.some((column) => column.name === "pull_number");

  if (!hasTable) {
    sqlite.exec(`
      CREATE TABLE pull_requests (
        pr_id            TEXT PRIMARY KEY,
        attempt_id       TEXT,
        issue_id         TEXT NOT NULL,
        owner            TEXT NOT NULL,
        repo             TEXT NOT NULL,
        pull_number      INTEGER NOT NULL,
        url              TEXT NOT NULL UNIQUE,
        branch_name      TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'open',
        merged_at        TEXT,
        merge_commit_sha TEXT,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
      )
    `);
  } else if (!hasCanonicalShape) {
    sqlite.exec(`
      CREATE TABLE pull_requests_v2 (
        pr_id            TEXT PRIMARY KEY,
        attempt_id       TEXT,
        issue_id         TEXT NOT NULL,
        owner            TEXT NOT NULL,
        repo             TEXT NOT NULL,
        pull_number      INTEGER NOT NULL,
        url              TEXT NOT NULL UNIQUE,
        branch_name      TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'open',
        merged_at        TEXT,
        merge_commit_sha TEXT,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
      )
    `);
    sqlite.exec(`
      INSERT INTO pull_requests_v2 (
        pr_id,
        attempt_id,
        issue_id,
        owner,
        repo,
        pull_number,
        url,
        branch_name,
        status,
        merged_at,
        merge_commit_sha,
        created_at,
        updated_at
      )
      SELECT
        CASE
          WHEN instr(repo, '/') > 0 THEN repo || '#' || number
          ELSE 'unknown/' || repo || '#' || number
        END,
        attempt_id,
        issue_id,
        CASE
          WHEN instr(repo, '/') > 0 THEN substr(repo, 1, instr(repo, '/') - 1)
          ELSE owner
        END,
        CASE
          WHEN instr(repo, '/') > 0 THEN substr(repo, instr(repo, '/') + 1)
          ELSE repo
        END,
        number,
        url,
        branch_name,
        status,
        merged_at,
        merge_commit_sha,
        created_at,
        updated_at
      FROM pull_requests
    `);
    sqlite.exec("DROP TABLE pull_requests");
    sqlite.exec("ALTER TABLE pull_requests_v2 RENAME TO pull_requests");
  }
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_pull_requests_status ON pull_requests(status)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_pull_requests_issue_id ON pull_requests(issue_id)");
  bumpSchemaVersion(sqlite, 6);
}

function applyV7Migration(sqlite: SqliteDb): void {
  if (hasSchemaVersion(sqlite, 7)) return;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id               TEXT PRIMARY KEY,
      type             TEXT NOT NULL,
      severity         TEXT NOT NULL CHECK(severity IN ('info','warning','critical')),
      title            TEXT NOT NULL,
      message          TEXT NOT NULL,
      source           TEXT,
      href             TEXT,
      read             INTEGER NOT NULL DEFAULT 0,
      dedupe_key       TEXT,
      metadata         TEXT,
      delivery_summary TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    )
  `);
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_notifications_read_created_at ON notifications(read, created_at)");
  bumpSchemaVersion(sqlite, 7);
}

function applyV8Migration(sqlite: SqliteDb): void {
  if (hasSchemaVersion(sqlite, 8)) return;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id               TEXT PRIMARY KEY,
      automation_name  TEXT NOT NULL,
      mode             TEXT NOT NULL CHECK(mode IN ('implement','report','findings')),
      trigger          TEXT NOT NULL CHECK(trigger IN ('schedule','manual')),
      repo_url         TEXT,
      status           TEXT NOT NULL CHECK(status IN ('running','completed','failed','skipped')),
      output           TEXT,
      details          TEXT,
      issue_id         TEXT,
      issue_identifier TEXT,
      issue_url        TEXT,
      error            TEXT,
      started_at       TEXT NOT NULL,
      finished_at      TEXT
    )
  `);
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at ON automation_runs(started_at)");
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS idx_automation_runs_name_started_at ON automation_runs(automation_name, started_at)",
  );
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id                 TEXT PRIMARY KEY,
      rule_name          TEXT NOT NULL,
      event_type         TEXT NOT NULL,
      severity           TEXT NOT NULL CHECK(severity IN ('info','warning','critical')),
      status             TEXT NOT NULL CHECK(status IN ('delivered','suppressed','partial_failure','failed')),
      channels           TEXT NOT NULL,
      delivered_channels TEXT NOT NULL,
      failed_channels    TEXT NOT NULL,
      message            TEXT NOT NULL,
      created_at         TEXT NOT NULL
    )
  `);
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_alert_history_rule_created_at ON alert_history(rule_name, created_at)");
  bumpSchemaVersion(sqlite, 8);
}

export function applySqliteSchemaMigrations(sqlite: SqliteDb): void {
  seedBaseSchemaVersion(sqlite);
  applyV4Migration(sqlite);
  applyV5Migration(sqlite);
  applyV6Migration(sqlite);
  applyV7Migration(sqlite);
  applyV8Migration(sqlite);
}
