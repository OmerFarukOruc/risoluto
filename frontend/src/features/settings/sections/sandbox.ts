import { createChipList, createToggle } from "../primitives.js";
import type { SettingsWorkbench } from "../workbench.js";
import { buildSectionShell } from "./section-shell.js";
import type { RowDef } from "./section-shell.js";

export function buildSandboxSection(wb: SettingsWorkbench): HTMLElement {
  const rows: RowDef[] = [
    {
      path: "codex.sandbox.enabled",
      label: "Enable sandbox",
      hint: "Run agent sessions inside a restricted bwrap sandbox.",
      accent: "var(--status-running)",
      control: (val, onDraft) => createToggle({ checked: val !== false, onChange: (v) => onDraft(v) }),
    },
    { kind: "divider", label: "Network" },
    {
      path: "codex.sandbox.security.allowedDomains",
      label: "Allowed outbound domains",
      hint: "Domains the sandboxed agent may reach. Empty = deny-all.",
      control: (val, onDraft) =>
        createChipList({
          values: Array.isArray(val) ? (val as string[]) : [],
          placeholder: "e.g. api.github.com",
          onChange: (v) => onDraft(v),
        }),
    },
    { kind: "divider", label: "Commands" },
    {
      path: "codex.sandbox.security.blockedCommands",
      label: "Blocked shell commands",
      hint: "Commands the agent is never permitted to run inside the sandbox.",
      control: (val, onDraft) =>
        createChipList({
          values: Array.isArray(val) ? (val as string[]) : [],
          placeholder: "e.g. curl",
          onChange: (v) => onDraft(v),
        }),
    },
  ];

  return buildSectionShell({
    sectionId: "sandbox",
    title: "Sandbox",
    sub: "Network and command restrictions inside agent bwrap sessions.",
    namespace: "codex",
    rows,
    wb,
    buildPatch: (drafts) => {
      const patch: Record<string, unknown> = { sandbox: { security: {} } };
      for (const [path, value] of drafts) {
        const key = path.replace("codex.sandbox.", "");
        if (key === "enabled") {
          (patch["sandbox"] as Record<string, unknown>)["enabled"] = value;
        } else if (key.startsWith("security.")) {
          const subKey = key.replace("security.", "");
          ((patch["sandbox"] as Record<string, unknown>)["security"] as Record<string, unknown>)[subKey] = value;
        }
      }
      return patch;
    },
  });
}
