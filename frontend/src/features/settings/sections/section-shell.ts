/**
 * Helper that wires up the standard section layout:
 * sticky header + form rows + sticky save bar.
 *
 * Each section builder calls buildSectionShell with its field list,
 * and the shell handles dirty state, save, and revert automatically.
 */

import { createFormRow, createSaveBar, createSectionHeader, createSubDivider } from "../primitives.js";
import type { SettingsWorkbench } from "../workbench.js";

export interface FieldDef {
  path: string;
  label: string;
  hint?: string;
  accent?: string;
  control(currentValue: unknown, onDraft: (v: unknown) => void): HTMLElement;
}

export interface DividerDef {
  kind: "divider";
  label: string;
  description?: string;
}

export type RowDef = FieldDef | DividerDef;

export interface SectionShellOptions {
  sectionId: string;
  title: string;
  sub?: string;
  namespace: string;
  rows: RowDef[];
  wb: SettingsWorkbench;
  buildPatch(drafts: Map<string, unknown>): Record<string, unknown>;
  headerAction?: HTMLElement;
}

export function buildSectionShell({
  sectionId,
  title,
  sub,
  namespace,
  rows,
  wb,
  buildPatch,
  headerAction,
}: SectionShellOptions): HTMLElement {
  const root = document.createElement("section");
  root.className = "settings-section";
  root.id = `section-${sectionId}`;

  const pendingDrafts = new Map<string, unknown>();

  const { root: headerRoot } = createSectionHeader({
    title,
    sub,
    action: headerAction,
  });
  root.append(headerRoot);

  const saveBarHandle = createSaveBar({
    onSave: async () => {
      saveBarHandle.setSaving(true);
      saveBarHandle.setError(null);
      try {
        await wb.save(sectionId, namespace, buildPatch(pendingDrafts));
        pendingDrafts.clear();
        saveBarHandle.setDirty(false);
      } catch (err) {
        saveBarHandle.setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        saveBarHandle.setSaving(false);
      }
    },
    onDiscard: () => {
      pendingDrafts.clear();
      wb.revert(sectionId);
      saveBarHandle.setDirty(false);
      rebuildControls();
    },
  });

  const form = document.createElement("div");
  form.className = "settings-section-body";
  root.append(form);
  root.append(saveBarHandle.root);
  saveBarHandle.setDirty(false);

  const controlHandles: Array<{ path: string; el: HTMLElement }> = [];

  const rebuildControls = (): void => {
    form.innerHTML = "";
    controlHandles.length = 0;
    for (const row of rows) {
      if ("kind" in row && row.kind === "divider") {
        form.append(createSubDivider({ label: row.label, description: row.description }));
        continue;
      }
      const fieldDef = row as FieldDef;
      const current = pendingDrafts.has(fieldDef.path)
        ? pendingDrafts.get(fieldDef.path)
        : wb.getDraft(sectionId, fieldDef.path);
      const control = fieldDef.control(current, (value: unknown) => {
        pendingDrafts.set(fieldDef.path, value);
        saveBarHandle.setDirty(pendingDrafts.size > 0);
      });
      const formRow = createFormRow({
        label: fieldDef.label,
        hint: fieldDef.hint ?? null,
        accent: fieldDef.accent ?? null,
        control,
      });
      form.append(formRow);
      controlHandles.push({ path: fieldDef.path, el: control });
    }
  };

  rebuildControls();

  const unsubscribe = wb.subscribe(() => {
    if (!wb.isDirty(sectionId) && pendingDrafts.size === 0) {
      rebuildControls();
    }
  });

  root.addEventListener("disconnectedcallback", unsubscribe);

  return root;
}
