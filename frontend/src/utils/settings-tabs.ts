export type SettingsTabId = "general" | "credentials" | "advanced";

export const DEFAULT_SETTINGS_TAB: SettingsTabId = "general";

const settingsTabs = new Set<SettingsTabId>(["general", "credentials", "advanced"]);

export function isSettingsTabId(value: string | null | undefined): value is SettingsTabId {
  return value !== undefined && value !== null && settingsTabs.has(value as SettingsTabId);
}

export function parseSettingsTabHash(hash: string): SettingsTabId {
  const normalized = hash.replace(/^#/, "").trim().toLowerCase();
  return isSettingsTabId(normalized) ? normalized : DEFAULT_SETTINGS_TAB;
}

export function settingsPathForTab(tab: SettingsTabId): string {
  return tab === DEFAULT_SETTINGS_TAB ? "/settings#general" : `/settings#${tab}`;
}

export function normalizeLegacySettingsPath(pathname: string): SettingsTabId | null {
  if (pathname === "/config") {
    return "advanced";
  }
  if (pathname === "/secrets") {
    return "credentials";
  }
  return null;
}
