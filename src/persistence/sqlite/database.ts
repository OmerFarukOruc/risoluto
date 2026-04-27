/**
 * SQLite database lifecycle management.
 *
 * Provides functions to open, configure, and close a SQLite database
 * using `better-sqlite3` for synchronous operations and WAL mode
 * for concurrent read performance.
 */

import BetterSqlite3, { type Database as BetterSqlite3Database } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { ensureSqliteSchema } from "./schema-ensure.js";
import * as schema from "./schema.js";

export type RisolutoDatabase = BetterSQLite3Database<typeof schema> & {
  $client: BetterSqlite3Database;
};

/**
 * Opens (or creates) a SQLite database at the given path,
 * enables WAL journal mode, and ensures the schema tables exist.
 *
 * @param dbPath - File path for the SQLite database. Use ":memory:" for in-memory databases.
 * @returns A Drizzle ORM database instance with the Risoluto schema.
 */
export function openDatabase(dbPath: string): RisolutoDatabase {
  const sqlite = new BetterSqlite3(dbPath);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("busy_timeout = 5000");

  ensureSqliteSchema(sqlite);

  return drizzle(sqlite, { schema });
}

/**
 * Closes the underlying SQLite connection for a Drizzle database instance.
 *
 * Drizzle wraps the raw `better-sqlite3` handle; this function extracts
 * the session and calls `.close()` on it to release file locks and flush WAL.
 */
export function closeDatabase(db: RisolutoDatabase): void {
  db.$client.close();
}
