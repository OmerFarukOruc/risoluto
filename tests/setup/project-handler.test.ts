import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  type HoistedMocks,
  startSetupApiServer,
  postJson,
  setupBeforeEach,
  setupAfterEach,
  getExternalFetchMock,
} from "./setup-fixtures.js";

// ---------------------------------------------------------------------------
// Shared hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  existsSyncMock: vi.fn<(filePath: string) => boolean>(),
  mkdirMock: vi.fn<(filePath: string, options?: { recursive?: boolean }) => Promise<void>>(),
  writeFileMock:
    vi.fn<(filePath: string, data: string, options?: { encoding?: BufferEncoding; mode?: number }) => Promise<void>>(),
  startDeviceAuthMock: vi.fn(),
  pollDeviceAuthMock: vi.fn(),
  saveDeviceAuthTokensMock: vi.fn(),
})) satisfies HoistedMocks;

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return { ...original, existsSync: mocks.existsSyncMock };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    mkdir: mocks.mkdirMock,
    writeFile: mocks.writeFileMock,
  };
});

vi.mock("../../src/setup/device-auth.js", () => ({
  startDeviceAuth: mocks.startDeviceAuthMock,
  pollDeviceAuth: mocks.pollDeviceAuthMock,
  saveDeviceAuthTokens: mocks.saveDeviceAuthTokensMock,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLinearTeamsResponse(teams: Array<{ id: string; name: string; key: string }>) {
  return {
    data: { teams: { nodes: teams } },
  };
}

function createProjectCreateResponse(
  success: boolean,
  project?: { id: string; name: string; slugId: string; url: string; teams?: { nodes: Array<{ key: string }> } },
) {
  return {
    data: { projectCreate: { success, project } },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/setup/create-project", () => {
  beforeEach(() => setupBeforeEach(mocks));
  afterEach(async () => setupAfterEach());

  it("returns 400 when LINEAR_API_KEY is missing", async () => {
    const { baseUrl, secretsStore } = await startSetupApiServer();
    vi.spyOn(secretsStore, "get").mockReturnValue(undefined);

    const response = await postJson(baseUrl, "/api/v1/setup/create-project", { name: "Project X" });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("missing_api_key");
  });

  it("returns 400 when project name is missing", async () => {
    const { baseUrl, secretsStore } = await startSetupApiServer();
    vi.spyOn(secretsStore, "get").mockReturnValue("lin_api_key");

    const response = await postJson(baseUrl, "/api/v1/setup/create-project", {});

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("missing_name");
  });

  it("returns 400 when project name is whitespace-only", async () => {
    const { baseUrl, secretsStore } = await startSetupApiServer();
    vi.spyOn(secretsStore, "get").mockReturnValue("lin_api_key");

    const response = await postJson(baseUrl, "/api/v1/setup/create-project", { name: "   " });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("missing_name");
  });

  it("returns 400 when no teams found in Linear workspace", async () => {
    const { baseUrl, secretsStore } = await startSetupApiServer();
    vi.spyOn(secretsStore, "get").mockReturnValue("lin_api_key");

    getExternalFetchMock().mockResolvedValue(
      new Response(JSON.stringify(createLinearTeamsResponse([])), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const response = await postJson(baseUrl, "/api/v1/setup/create-project", { name: "My Project" });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("no_teams");
  });

  it("creates project and returns slugId on success", async () => {
    const { baseUrl, secretsStore } = await startSetupApiServer();
    vi.spyOn(secretsStore, "get").mockReturnValue("lin_api_key");

    const teams = [{ id: "team-1", name: "Engineering", key: "ENG" }];
    const project = {
      id: "proj-1",
      name: "My Project",
      slugId: "my-project-abc",
      url: "https://linear.app/team/my-project-abc",
      teams: { nodes: [{ key: "ENG" }] },
    };

    let callCount = 0;
    getExternalFetchMock().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call: teams query
        return new Response(JSON.stringify(createLinearTeamsResponse(teams)), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // Second call: project creation
      return new Response(JSON.stringify(createProjectCreateResponse(true, project)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const response = await postJson(baseUrl, "/api/v1/setup/create-project", { name: "My Project" });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; project: { slugId: string; teamKey: string } };
    expect(body.ok).toBe(true);
    expect(body.project.slugId).toBe("my-project-abc");
    expect(body.project.teamKey).toBe("ENG");
  });

  it("returns 502 when Linear API returns a non-success response", async () => {
    const { baseUrl, secretsStore } = await startSetupApiServer();
    vi.spyOn(secretsStore, "get").mockReturnValue("lin_api_key");

    const teams = [{ id: "team-1", name: "Engineering", key: "ENG" }];

    let callCount = 0;
    getExternalFetchMock().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify(createLinearTeamsResponse(teams)), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // Project creation fails
      return new Response(JSON.stringify(createProjectCreateResponse(false)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const response = await postJson(baseUrl, "/api/v1/setup/create-project", { name: "My Project" });

    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("linear_api_error");
  });

  it("returns 502 when Linear API throws network error", async () => {
    const { baseUrl, secretsStore } = await startSetupApiServer();
    vi.spyOn(secretsStore, "get").mockReturnValue("lin_api_key");

    getExternalFetchMock().mockRejectedValue(new Error("Network unreachable"));

    const response = await postJson(baseUrl, "/api/v1/setup/create-project", { name: "My Project" });

    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("linear_api_error");
  });
});
