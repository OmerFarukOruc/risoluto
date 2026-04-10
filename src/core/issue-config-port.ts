/** A single row from the `issue_config` table. */
export interface IssueConfigRow {
  identifier: string;
  model: string | null;
  reasoningEffort: string | null;
  templateId: string | null;
}

/** Port for reading and mutating per-issue configuration entries. */
export interface IssueConfigStorePort {
  /** Returns all rows from the `issue_config` table. */
  loadAll(): IssueConfigRow[];

  /**
   * Inserts or updates the model/reasoningEffort columns for an identifier.
   * Preserves the existing templateId if a row already exists.
   */
  upsertModel(identifier: string, model: string, reasoningEffort: string | null): void;

  /**
   * Inserts or updates the templateId column for an identifier.
   * Preserves the existing model/reasoningEffort columns if a row already exists.
   */
  upsertTemplateId(identifier: string, templateId: string): void;

  /**
   * Sets templateId to null for the given identifier.
   * Does nothing if the row does not exist.
   */
  clearTemplateId(identifier: string): void;

  /** Returns the templateId for a single identifier, or null if not set / row absent. */
  getTemplateId(identifier: string): string | null;
}
