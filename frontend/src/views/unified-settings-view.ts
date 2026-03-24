import { createPageHeader } from "../components/page-header.js";
import { registerPageCleanup } from "../utils/page.js";
import {
  DEFAULT_SETTINGS_TAB,
  normalizeLegacySettingsPath,
  parseSettingsTabHash,
  settingsPathForTab,
  type SettingsTabId,
} from "../utils/settings-tabs.js";

import { createConfigState } from "./config-state.js";
import { createConfigPage } from "./config-view.js";
import { createSecretsState } from "./secrets-state.js";
import { createSecretsPage } from "./secrets-view.js";
import { createSettingsState } from "./settings-state.js";
import { createSettingsPage } from "./settings-view.js";

interface SettingsTabDefinition {
  actionLabel: string;
  description: string;
  id: SettingsTabId;
  label: string;
  title: string;
}

interface UnifiedSettingsCache {
  activeTab: SettingsTabId;
  advancedState: ReturnType<typeof createConfigState>;
  credentialsState: ReturnType<typeof createSecretsState>;
  generalState: ReturnType<typeof createSettingsState>;
}

const TAB_DEFINITIONS: SettingsTabDefinition[] = [
  {
    id: "general",
    label: "General",
    title: "General",
    actionLabel: "General settings",
    description:
      "Review the structured, schema-guided configuration Symphony uses for tracker, provider, and runtime behavior.",
  },
  {
    id: "credentials",
    label: "Credentials",
    title: "Credentials",
    actionLabel: "Credentials",
    description: "Manage encrypted API keys and tokens. Values remain write-only after save.",
  },
  {
    id: "advanced",
    label: "Advanced",
    title: "Advanced",
    actionLabel: "Advanced",
    description: "Inspect and edit persistent overlay overrides directly when you need path-level or raw JSON control.",
  },
];

let cachedState: UnifiedSettingsCache | null = null;

function getTabDefinition(tab: SettingsTabId): SettingsTabDefinition {
  return TAB_DEFINITIONS.find((candidate) => candidate.id === tab) ?? TAB_DEFINITIONS[0]!;
}

function getCachedState(): UnifiedSettingsCache {
  if (cachedState) {
    return cachedState;
  }
  cachedState = {
    activeTab: DEFAULT_SETTINGS_TAB,
    generalState: createSettingsState(),
    credentialsState: createSecretsState(),
    advancedState: createConfigState(),
  };
  return cachedState;
}

function readRequestedTab(): { tab: SettingsTabId; shouldReplace: boolean } {
  const legacyTab = normalizeLegacySettingsPath(window.location.pathname);
  if (legacyTab) {
    return { tab: legacyTab, shouldReplace: true };
  }
  return { tab: parseSettingsTabHash(window.location.hash), shouldReplace: false };
}

function createSubpage(tab: SettingsTabId, state: UnifiedSettingsCache): HTMLElement {
  if (tab === "credentials") {
    return createSecretsPage({ state: state.credentialsState });
  }
  if (tab === "advanced") {
    return createConfigPage({ state: state.advancedState });
  }
  return createSettingsPage({ state: state.generalState });
}

function extractHeader(root: HTMLElement): { actions: HTMLElement[]; subtitle: string } {
  const header = Array.from(root.children).find(
    (candidate): candidate is HTMLElement =>
      candidate instanceof HTMLElement && candidate.classList.contains("mc-strip"),
  );
  if (!header) {
    return { actions: [], subtitle: "" };
  }
  const subtitle = header.querySelector<HTMLElement>(".page-subtitle")?.textContent?.trim() ?? "";
  const primaryCopy = header.firstElementChild;
  const actions = Array.from(header.children).filter(
    (candidate): candidate is HTMLElement => candidate instanceof HTMLElement && candidate !== primaryCopy,
  );
  header.remove();
  return { actions, subtitle };
}

