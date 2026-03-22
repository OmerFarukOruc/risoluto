import type { Server } from "node:http";

import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigOverlayStore } from "../../src/config/overlay.js";
import { AttemptStore } from "../../src/core/attempt-store.js";
import type { RunAttemptDispatcher } from "../../src/dispatch/types.js";
import { ConfigStore } from "../../src/config/store.js";
import { LinearClient } from "../../src/linear/client.js";
import { Orchestrator } from "../../src/orchestrator/orchestrator.js";
import { SecretsStore } from "../../src/secrets/store.js";
import { registerSetupApi } from "../../src/setup/api.js";
import { WorkspaceManager } from "../../src/workspace/manager.js";
import { createMockLogger, createTextResponse as textResponse } from "../helpers.js";

const { existsSyncMock, mkdirMock, writeFileMock, startDeviceAuthMock, pollDeviceAuthMock, saveDeviceAuthTokensMock } =
  vi.hoisted(() => ({
    existsSyncMock: vi.fn<(filePath: string) => boolean>(),
    mkdirMock: vi.fn<(filePath: string, options?: { recursive?: boolean }) => Promise<void>>(),
    writeFileMock:
      vi.fn<
        (filePath: string, data: string, options?: { encoding?: BufferEncoding; mode?: number }) => Promise<void>
      >(),
    startDeviceAuthMock: vi.fn<
      () => Promise<{
        user_code: string;
        verification_uri: string;
        verification_uri_complete?: string;
        device_code: string;
        expires_in: number;
        interval: number;
      }>
    >(),
    pollDeviceAuthMock:
      vi.fn<(deviceCode: string) => Promise<{ status: "pending" | "complete" | "expired"; error?: string }>>(),
    saveDeviceAuthTokensMock:
      vi.fn<
        (
          deviceCode: string,
          archiveDir: string,
          configOverlayStore: ConfigOverlayStore,
        ) => Promise<{ ok: boolean; error?: string }>
      >(),
  }));

vi.mock("node:fs", () => ({
  existsSync: existsSyncMock,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
}));

vi.mock("../../src/setup/device-auth.js", () => ({
  startDeviceAuth: startDeviceAuthMock,
  pollDeviceAuth: pollDeviceAuthMock,
  saveDeviceAuthTokens: saveDeviceAuthTokensMock,
}));

type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const originalEnv = { ...process.env };
const realFetch = globalThis.fetch.bind(globalThis);

let externalFetchMock = vi.fn<FetchStub>();
const servers: Server[] = [];

function createSecretsStoreMock(): SecretsStore {
  const store = new SecretsStore("/secrets-store", createMockLogger());
  vi.spyOn(store, "start").mockResolvedValue(undefined);
  vi.spyOn(store, "startDeferred").mockResolvedValue(undefined);
  vi.spyOn(store, "initializeWithKey").mockResolvedValue(undefined);
  vi.spyOn(store, "set").mockResolvedValue(undefined);
  vi.spyOn(store, "delete").mockResolvedValue(true);
  return store;
}

function createConfigOverlayStoreMock(): ConfigOverlayStore {
  const store = new ConfigOverlayStore("/overlay/config.yaml", createMockLogger());
  vi.spyOn(store, "start").mockResolvedValue(undefined);
  vi.spyOn(store, "stop").mockResolvedValue(undefined);
  vi.spyOn(store, "replace").mockResolvedValue(true);
  vi.spyOn(store, "applyPatch").mockResolvedValue(true);
  vi.spyOn(store, "set").mockResolvedValue(true);
  vi.spyOn(store, "delete").mockResolvedValue(true);
  return store;
}

function createAgentRunnerMock(): RunAttemptDispatcher {
  return {
    runAttempt: vi.fn(async () => {
      throw new Error("not used in setup api tests");
    }),
  };
}

