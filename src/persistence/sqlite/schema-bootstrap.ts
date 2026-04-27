import type BetterSqlite3 from "better-sqlite3";

type SqliteDb = InstanceType<typeof BetterSqlite3>;

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS attempts (
    attempt_id       TEXT PRIMARY KEY,
    issue_id         TEXT NOT NULL,
    issue_identifier TEXT NOT NULL,
    title            TEXT NOT NULL,
    workspace_key    TEXT,
    workspace_path   TEXT,
    status           TEXT NOT NULL CHECK(status IN ('running','completed','failed','timed_out','stalled','cancelled','paused')),
    attempt_number   INTEGER,
    started_at       TEXT NOT NULL,
    ended_at         TEXT,
    model            TEXT NOT NULL,
    reasoning_effort TEXT CHECK(reasoning_effort IS NULL OR reasoning_effort IN ('none','minimal','low','medium','high','xhigh')),
    model_source     TEXT NOT NULL CHECK(model_source IN ('default','override')),
    thread_id        TEXT,
    turn_id          TEXT,
    turn_count       INTEGER NOT NULL DEFAULT 0,
    error_code       TEXT,
    error_message    TEXT,
    input_tokens     INTEGER,
    output_tokens    INTEGER,
    total_tokens     INTEGER,
    pull_request_url TEXT,
    stop_signal      TEXT CHECK(stop_signal IS NULL OR stop_signal IN ('done','blocked')),
    summary          TEXT
  );

  CREATE TABLE IF NOT EXISTS attempt_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id       TEXT NOT NULL REFERENCES attempts(attempt_id),
    timestamp        TEXT NOT NULL,
    issue_id         TEXT,
    issue_identifier TEXT,
    session_id       TEXT,
    type             TEXT NOT NULL,
    message          TEXT NOT NULL,
    content          TEXT,
    input_tokens     INTEGER,
    output_tokens    INTEGER,
    total_tokens     INTEGER,
    metadata         TEXT
  );

  CREATE TABLE IF NOT EXISTS issue_index (
    issue_identifier  TEXT PRIMARY KEY,
    issue_id          TEXT NOT NULL,
    latest_attempt_id TEXT REFERENCES attempts(attempt_id),
    latest_status     TEXT,
    attempt_count     INTEGER NOT NULL DEFAULT 0,
    updated_at        TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_attempts_issue_id ON attempts(issue_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_issue_identifier ON attempts(issue_identifier);
  CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(status);
  CREATE INDEX IF NOT EXISTS idx_attempt_events_attempt_id ON attempt_events(attempt_id);

  CREATE TABLE IF NOT EXISTS config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS encrypted_secrets (
    key        TEXT PRIMARY KEY,
    ciphertext TEXT NOT NULL,
    iv         TEXT NOT NULL,
    auth_tag   TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prompt_templates (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS config_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name      TEXT NOT NULL,
    key             TEXT NOT NULL,
    path            TEXT,
    operation       TEXT NOT NULL,
    previous_value  TEXT,
    new_value       TEXT,
    actor           TEXT NOT NULL DEFAULT 'dashboard',
    request_id      TEXT,
    timestamp       TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_config_history_table_key ON config_history(table_name, key);
  CREATE INDEX IF NOT EXISTS idx_config_history_timestamp ON config_history(timestamp);

  CREATE TABLE IF NOT EXISTS issue_config (
    identifier        TEXT PRIMARY KEY,
    model             TEXT,
    reasoning_effort  TEXT CHECK(reasoning_effort IS NULL OR reasoning_effort IN ('none','minimal','low','medium','high','xhigh')),
    template_id       TEXT
  );

  CREATE TABLE IF NOT EXISTS webhook_inbox (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id       TEXT NOT NULL UNIQUE,
    received_at       TEXT NOT NULL,
    type              TEXT NOT NULL,
    action            TEXT NOT NULL,
    entity_id         TEXT,
    issue_id          TEXT,
    issue_identifier  TEXT,
    webhook_timestamp INTEGER,
    payload_json      TEXT,
    status            TEXT NOT NULL DEFAULT 'received'
                      CHECK(status IN ('received','processing','applied','ignored','retry','dead_letter')),
    attempt_count     INTEGER NOT NULL DEFAULT 0,
    next_attempt_at   TEXT,
    last_error        TEXT,
    applied_at        TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_webhook_inbox_status ON webhook_inbox(status);
  CREATE INDEX IF NOT EXISTS idx_webhook_inbox_issue_id ON webhook_inbox(issue_id);
  CREATE INDEX IF NOT EXISTS idx_webhook_inbox_next_attempt ON webhook_inbox(next_attempt_at);

  CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attempt_checkpoints (
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
  );

  CREATE INDEX IF NOT EXISTS idx_attempt_checkpoints_attempt_id ON attempt_checkpoints(attempt_id);

  CREATE TABLE IF NOT EXISTS pull_requests (
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
  );

  CREATE INDEX IF NOT EXISTS idx_pull_requests_status ON pull_requests(status);
  CREATE INDEX IF NOT EXISTS idx_pull_requests_issue_id ON pull_requests(issue_id);

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
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_read_created_at ON notifications(read, created_at);

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
  );

  CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at ON automation_runs(started_at);
  CREATE INDEX IF NOT EXISTS idx_automation_runs_name_started_at ON automation_runs(automation_name, started_at);

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
  );

  CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at);
  CREATE INDEX IF NOT EXISTS idx_alert_history_rule_created_at ON alert_history(rule_name, created_at);
`;

export function bootstrapSqliteSchema(sqlite: SqliteDb): void {
  sqlite.exec(CREATE_TABLES_SQL);
}
