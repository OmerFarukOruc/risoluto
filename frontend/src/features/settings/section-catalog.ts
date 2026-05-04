import type { SectionBuilder, SectionDef } from "./section-types.js";
import { buildAgentSection } from "./sections/agent.js";
import { buildAlertsSection } from "./sections/alerts.js";
import { buildCodexSection } from "./sections/codex.js";
import { buildCredentialsSection } from "./sections/credentials.js";
import { buildMergeSection } from "./sections/merge.js";
import { buildNotificationsSection } from "./sections/notifications.js";
import { buildOverlaySection } from "./sections/overlay.js";
import { buildSandboxSection } from "./sections/sandbox.js";
import { buildTemplatesSection } from "./sections/templates.js";
import { buildWorkspaceSection } from "./sections/workspace.js";

export const SECTION_DEFS: SectionDef[] = [
  { id: "agent", label: "Agent", group: "Operate", icon: "settingsAgent" },
  { id: "codex", label: "Codex", group: "Operate", icon: "settingsCodex" },
  { id: "merge", label: "Merge policy", group: "Operate", icon: "settingsMerge" },
  { id: "notifications", label: "Notifications", group: "Observe", icon: "settingsNotify" },
  { id: "alerts", label: "Alerts", group: "Observe", icon: "eventAlert" },
  { id: "sandbox", label: "Sandbox", group: "Secure", icon: "settingsSandbox" },
  { id: "workspace", label: "Workspace", group: "Secure", icon: "workspaces" },
  { id: "templates", label: "Templates", group: "Configure", icon: "templates" },
  { id: "credentials", label: "Credentials", group: "Configure", icon: "secrets" },
  { id: "overlay", label: "Config overlay", group: "Configure", icon: "config" },
];

export const SECTION_BUILDERS: Record<string, SectionBuilder> = {
  agent: buildAgentSection,
  codex: buildCodexSection,
  merge: buildMergeSection,
  workspace: buildWorkspaceSection,
  notifications: buildNotificationsSection,
  alerts: buildAlertsSection,
  sandbox: buildSandboxSection,
  templates: buildTemplatesSection,
  credentials: buildCredentialsSection,
  overlay: buildOverlaySection,
};
