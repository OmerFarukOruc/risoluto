import { describe, expect, it } from "vitest";

import { resolveSetupRoutingState } from "../../packages/frontend/src/hooks/query-client";
import { buildRouteRenderKey } from "../../packages/frontend/src/hooks/route-helpers";

describe("react routing helpers", () => {
  it("keeps routing pending until setup status has loaded", () => {
    expect(resolveSetupRoutingState(undefined, false)).toBe("checking");
    expect(resolveSetupRoutingState({ configured: false }, false)).toBe("setup-required");
    expect(resolveSetupRoutingState({ configured: true }, false)).toBe("ready");
    expect(resolveSetupRoutingState(undefined, true)).toBe("ready");
  });

  it("builds a stable route render key for identical params", () => {
    const firstKey = buildRouteRenderKey("/issues/MT-42/runs", "#latest", { id: "MT-42" });
    const secondKey = buildRouteRenderKey("/issues/MT-42/runs", "#latest", { id: "MT-42" });

    expect(firstKey).toBe(secondKey);
  });
});
