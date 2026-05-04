import { createSelectField, createTextField } from "../primitives.js";
import type { SettingsWorkbench } from "../workbench.js";
import { buildSectionShell } from "./section-shell.js";
import type { RowDef } from "./section-shell.js";

const STRATEGY_OPTIONS = [
  { value: "worktree", label: "Git worktree (fastest)" },
  { value: "clone", label: "Full clone" },
  { value: "reuse", label: "Reuse workspace" },
];

export function buildWorkspaceSection(wb: SettingsWorkbench): HTMLElement {
  const rows: RowDef[] = [
    {
      path: "workspace.baseDir",
      label: "Base directory",
      hint: "Directory where agent workspaces are created.",
      control: (val, onDraft) =>
        createTextField({
          value: String(val ?? ""),
          placeholder: "/tmp/risoluto",
          mono: true,
          onInput: (v) => onDraft(v),
        }),
    },
    {
      path: "workspace.strategy",
      label: "Workspace strategy",
      hint: "How workspaces are prepared for each agent session.",
      control: (val, onDraft) =>
        createSelectField({ value: String(val ?? "worktree"), options: STRATEGY_OPTIONS, onChange: (v) => onDraft(v) }),
    },
    { kind: "divider", label: "Git identity" },
    {
      path: "workspace.gitUserName",
      label: "Git user name",
      hint: "git config user.name for commits created by agents.",
      control: (val, onDraft) =>
        createTextField({ value: String(val ?? ""), placeholder: "Risoluto Bot", onInput: (v) => onDraft(v) }),
    },
    {
      path: "workspace.gitUserEmail",
      label: "Git user email",
      hint: "git config user.email for commits created by agents.",
      control: (val, onDraft) =>
        createTextField({
          value: String(val ?? ""),
          placeholder: "bot@example.com",
          mono: true,
          onInput: (v) => onDraft(v),
        }),
    },
  ];

  return buildSectionShell({
    sectionId: "workspace",
    title: "Workspace",
    sub: "Local directory and Git identity used when creating agent workspaces.",
    namespace: "workspace",
    rows,
    wb,
    buildPatch: (drafts) => Object.fromEntries([...drafts.entries()].map(([k, v]) => [k.replace("workspace.", ""), v])),
  });
}
