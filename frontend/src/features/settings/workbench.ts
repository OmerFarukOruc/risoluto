/**
 * Lightweight config data layer for the Settings page.
 *
 * Loads the raw config once, lets sections maintain local draft maps,
 * and saves via PUT /api/v1/config/overlay. No complex section-definition
 * machinery — each section builds its own UI and calls the helpers here.
 */

import { api } from "../../api.js";
import { toast } from "../../ui/toast.js";

export interface ConfigSnapshot {
  config: Record<string, unknown>;
  overlay: Record<string, unknown>;
}

export interface SettingsWorkbench {
  snapshot: ConfigSnapshot;
  loading: boolean;
  error: string | null;
  subscribe(fn: () => void): () => void;
  load(): Promise<void>;
  getDraft(sectionId: string, path: string): unknown;
  setDraft(sectionId: string, path: string, value: unknown): void;
  isDirty(sectionId: string): boolean;
  dirtyIds(): string[];
  save(sectionId: string, namespace: string, patch: Record<string, unknown>): Promise<void>;
  revert(sectionId: string): void;
}

function getIn(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function createSettingsWorkbench(): SettingsWorkbench {
  const listeners = new Set<() => void>();
  const drafts = new Map<string, Map<string, unknown>>();

  let snapshot: ConfigSnapshot = { config: {}, overlay: {} };
  let loading = false;
  let error: string | null = null;

  const notify = (): void => {
    for (const fn of listeners) fn();
  };

  return {
    get snapshot() {
      return snapshot;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },

    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    async load(): Promise<void> {
      loading = true;
      error = null;
      notify();
      try {
        const [configRes, overlayRes] = await Promise.all([api.getConfig(), api.getConfigOverlay()]);
        snapshot = {
          config: configRes as Record<string, unknown>,
          overlay: overlayRes.overlay ?? {},
        };
      } catch (err) {
        error = err instanceof Error ? err.message : "Failed to load config";
      } finally {
        loading = false;
        notify();
      }
    },

    getDraft(sectionId: string, path: string): unknown {
      const sectionDrafts = drafts.get(sectionId);
      if (!sectionDrafts?.has(path)) {
        return getIn(snapshot.config as Record<string, unknown>, path);
      }
      return sectionDrafts.get(path);
    },

    setDraft(sectionId: string, path: string, value: unknown): void {
      let sectionDrafts = drafts.get(sectionId);
      if (!sectionDrafts) {
        sectionDrafts = new Map();
        drafts.set(sectionId, sectionDrafts);
      }
      sectionDrafts.set(path, value);
      notify();
    },

    isDirty(sectionId: string): boolean {
      const sectionDrafts = drafts.get(sectionId);
      return (sectionDrafts?.size ?? 0) > 0;
    },

    dirtyIds(): string[] {
      return [...drafts.entries()].filter(([, m]) => m.size > 0).map(([id]) => id);
    },

    async save(sectionId: string, namespace: string, patch: Record<string, unknown>): Promise<void> {
      try {
        await api.putConfigOverlay({ [namespace]: patch });
        drafts.delete(sectionId);
        await this.load();
        toast("Saved", "success");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Save failed", "error");
        throw err;
      }
    },

    revert(sectionId: string): void {
      drafts.delete(sectionId);
      notify();
    },
  };
}
