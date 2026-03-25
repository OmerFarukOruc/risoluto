import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const attemptRows = sqliteTable("attempt_rows", {
  attemptId: text("attempt_id").primaryKey(),
  issueIdentifier: text("issue_identifier").notNull(),
  startedAt: text("started_at").notNull(),
  payload: text("payload").notNull(),
});

export const attemptEventRows = sqliteTable("attempt_event_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  attemptId: text("attempt_id").notNull(),
  position: integer("position").notNull(),
  payload: text("payload").notNull(),
});

export const configOverlayRows = sqliteTable("config_overlay_rows", {
  id: integer("id").primaryKey(),
  payload: text("payload").notNull(),
});

export const secretStateRows = sqliteTable("secret_state_rows", {
  id: integer("id").primaryKey(),
  envelope: text("envelope").notNull(),
});

export const secretAuditRows = sqliteTable("secret_audit_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: text("at").notNull(),
  operation: text("operation").notNull(),
  key: text("key").notNull(),
});
