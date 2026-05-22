import { beforeEach, describe, expect, it, vi } from "vitest";

import { GitHubTransport } from "../../src/github/transport.js";

describe("GitHubTransport", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  });

  it("uses a configured authorization scheme", async () => {
    const transport = new GitHubTransport({
      fetch: fetchMock as unknown as typeof fetch,
      authorizationScheme: "token",
      defaultHeaders: { "user-agent": "Risoluto" },
    });

    await transport.send({ pathName: "/user", method: "GET", token: "ghp_valid" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "token ghp_valid",
          "user-agent": "Risoluto",
        }),
      }),
    );
  });

  it("can omit authorization for anonymous requests", async () => {
    const transport = new GitHubTransport({
      fetch: fetchMock as unknown as typeof fetch,
      defaultHeaders: { accept: "application/vnd.github+json" },
    });

    await transport.send({ pathName: "/repos/openai/risoluto", method: "GET", omitAuthorization: true });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
    expect(headers.accept).toBe("application/vnd.github+json");
  });

  it("forwards abort signals to fetch", async () => {
    const controller = new AbortController();
    const transport = new GitHubTransport({
      fetch: fetchMock as unknown as typeof fetch,
    });

    await transport.send({ pathName: "/user", method: "GET", token: "ghp_valid", signal: controller.signal });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/user",
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
