import { describe, expect, it, vi } from "vitest";

import { DockerProbe, type DockerProbeRuntime } from "../../../src/health/probes/docker-probe.js";

function runtime(overrides: Partial<DockerProbeRuntime> = {}): DockerProbeRuntime {
  return {
    daemonInfo: vi.fn(async () => ({ exitCode: 0, stdout: "24.0.7", stderr: "" })),
    imageInspect: vi.fn(async () => ({ exitCode: 0, stdout: "[]", stderr: "" })),
    probeWorkspace: vi.fn(async () => ({ ok: true, errorCode: null, message: "" })),
    ...overrides,
  };
}

function ctx(now: () => number = () => 0) {
  return { signal: new AbortController().signal, nowMs: now };
}

describe("DockerProbe", () => {
  it("returns three subprobes ok on the happy path", async () => {
    const probe = new DockerProbe({
      runtime: runtime(),
      codexImageRef: () => "ghcr.io/openai/codex:latest",
      workspaceRoot: () => "/tmp/risoluto",
    });
    const subprobes = await probe.run(ctx());
    expect(subprobes.map((s) => s.name)).toEqual(["daemon", "image", "workspace"]);
    expect(subprobes.every((s) => s.status === "ok")).toBe(true);
  });

  it("classifies docker CLI missing as unreachable", async () => {
    const probe = new DockerProbe({
      runtime: runtime({
        daemonInfo: vi.fn(async () => ({ exitCode: -1, stdout: "", stderr: "" })),
      }),
      codexImageRef: () => "ghcr.io/openai/codex:latest",
      workspaceRoot: () => "/tmp/risoluto",
    });
    const subprobes = await probe.run(ctx());
    const daemon = subprobes.find((s) => s.name === "daemon")!;
    expect(daemon.status).toBe("down");
    expect(daemon.failureKind).toBe("unreachable");
    expect(daemon.detail).toContain("CLI");
  });

  it("flags daemon connection refused as unreachable", async () => {
    const probe = new DockerProbe({
      runtime: runtime({
        daemonInfo: vi.fn(async () => ({
          exitCode: 1,
          stdout: "",
          stderr: "Cannot connect to the Docker daemon",
        })),
      }),
      codexImageRef: () => "ghcr.io/openai/codex:latest",
      workspaceRoot: () => "/tmp/risoluto",
    });
    const subprobes = await probe.run(ctx());
    const daemon = subprobes.find((s) => s.name === "daemon")!;
    expect(daemon.status).toBe("down");
    expect(daemon.failureKind).toBe("unreachable");
  });

  it("flags missing image as image_missing", async () => {
    const probe = new DockerProbe({
      runtime: runtime({
        imageInspect: vi.fn(async () => ({
          exitCode: 1,
          stdout: "",
          stderr: "Error: No such image: codex:latest",
        })),
      }),
      codexImageRef: () => "codex:latest",
      workspaceRoot: () => "/tmp/risoluto",
    });
    const subprobes = await probe.run(ctx());
    const image = subprobes.find((s) => s.name === "image")!;
    expect(image.status).toBe("down");
    expect(image.failureKind).toBe("image_missing");
    expect(image.detail).toContain("codex:latest");
  });

  it("flags ENOSPC as resource", async () => {
    const probe = new DockerProbe({
      runtime: runtime({
        probeWorkspace: vi.fn(async () => ({
          ok: false,
          errorCode: "ENOSPC",
          message: "No space left on device",
        })),
      }),
      codexImageRef: () => "codex:latest",
      workspaceRoot: () => "/var/lib/risoluto",
    });
    const subprobes = await probe.run(ctx());
    const ws = subprobes.find((s) => s.name === "workspace")!;
    expect(ws.status).toBe("down");
    expect(ws.failureKind).toBe("resource");
    expect(ws.detail).toContain("full");
  });

  it("flags ENOENT as config_drift", async () => {
    const probe = new DockerProbe({
      runtime: runtime({
        probeWorkspace: vi.fn(async () => ({
          ok: false,
          errorCode: "ENOENT",
          message: "no such directory",
        })),
      }),
      codexImageRef: () => "codex:latest",
      workspaceRoot: () => "/missing/dir",
    });
    const subprobes = await probe.run(ctx());
    const ws = subprobes.find((s) => s.name === "workspace")!;
    expect(ws.status).toBe("down");
    expect(ws.failureKind).toBe("config_drift");
  });

  it("promotes ok to slow when daemon latency exceeds the slow band", async () => {
    let now = 0;
    const probe = new DockerProbe({
      runtime: runtime({
        daemonInfo: vi.fn(async () => {
          now += 500;
          return { exitCode: 0, stdout: "24.0.7", stderr: "" };
        }),
      }),
      codexImageRef: () => "codex:latest",
      workspaceRoot: () => "/tmp/risoluto",
    });
    const subprobes = await probe.run(ctx(() => now));
    const daemon = subprobes.find((s) => s.name === "daemon")!;
    expect(daemon.status).toBe("slow");
    expect(daemon.latencyMs).toBe(500);
  });
});
