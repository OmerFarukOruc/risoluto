import { describe, expect, it, vi } from "vitest";

import { createGithubHttpAdapter } from "../../../src/health/runtime/github-http.js";

function textResponse(status: number, body: string, headers?: Record<string, string>): Response {
  return new Response(body, { status, headers });
}

describe("createGithubHttpAdapter", () => {
  it("returns status 0 without fetching when the token is missing", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const adapter = createGithubHttpAdapter({
      resolveToken: () => null,
      fetchImpl: fetchMock,
    });

    await expect(adapter.pingUser(new AbortController().signal)).resolves.toEqual({
      status: 0,
      scopes: [],
      bodyExcerpt: "no GitHub token configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the transport headers, base URL, token, and abort signal", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      textResponse(200, "ok", {
        "x-oauth-scopes": "repo, workflow",
      }),
    );
    const controller = new AbortController();
    const adapter = createGithubHttpAdapter({
      resolveToken: () => "ghp_test",
      baseUrl: "https://github.example.test/api/v3",
      fetchImpl: fetchMock,
    });

    await expect(adapter.pingUser(controller.signal)).resolves.toEqual({
      status: 200,
      scopes: ["repo", "workflow"],
      bodyExcerpt: "ok",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.example.test/api/v3/user",
      expect.objectContaining({
        method: "GET",
        signal: controller.signal,
        headers: {
          accept: "application/vnd.github+json",
          authorization: "Bearer ghp_test",
          "user-agent": "risoluto-health-probe/1",
        },
      }),
    );
  });

  it("maps transport failures to status 0 results", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("socket closed"));
    const adapter = createGithubHttpAdapter({
      resolveToken: () => "ghp_test",
      fetchImpl: fetchMock,
    });

    await expect(adapter.pingRepo("acme", "app", new AbortController().signal)).resolves.toEqual({
      status: 0,
      scopes: [],
      bodyExcerpt: "socket closed",
    });
  });

  it("parses the core rate-limit bucket", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      textResponse(
        200,
        JSON.stringify({
          resources: {
            core: {
              limit: 5000,
              remaining: 4999,
              reset: 1_700_000_000,
            },
          },
        }),
      ),
    );
    const adapter = createGithubHttpAdapter({
      resolveToken: () => "ghp_test",
      fetchImpl: fetchMock,
    });

    await expect(adapter.pingRateLimit(new AbortController().signal)).resolves.toMatchObject({
      status: 200,
      remaining: 4999,
      limit: 5000,
      resetAt: "2023-11-14T22:13:20.000Z",
    });
  });
});
