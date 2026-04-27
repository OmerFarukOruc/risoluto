import type BetterSqlite3 from "better-sqlite3";

import { bootstrapSqliteSchema } from "./schema-bootstrap.js";
import { applySqliteSchemaMigrations } from "./schema-migrations.js";

type SqliteDb = InstanceType<typeof BetterSqlite3>;

export function ensureSqliteSchema(sqlite: SqliteDb): void {
  bootstrapSqliteSchema(sqlite);
  applySqliteSchemaMigrations(sqlite);
}
