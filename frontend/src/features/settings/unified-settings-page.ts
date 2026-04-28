import { createPageHeader } from "../../components/page-header.js";
import { registerPageCleanup } from "../../utils/page.js";
import {
  normalizeLegacySettingsPath,
  parseSettingsSectionHash,
  settingsPathForSection,
  type SettingsSectionHash,
} from "../../utils/settings-tabs.js";
import { createConfigState } from "../../views/config-state.js";
import { createConfigPage } from "../../views/config-view.js";
import { createCodexAdminSection } from "../../views/settings-codex-admin.js";

import { createSettingsPage } from "./settings-view.js";
import { createSettingsWorkbench } from "./settings-workbench.js";

interface UnifiedSettingsCache {
  advancedState: ReturnType<typeof createConfigState>;
  generalWorkbench: ReturnType<typeof createSettingsWorkbench>;
}

interface RequestedSettingsSection {
  section: SettingsSectionHash | null;
  shouldReplace: boolean;
}

let cachedState: UnifiedSettingsCache | null = null;

export function getUnifiedSettingsCache(): UnifiedSettingsCache {
  if (cachedState) {
    return cachedState;
  }
  cachedState = {
    generalWorkbench: createSettingsWorkbench(),
    advancedState: createConfigState(),
  };
  return cachedState;
}

export function clearUnifiedSettingsCache(): void {
  cachedState = null;
}

function extractHeader(root: HTMLElement): {
  actions: HTMLElement[];
  subtitleElement: HTMLElement | null;
} {
  const header = Array.from(root.children).find(
    (candidate): candidate is HTMLElement =>
      candidate instanceof HTMLElement && candidate.classList.contains("mc-strip"),
  );
  if (!header) {
    return { actions: [], subtitleElement: null };
  }
  const subtitleElement = header.querySelector<HTMLElement>(".page-subtitle") ?? null;
  const primaryCopy = header.firstElementChild;
  const actions = Array.from(header.children).filter(
    (candidate): candidate is HTMLElement => candidate instanceof HTMLElement && candidate !== primaryCopy,
  );
  header.remove();
  return { actions, subtitleElement };
}

export function readRequestedSettingsSection(
  locationLike: Pick<Location, "pathname" | "hash"> = window.location,
): RequestedSettingsSection {
  const legacySection = normalizeLegacySettingsPath(locationLike.pathname);
  if (legacySection) {
    return { section: legacySection, shouldReplace: true };
  }
  return { section: parseSettingsSectionHash(locationLike.hash), shouldReplace: false };
}

export function syncRequestedSettingsSection(
  cache: UnifiedSettingsCache,
  requested: RequestedSettingsSection,
  historyLike: Pick<History, "replaceState"> = window.history,
): void {
  if (requested.section === "credentials" && cache.generalWorkbench.state.mode !== "advanced") {
    cache.generalWorkbench.state.mode = "advanced";
  }

  if (requested.shouldReplace && requested.section) {
    historyLike.replaceState({}, "", settingsPathForSection(requested.section));
  }
}

export function scrollToRequestedSettingsSection(section: SettingsSectionHash, container: HTMLElement): void {
  if (section === "credentials") {
    const credentialsEl = container.querySelector<HTMLElement>("#settings-credentials");
    credentialsEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (section === "devtools") {
    const devtoolsEl = container.querySelector<HTMLDetailsElement>(".settings-devtools-section");
    if (devtoolsEl) {
      devtoolsEl.open = true;
      devtoolsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

function buildDevtoolsSection(state: UnifiedSettingsCache): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "settings-devtools-section mc-panel";

  const summary = document.createElement("summary");
  summary.textContent = "Developer tools: Raw JSON configuration editor";
  details.append(summary);

  const configPage = createConfigPage({ state: state.advancedState });
  extractHeader(configPage);
  configPage.classList.add("settings-devtools-content");

  details.append(configPage);
  return details;
}

/**
 * Codex admin is operational diagnostics (threads, MCP servers, pending
 * requests), not configuration. Wrapping it in <details> prevents a
 * domain collision mid-scroll for operators who arrived to bump a config
 * value. Keeps the section reachable without injecting an unrelated
 * dashboard into the configuration flow.
 */
function buildCodexAdminCollapsible(): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "settings-codex-admin-section mc-panel";

  const summary = document.createElement("summary");
  summary.textContent = "Codex admin: control-plane diagnostics";
  details.append(summary);

  const codexAdmin = createCodexAdminSection();
  codexAdmin.classList.add("settings-codex-admin-content");
  details.append(codexAdmin);
  return details;
}

export function createUnifiedSettingsPage(): HTMLElement {
  const state = getUnifiedSettingsCache();
  const requested = readRequestedSettingsSection();
  syncRequestedSettingsSection(state, requested);

  const page = document.createElement("div");
  page.className = "page settings-unified-page fade-in";

  const header = createPageHeader("Settings", "Manage configuration, credentials, and developer tools in one place.");

  const body = document.createElement("div");
  body.className = "settings-unified-body";

  const generalSection = createSettingsPage({ workbench: state.generalWorkbench });
  const { actions: innerActions, subtitleElement: innerSubtitle } = extractHeader(generalSection);
  if (innerSubtitle) {
    const outerSubtitle = header.querySelector<HTMLElement>(".page-subtitle");
    outerSubtitle?.replaceWith(innerSubtitle);
  }
  if (innerActions.length > 0) {
    header.append(...innerActions);
  }

  const codexAdminSection = buildCodexAdminCollapsible();
  const devtoolsSection = buildDevtoolsSection(state);

  body.append(generalSection, codexAdminSection, devtoolsSection);
  page.append(header, body);

  if (requested.section) {
    const targetSection = requested.section;
    requestAnimationFrame(() => {
      scrollToRequestedSettingsSection(targetSection, page);
    });
  }

  const onHashChange = (): void => {
    const next = readRequestedSettingsSection();
    syncRequestedSettingsSection(state, next);
    if (next.section) {
      scrollToRequestedSettingsSection(next.section, page);
    }
  };

  window.addEventListener("hashchange", onHashChange);

  registerPageCleanup(page, () => {
    window.removeEventListener("hashchange", onHashChange);
    clearUnifiedSettingsCache();
  });

  return page;
}
