import { createChipList, createSegmented, createTextField, createToggle } from "../primitives.js";
import type { SettingsWorkbench } from "../workbench.js";
import { buildSectionShell } from "./section-shell.js";
import type { RowDef } from "./section-shell.js";

const MERGE_METHOD_OPTIONS = [
  { value: "merge", label: "Merge commit" },
  { value: "squash", label: "Squash" },
  { value: "rebase", label: "Rebase" },
];

export function buildMergeSection(wb: SettingsWorkbench): HTMLElement {
  const rows: RowDef[] = [
    {
      path: "mergePolicy.autoMerge.enabled",
      label: "Auto-merge",
      hint: "Automatically merge PRs that pass all checks.",
      control: (val, onDraft) => createToggle({ checked: val === true, onChange: (v) => onDraft(v) }),
    },
    {
      path: "mergePolicy.mergeMethod",
      label: "Merge method",
      hint: "Strategy used when merging pull requests.",
      control: (val, onDraft) =>
        createSegmented({
          value: String(val ?? "squash") as "merge" | "squash" | "rebase",
          options: MERGE_METHOD_OPTIONS,
          ariaLabel: "Merge method",
          onChange: (v) => onDraft(v),
        }),
    },
    { kind: "divider", label: "Auto-merge conditions" },
    {
      path: "mergePolicy.autoMerge.label",
      label: "Required PR label",
      hint: "Only auto-merge PRs carrying this label (blank = no restriction).",
      control: (val, onDraft) =>
        createTextField({ value: String(val ?? ""), placeholder: "e.g. auto-merge", onInput: (v) => onDraft(v) }),
    },
    {
      path: "mergePolicy.autoMerge.allowedPaths",
      label: "Allowed file paths",
      hint: "Restrict auto-merge to PRs touching only these glob patterns.",
      control: (val, onDraft) =>
        createChipList({
          values: Array.isArray(val) ? (val as string[]) : [],
          placeholder: "e.g. src/**",
          onChange: (v) => onDraft(v),
        }),
    },
  ];

  return buildSectionShell({
    sectionId: "merge",
    title: "Merge policy",
    sub: "How and when pull requests are merged.",
    namespace: "mergePolicy",
    rows,
    wb,
    buildPatch: (drafts) => {
      const patch: Record<string, unknown> = {};
      for (const [path, value] of drafts) {
        const key = path.replace("mergePolicy.", "");
        if (key.startsWith("autoMerge.")) {
          const subKey = key.replace("autoMerge.", "");
          const autoMerge = (patch["autoMerge"] as Record<string, unknown>) ?? {};
          autoMerge[subKey] = value;
          patch["autoMerge"] = autoMerge;
        } else {
          patch[key] = value;
        }
      }
      return patch;
    },
  });
}
