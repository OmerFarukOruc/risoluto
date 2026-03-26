import { afterEach, describe, expect, it } from "vitest";

import { FEATURE_FLAG_REACT_FRONTEND, resetFlags, setFlag } from "../../src/core/feature-flags.js";
import { getFrontendDistPaths, resolveFrontendDir, resolveFrontendPath } from "../../src/http/frontend-path.js";

describe("frontend-path", () => {
  afterEach(() => {
    resetFlags();
  });

  it("returns explicit frontendDir override unchanged", () => {
    expect(resolveFrontendPath({ frontendDir: "/tmp/custom-frontend" })).toBe("/tmp/custom-frontend");
  });

  it("reads REACT_FRONTEND from the feature flag store when no override is supplied", () => {
    setFlag(FEATURE_FLAG_REACT_FRONTEND, true);

    expect(resolveFrontendPath({ cwd: "/repo", vanillaFrontendExists: true })).toBe("/repo/dist/frontend");
  });

  it("prefers the React bundle when REACT_FRONTEND is enabled", () => {
    expect(resolveFrontendPath({ cwd: "/repo", reactFrontendEnabled: true, vanillaFrontendExists: true })).toBe(
      "/repo/dist/frontend",
    );
  });

  it("prefers the vanilla bundle when REACT_FRONTEND is disabled and legacy assets exist", () => {
    expect(resolveFrontendPath({ cwd: "/repo", reactFrontendEnabled: false, vanillaFrontendExists: true })).toBe(
      "/repo/dist/frontend-vanilla",
    );
  });

  it("falls back to the React bundle when legacy assets are unavailable", () => {
    expect(resolveFrontendPath({ cwd: "/repo", reactFrontendEnabled: false, vanillaFrontendExists: false })).toBe(
      "/repo/dist/frontend",
    );
  });

  it("keeps resolveFrontendDir as a compatibility alias", () => {
    expect(resolveFrontendDir({ cwd: "/repo", reactFrontendEnabled: false, vanillaFrontendExists: true })).toBe(
      "/repo/dist/frontend-vanilla",
    );
  });

  it("builds both React and vanilla dist paths from cwd", () => {
    expect(getFrontendDistPaths("/repo")).toEqual({
      react: "/repo/dist/frontend",
      vanilla: "/repo/dist/frontend-vanilla",
    });
  });
});
