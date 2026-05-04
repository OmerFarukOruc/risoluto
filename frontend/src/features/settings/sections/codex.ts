import { createChipList, createSelectField, createTextField } from "../primitives.js";
import type { SettingsWorkbench } from "../workbench.js";
import { buildSectionShell } from "./section-shell.js";
import type { RowDef } from "./section-shell.js";

const PROVIDER_OPTIONS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "bedrock", label: "Amazon Bedrock" },
  { value: "azure", label: "Azure OpenAI" },
];

export function buildCodexSection(wb: SettingsWorkbench): HTMLElement {
  const rows: RowDef[] = [
    {
      path: "codex.provider",
      label: "Provider",
      hint: "LLM provider for agent turns.",
      control: (val, onDraft) =>
        createSelectField({
          value: String(val ?? "anthropic"),
          options: PROVIDER_OPTIONS,
          onChange: (v) => onDraft(v),
        }),
    },
    {
      path: "codex.model",
      label: "Model",
      hint: "Model identifier passed to the provider.",
      control: (val, onDraft) =>
        createTextField({
          value: String(val ?? ""),
          placeholder: "e.g. claude-opus-4-7",
          mono: true,
          onInput: (v) => onDraft(v),
        }),
    },
    {
      path: "codex.apiKeyEnvVar",
      label: "API key env var",
      hint: "Environment variable name that holds the provider API key.",
      control: (val, onDraft) =>
        createTextField({
          value: String(val ?? ""),
          placeholder: "ANTHROPIC_API_KEY",
          mono: true,
          onInput: (v) => onDraft(v),
        }),
    },
    { kind: "divider", label: "Permissions" },
    {
      path: "codex.allowedTools",
      label: "Allowed tools",
      hint: "Tools the agent is permitted to use (Enter or comma to add).",
      control: (val, onDraft) =>
        createChipList({
          values: Array.isArray(val) ? (val as string[]) : [],
          placeholder: "e.g. bash",
          onChange: (v) => onDraft(v),
        }),
    },
    {
      path: "codex.disallowedCommands",
      label: "Disallowed commands",
      hint: "Shell commands the agent may not invoke.",
      control: (val, onDraft) =>
        createChipList({
          values: Array.isArray(val) ? (val as string[]) : [],
          placeholder: "e.g. rm",
          onChange: (v) => onDraft(v),
        }),
    },
  ];

  return buildSectionShell({
    sectionId: "codex",
    title: "Codex",
    sub: "Model provider, permissions, and tool access for agent sessions.",
    namespace: "codex",
    rows,
    wb,
    buildPatch: (drafts) => Object.fromEntries([...drafts.entries()].map(([k, v]) => [k.replace("codex.", ""), v])),
  });
}
