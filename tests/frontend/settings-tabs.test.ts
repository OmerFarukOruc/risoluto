import { describe, expect, it } from "vitest";

import {
  normalizeLegacySettingsPath,
  parseSettingsTabHash,
  settingsPathForTab,
} from "../../frontend/src/utils/settings-tabs";

describe("settings-tabs", () => {
  it("parses known tab hashes and falls back to general", () => {
    expect(parseSettingsTabHash("#advanced")).toBe("advanced");
    expect(parseSettingsTabHash("#credentials")).toBe("credentials");
    expect(parseSettingsTabHash("#unknown")).toBe("general");
    expect(parseSettingsTabHash("")).toBe("general");
  });

  it("maps tabs to settings URLs", () => {
    expect(settingsPathForTab("general")).toBe("/settings#general");
    expect(settingsPathForTab("credentials")).toBe("/settings#credentials");
    expect(settingsPathForTab("advanced")).toBe("/settings#advanced");
  });

  it("normalizes legacy config and secrets paths", () => {
    expect(normalizeLegacySettingsPath("/config")).toBe("advanced");
    expect(normalizeLegacySettingsPath("/secrets")).toBe("credentials");
    expect(normalizeLegacySettingsPath("/settings")).toBeNull();
  });
});
