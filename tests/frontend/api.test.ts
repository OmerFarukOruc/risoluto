import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../../frontend/src/api";
import { createJsonResponse, createSnapshot } from "./helpers";

describe("frontend api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the runtime snapshot from the API", async () => {
    const snapshotBody = createSnapshot("2026-03-20T00:00:00.000Z");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createJsonResponse(snapshotBody)));

    const snapshot = await api.getState();

    expect(snapshot).toEqual(snapshotBody);
  });
});
