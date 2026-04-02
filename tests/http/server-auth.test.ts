import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpServer } from "../../src/http/server.js";
import { createLogger } from "../../src/core/logger.js";

describe("HttpServer auth binding", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses non-loopback bind without read-capable token", async () => {
    vi.stubEnv("RISOLUTO_BIND", "0.0.0.0");
    const server = new HttpServer({
      orchestrator: {} as never,
      logger: createLogger(),
    });

    await expect(server.start(0)).rejects.toThrow(/RISOLUTO_READ_TOKEN|RISOLUTO_WRITE_TOKEN/);
  });

  it("allows non-loopback bind when RISOLUTO_READ_TOKEN is configured", async () => {
    vi.stubEnv("RISOLUTO_BIND", "0.0.0.0");
    vi.stubEnv("RISOLUTO_READ_TOKEN", "read-secret");
    const server = new HttpServer({
      orchestrator: {} as never,
      logger: createLogger(),
    });

    const started = await server.start(0);
    expect(started.port).toBeGreaterThan(0);
    await server.stop();
  });
});