function createOrchestratorMock(): Orchestrator {
  const logger = createMockLogger();
  const orchestrator = new Orchestrator({
    attemptStore: new AttemptStore("/attempt-store", logger),
    configStore: new ConfigStore("/workflow.md", logger),
    linearClient: new LinearClient(() => {
      throw new Error("not used in setup api tests");
    }, logger),
    workspaceManager: new WorkspaceManager(() => {
      throw new Error("not used in setup api tests");
    }, logger),
    agentRunner: createAgentRunnerMock(),
    logger,
  });
  vi.spyOn(orchestrator, "start").mockResolvedValue(undefined);
  vi.spyOn(orchestrator, "stop").mockResolvedValue(undefined);
  vi.spyOn(orchestrator, "requestRefresh").mockReturnValue({
    queued: true,
    coalesced: false,
    requestedAt: "2026-03-22T00:00:00Z",
  });
  vi.spyOn(orchestrator, "getSnapshot").mockImplementation(() => {
    throw new Error("not used in setup api tests");
  });
  vi.spyOn(orchestrator, "getIssueDetail").mockReturnValue(null);
  vi.spyOn(orchestrator, "getAttemptDetail").mockReturnValue(null);
  vi.spyOn(orchestrator, "updateIssueModelSelection").mockResolvedValue(null);
  return orchestrator;
}

async function startSetupApiServer(options?: {
  archiveDir?: string;
  secretsStore?: SecretsStore;
  configOverlayStore?: ConfigOverlayStore;
  orchestrator?: Orchestrator;
}): Promise<{
  baseUrl: string;
  secretsStore: SecretsStore;
  configOverlayStore: ConfigOverlayStore;
  orchestrator: Orchestrator;
}> {
  const app = express();
  app.use(express.json());

  const secretsStore = options?.secretsStore ?? createSecretsStoreMock();
  const configOverlayStore = options?.configOverlayStore ?? createConfigOverlayStoreMock();
  const orchestrator = options?.orchestrator ?? createOrchestratorMock();

  registerSetupApi(app, {
    secretsStore,
    configOverlayStore,
    orchestrator,
    archiveDir: options?.archiveDir ?? "/archive-root",
  });

  const server = await new Promise<Server>((resolve) => {
    const startedServer = app.listen(0, "127.0.0.1", () => resolve(startedServer));
  });
  servers.push(server);

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new TypeError("Expected HTTP server to bind to an address object");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    secretsStore,
    configOverlayStore,
    orchestrator,
  };
}

async function postJson(baseUrl: string, route: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.LINEAR_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GITHUB_TOKEN;

  existsSyncMock.mockReset();
  existsSyncMock.mockReturnValue(false);
  mkdirMock.mockReset();
  mkdirMock.mockResolvedValue(undefined);
  writeFileMock.mockReset();
  writeFileMock.mockResolvedValue(undefined);
  startDeviceAuthMock.mockReset();
  pollDeviceAuthMock.mockReset();
  saveDeviceAuthTokensMock.mockReset();

  externalFetchMock = vi.fn<FetchStub>();
  vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith("http://127.0.0.1:")) {
      return realFetch(input, init);
    }
    return externalFetchMock(input, init);
  });
});

afterEach(async () => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
    ),
  );
});