export function createUnifiedSettingsPage(): HTMLElement {
  const state = getCachedState();
  const requested = readRequestedTab();
  state.activeTab = requested.tab;

  if (requested.shouldReplace) {
    window.history.replaceState({}, "", settingsPathForTab(requested.tab));
  }

  const page = document.createElement("div");
  page.className = "page settings-shell-page fade-in";

  const header = createPageHeader(
    "Settings",
    "One place to manage guided configuration, encrypted credentials, and low-level overrides.",
  );

  const tabsSurface = document.createElement("section");
  tabsSurface.className = "settings-shell-tabs mc-panel";
  const tabList = document.createElement("div");
  tabList.className = "mc-button-segment settings-shell-tablist";
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-label", "Settings sections");
  tabList.setAttribute("aria-orientation", "horizontal");
  tabsSurface.append(tabList);

  const context = document.createElement("section");
  context.className = "settings-shell-context mc-strip";
  const contextCopy = document.createElement("div");
  contextCopy.className = "settings-shell-context-copy";
  const contextEyebrow = document.createElement("p");
  contextEyebrow.className = "settings-shell-context-eyebrow";
  const contextTitle = document.createElement("h2");
  contextTitle.className = "settings-shell-context-title";
  const contextSubtitle = document.createElement("p");
  contextSubtitle.className = "settings-shell-context-subtitle";
  contextCopy.append(contextEyebrow, contextTitle, contextSubtitle);
  const contextActions = document.createElement("div");
  contextActions.className = "settings-shell-context-actions";
  context.append(contextCopy, contextActions);

  const content = document.createElement("div");
  content.className = "settings-shell-panels";

  const panels = new Map<SettingsTabId, HTMLElement>();
  const buttons = new Map<SettingsTabId, HTMLButtonElement>();

  function renderTabButtons(): void {
    tabList.replaceChildren(
      ...TAB_DEFINITIONS.map((tab) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `mc-button is-ghost settings-shell-tab${tab.id === state.activeTab ? " is-active" : ""}`;
        button.id = `settings-tab-${tab.id}`;
        button.dataset.tab = tab.id;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(tab.id === state.activeTab));
        button.setAttribute("aria-controls", `settings-panel-${tab.id}`);
        button.setAttribute("tabindex", tab.id === state.activeTab ? "0" : "-1");
        button.textContent = tab.label;
        button.addEventListener("click", () => activateTab(tab.id, "push"));
        button.addEventListener("keydown", (event) => {
          const currentIndex = TAB_DEFINITIONS.findIndex((candidate) => candidate.id === tab.id);
          const previousIndex = currentIndex === 0 ? TAB_DEFINITIONS.length - 1 : currentIndex - 1;
          const nextIndex = currentIndex === TAB_DEFINITIONS.length - 1 ? 0 : currentIndex + 1;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            buttons.get(TAB_DEFINITIONS[previousIndex]!.id)?.focus();
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            buttons.get(TAB_DEFINITIONS[nextIndex]!.id)?.focus();
          }
          if (event.key === "Home") {
            event.preventDefault();
            buttons.get(TAB_DEFINITIONS[0]!.id)?.focus();
          }
          if (event.key === "End") {
            event.preventDefault();
            buttons.get(TAB_DEFINITIONS.at(-1)!.id)?.focus();
          }
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            activateTab(tab.id, "push");
          }
        });
        buttons.set(tab.id, button);
        return button;
      }),
    );
  }

  function renderPanels(): void {
    for (const tab of TAB_DEFINITIONS) {
      let panel = panels.get(tab.id);
      if (!panel) {
        panel = document.createElement("section");
        panel.className = "settings-shell-panel";
        panel.id = `settings-panel-${tab.id}`;
        panel.dataset.tab = tab.id;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", `settings-tab-${tab.id}`);
        panels.set(tab.id, panel);
      }

      const isActive = tab.id === state.activeTab;
      panel.hidden = !isActive;

      if (!isActive) {
        panel.replaceChildren();
        continue;
      }

      const subpage = createSubpage(tab.id, state);
      const extracted = extractHeader(subpage);
      const definition = getTabDefinition(tab.id);

      contextEyebrow.textContent = definition.actionLabel;
      contextTitle.textContent = definition.title;
      contextSubtitle.textContent = extracted.subtitle || definition.description;
      contextActions.replaceChildren(...extracted.actions);
      subpage.classList.add("settings-shell-mounted-view");
      panel.replaceChildren(subpage);
    }

    content.replaceChildren(...TAB_DEFINITIONS.map((tab) => panels.get(tab.id)!));
  }

  function syncUrl(tab: SettingsTabId, mode: "push" | "replace" | "none"): void {
    if (mode === "none") {
      return;
    }
    const nextUrl = settingsPathForTab(tab);
    const currentUrl = `${window.location.pathname}${window.location.hash}`;
    if (currentUrl === nextUrl) {
      return;
    }
    if (mode === "replace") {
      window.history.replaceState({}, "", nextUrl);
      return;
    }
    window.history.pushState({}, "", nextUrl);
  }

  function render(): void {
    renderTabButtons();
    renderPanels();
  }

  function activateTab(tab: SettingsTabId, mode: "push" | "replace" | "none"): void {
    if (tab === state.activeTab && mode !== "replace") {
      syncUrl(tab, mode);
      return;
    }
    state.activeTab = tab;
    syncUrl(tab, mode);
    render();
  }

  const onHashChange = (): void => {
    const requestedTab = readRequestedTab();
    if (requestedTab.shouldReplace) {
      activateTab(requestedTab.tab, "replace");
      return;
    }
    activateTab(requestedTab.tab, "none");
  };

  window.addEventListener("hashchange", onHashChange);
  page.append(header, tabsSurface, context, content);
  render();

  registerPageCleanup(page, () => {
    window.removeEventListener("hashchange", onHashChange);
  });

  return page;
}
