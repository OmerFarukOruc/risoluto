import { createNumberField, createTextField, createToggle } from "../primitives.js";
import type { SettingsWorkbench } from "../workbench.js";
import { buildSectionShell } from "./section-shell.js";
import type { RowDef } from "./section-shell.js";

export function buildAgentSection(wb: SettingsWorkbench): HTMLElement {
  const rows: RowDef[] = [
    {
      path: "agent.maxConcurrentAgents",
      label: "Max concurrent agents",
      hint: "Maximum number of issue workers running simultaneously.",
      control: (val, onDraft) =>
        createNumberField({ value: Number(val ?? 3), min: 1, max: 50, onInput: (v) => onDraft(v) }),
    },
    {
      path: "agent.maxTurns",
      label: "Max turns per agent",
      hint: "Maximum LLM turns before an agent is stopped.",
      control: (val, onDraft) =>
        createNumberField({ value: Number(val ?? 10), min: 1, max: 200, onInput: (v) => onDraft(v) }),
    },
    {
      path: "agent.autoClaim",
      label: "Auto-claim Todo issues",
      hint: "When enabled, the orchestrator automatically claims Todo-state issues.",
      control: (val, onDraft) => createToggle({ checked: val !== false, onChange: (v) => onDraft(v) }),
    },
    { kind: "divider", label: "Retry & continuation" },
    {
      path: "agent.maxRetryBackoffMs",
      label: "Max retry backoff (ms)",
      hint: "Maximum back-off delay before retrying a failed agent.",
      control: (val, onDraft) =>
        createNumberField({ value: Number(val ?? 300000), min: 0, onInput: (v) => onDraft(v), width: 120 }),
    },
    {
      path: "agent.maxContinuationAttempts",
      label: "Max continuation attempts",
      hint: "How many times an agent may resume after a soft stop.",
      control: (val, onDraft) =>
        createNumberField({ value: Number(val ?? 5), min: 0, max: 50, onInput: (v) => onDraft(v) }),
    },
    {
      path: "agent.stallTimeoutMs",
      label: "Stall timeout (ms)",
      hint: "Mark agent as stalled after this many ms of silence.",
      control: (val, onDraft) =>
        createNumberField({ value: Number(val ?? 1200000), min: 0, onInput: (v) => onDraft(v), width: 120 }),
    },
    { kind: "divider", label: "Completion" },
    {
      path: "agent.successState",
      label: "Success state",
      hint: "Tracker state to transition issues to on success (blank = no transition).",
      control: (val, onDraft) =>
        createTextField({ value: String(val ?? ""), placeholder: "e.g. Done", onInput: (v) => onDraft(v) }),
    },
  ];

  return buildSectionShell({
    sectionId: "agent",
    title: "Agent",
    sub: "Controls how workers are spawned, retried, and stopped.",
    namespace: "agent",
    rows,
    wb,
    buildPatch: (drafts) => Object.fromEntries([...drafts.entries()].map(([k, v]) => [k.replace("agent.", ""), v])),
  });
}
