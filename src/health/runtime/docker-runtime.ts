import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DockerCommandResult, DockerProbeRuntime, WorkspaceProbeResult } from "../probes/docker-probe.js";

/**
 * Concrete Docker probe runtime — shells out to the local `docker` CLI
 * and runs filesystem probes via `node:fs/promises`. Probes are
 * cancellation-aware so the runner's per-probe timeout actually kills
 * an unresponsive `docker info` rather than letting it hang.
 */
export function createDockerRuntime(): DockerProbeRuntime {
  return {
    async daemonInfo(signal: AbortSignal): Promise<DockerCommandResult> {
      return runDocker(["info", "--format", "{{.ServerVersion}}"], signal);
    },
    async imageInspect(imageRef: string, signal: AbortSignal): Promise<DockerCommandResult> {
      return runDocker(["image", "inspect", imageRef], signal);
    },
    async probeWorkspace(targetPath: string, signal: AbortSignal): Promise<WorkspaceProbeResult> {
      // mkdtemp covers ENOENT / ENOTDIR / EACCES / EROFS / ENOSPC in one
      // syscall — a separate stat() before it adds a TOCTOU window for no
      // extra signal.
      if (signal.aborted) return { ok: false, errorCode: "OTHER", message: "probe aborted" };
      let scratch: string | null = null;
      try {
        scratch = await mkdtemp(path.join(targetPath, ".risoluto-health-"));
        await writeFile(path.join(scratch, "probe"), "ok");
        return { ok: true, errorCode: null, message: "" };
      } catch (error) {
        return { ok: false, errorCode: extractErrno(error), message: errorMessage(error) };
      } finally {
        if (scratch) await rm(scratch, { recursive: true, force: true }).catch(() => undefined);
      }
    },
  };
}

async function runDocker(args: string[], signal: AbortSignal): Promise<DockerCommandResult> {
  return new Promise<DockerCommandResult>((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      resolve({ exitCode: -1, stdout: "", stderr: errorMessage(error) });
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const onAbort = () => {
      child.kill("SIGKILL");
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });

    child.on("error", (error) => {
      signal.removeEventListener("abort", onAbort);
      resolve({ exitCode: -1, stdout, stderr: stderr || errorMessage(error) });
    });
    child.on("close", (code) => {
      signal.removeEventListener("abort", onAbort);
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
  });
}

function extractErrno(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return "OTHER";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
