import { describe, expect, it, vi } from "vitest";

import { createSingleFlight } from "../../frontend/src/utils/single-flight";

function createDeferred<T>() {
  let resolve = (_value: T): void => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("createSingleFlight", () => {
  it("reuses the same in-flight promise for concurrent calls", async () => {
    const deferred = createDeferred<string>();
    const run = vi.fn(async () => deferred.promise);
    const singleFlight = createSingleFlight(run);

    const first = singleFlight();
    const second = singleFlight();

    expect(run).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);

    deferred.resolve("ready");
    await expect(first).resolves.toBe("ready");
    await expect(second).resolves.toBe("ready");
  });

  it("allows a new call after the prior request settles", async () => {
    const run = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const singleFlight = createSingleFlight(run);

    await expect(singleFlight()).resolves.toBe("first");
    await expect(singleFlight()).resolves.toBe("second");
    expect(run).toHaveBeenCalledTimes(2);
  });
});