describe("registerSetupApi — device auth & tokens", () => {
  it("starts device auth successfully", async () => {
    startDeviceAuthMock.mockResolvedValueOnce({
      user_code: "ABCD-EFGH",
      verification_uri: "https://example.com/device",
      verification_uri_complete: "https://example.com/device?user_code=ABCD-EFGH",
      device_code: "device-123",
      expires_in: 900,
      interval: 5,
    });

    const { baseUrl } = await startSetupApiServer();
    const response = await postJson(baseUrl, "/api/v1/setup/device-auth/start");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userCode: "ABCD-EFGH",
      verificationUri: "https://example.com/device?user_code=ABCD-EFGH",
      deviceCode: "device-123",
      expiresIn: 900,
      interval: 5,
    });
  });

  it("returns device_auth_error when starting device auth fails", async () => {
    startDeviceAuthMock.mockRejectedValueOnce(new Error("oauth offline"));

    const { baseUrl } = await startSetupApiServer();
    const response = await postJson(baseUrl, "/api/v1/setup/device-auth/start");

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "device_auth_error",
        message: "Error: oauth offline",
      },
    });
  });

  it("returns missing_device_code when polling without a device code", async () => {
    const { baseUrl } = await startSetupApiServer();
    const response = await postJson(baseUrl, "/api/v1/setup/device-auth/poll", {});

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "missing_device_code",
        message: "deviceCode is required",
      },
    });
  });

  it("returns pending while device auth is still waiting for approval", async () => {
    pollDeviceAuthMock.mockResolvedValueOnce({ status: "pending" });

    const { baseUrl } = await startSetupApiServer();
    const response = await postJson(baseUrl, "/api/v1/setup/device-auth/poll", { deviceCode: "device-123" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "pending" });
    expect(saveDeviceAuthTokensMock).not.toHaveBeenCalled();
  });

  it("completes device auth and saves tokens", async () => {
    const configOverlayStore = createConfigOverlayStoreMock();
    pollDeviceAuthMock.mockResolvedValueOnce({ status: "complete" });
    saveDeviceAuthTokensMock.mockResolvedValueOnce({ ok: true });

    const { baseUrl } = await startSetupApiServer({ configOverlayStore, archiveDir: "/test-archive" });
    const response = await postJson(baseUrl, "/api/v1/setup/device-auth/poll", { deviceCode: "device-123" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "complete" });
    expect(saveDeviceAuthTokensMock).toHaveBeenCalledWith("device-123", "/test-archive", configOverlayStore);
  });

  it("returns an error payload when saving completed device auth tokens fails", async () => {
    pollDeviceAuthMock.mockResolvedValueOnce({ status: "complete" });
    saveDeviceAuthTokensMock.mockResolvedValueOnce({ ok: false, error: "token save failed" });

    const { baseUrl } = await startSetupApiServer();
    const response = await postJson(baseUrl, "/api/v1/setup/device-auth/poll", { deviceCode: "device-123" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "error",
      error: "token save failed",
    });
  });

  it("returns expired when device auth expires", async () => {
    pollDeviceAuthMock.mockResolvedValueOnce({ status: "expired", error: "Device code expired. Please start again." });

    const { baseUrl } = await startSetupApiServer();
    const response = await postJson(baseUrl, "/api/v1/setup/device-auth/poll", { deviceCode: "device-123" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "expired",
      error: "Device code expired. Please start again.",
    });
  });

  it("returns poll_error when device auth polling throws", async () => {
    pollDeviceAuthMock.mockRejectedValueOnce(new Error("poll failed"));

    const { baseUrl } = await startSetupApiServer();
    const response = await postJson(baseUrl, "/api/v1/setup/device-auth/poll", { deviceCode: "device-123" });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "poll_error",
        message: "Error: poll failed",
      },
    });
  });

  it("returns missing_token when GitHub token is missing", async () => {
    const { baseUrl } = await startSetupApiServer();
    const response = await postJson(baseUrl, "/api/v1/setup/github-token", {});

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "missing_token",
        message: "token is required",
      },
    });
  });

  it("validates and stores a valid GitHub token", async () => {
    const secretsStore = createSecretsStoreMock();
    externalFetchMock.mockResolvedValueOnce(textResponse(200, "ok"));

    const { baseUrl } = await startSetupApiServer({ secretsStore });
    const response = await postJson(baseUrl, "/api/v1/setup/github-token", { token: "ghp_valid" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: true });
    expect(externalFetchMock).toHaveBeenCalledWith("https://api.github.com/user", {
      headers: {
        authorization: "token ghp_valid",
        "user-agent": "Symphony-Orchestrator",
      },
    });
    expect(secretsStore.set).toHaveBeenCalledWith("GITHUB_TOKEN", "ghp_valid");
  });

  it("rejects an invalid GitHub token", async () => {
    const secretsStore = createSecretsStoreMock();
    externalFetchMock.mockResolvedValueOnce(textResponse(401, "unauthorized"));

    const { baseUrl } = await startSetupApiServer({ secretsStore });
    const response = await postJson(baseUrl, "/api/v1/setup/github-token", { token: "ghp_invalid" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: false });
    expect(secretsStore.set).not.toHaveBeenCalled();
  });

  it.each([
    "/api/v1/setup/status",
    "/api/v1/setup/reset",
    "/api/v1/setup/master-key",
    "/api/v1/setup/linear-projects",
    "/api/v1/setup/linear-project",
    "/api/v1/setup/openai-key",
    "/api/v1/setup/codex-auth",
    "/api/v1/setup/device-auth/start",
    "/api/v1/setup/device-auth/poll",
    "/api/v1/setup/github-token",
  ])("returns 405 for unsupported methods on %s", async (route) => {
    const { baseUrl } = await startSetupApiServer();
    const response = await fetch(`${baseUrl}${route}`, { method: "PUT" });

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({
      error: {
        code: "method_not_allowed",
        message: "Method Not Allowed",
      },
    });
  });
});
