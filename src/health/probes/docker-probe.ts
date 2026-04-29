import type { HealthFailureKind, HealthSubprobe } from "../../core/types/health.js";
import type { HealthProbe, HealthProbeContext } from "../probe-port.js";
import { timedSubprobe as timed, type ProbeDecision } from "../timed-probe.js";

/**
 * Three-way Docker reachability probe:
 *   1. `docker info --format ServerVersion` — daemon alive, version readable
 *   2. `docker image inspect {codex_image}` — codex container image present locally
 *   3. workspace stat + write/delete — disk has free space, mount is writable, ownership correct
 *
 * Sub-probes run in parallel. Latency banded ok / slow / down per sub-probe.
 *
 * Failure kinds are precise:
 *   - `unreachable` — daemon socket refused / docker CLI missing
 *   - `image_missing` — `docker image inspect` exit 1 with "no such image"
 *   - `resource` — workspace ENOSPC / EACCES / EROFS
 *   - `remote_error` — anything else with a non-zero exit code
 */

const DAEMON_SLOW_MS = 200;
const DAEMON_DOWN_MS = 2000;
const IMAGE_SLOW_MS = 200;
const IMAGE_DOWN_MS = 2000;
const WORKSPACE_SLOW_MS = 50;
const WORKSPACE_DOWN_MS = 500;

export interface DockerProbeRuntime {
  /** `docker info --format '{{.ServerVersion}}'`. */
  daemonInfo(signal: AbortSignal): Promise<DockerCommandResult>;
  /** `docker image inspect <imageRef>`. */
  imageInspect(imageRef: string, signal: AbortSignal): Promise<DockerCommandResult>;
  /** Stat + write/delete a temp file inside `path`. */
  probeWorkspace(path: string, signal: AbortSignal): Promise<WorkspaceProbeResult>;
}

export interface DockerCommandResult {
  /** Exit code. -1 → command never started (e.g. `docker` not on PATH). */
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface WorkspaceProbeResult {
  ok: boolean;
  /** "ENOSPC" | "EACCES" | "EROFS" | "ENOENT" | "OTHER" — drives failureKind. */
  errorCode: string | null;
  message: string;
}

export interface DockerProbeOptions {
  runtime: DockerProbeRuntime;
  /** Codex container image (e.g. "ghcr.io/openai/codex:latest"). */
  codexImageRef: () => string;
  /** Workspace root from config — the directory we stat + write into. */
  workspaceRoot: () => string;
}

export class DockerProbe implements HealthProbe {
  readonly id = "docker" as const;

  constructor(private readonly options: DockerProbeOptions) {}

  async run(context: HealthProbeContext): Promise<HealthSubprobe[]> {
    const { signal, nowMs } = context;
    const tasks: Array<Promise<HealthSubprobe>> = [
      timed(nowMs, "daemon", DAEMON_SLOW_MS, DAEMON_DOWN_MS, () => this.runDaemon(signal)),
      timed(nowMs, "image", IMAGE_SLOW_MS, IMAGE_DOWN_MS, () => this.runImage(signal)),
      timed(nowMs, "workspace", WORKSPACE_SLOW_MS, WORKSPACE_DOWN_MS, () => this.runWorkspace(signal)),
    ];
    return Promise.all(tasks);
  }

  private async runDaemon(signal: AbortSignal): Promise<ProbeDecision> {
    try {
      const result = await this.options.runtime.daemonInfo(signal);
      if (result.exitCode === -1) return down("unreachable", "docker CLI not found on PATH");
      if (result.exitCode !== 0) {
        const lower = result.stderr.toLowerCase();
        if (lower.includes("connection refused") || lower.includes("cannot connect")) {
          return down("unreachable", "Docker daemon connection refused");
        }
        return down("remote_error", trim(result.stderr) || `docker info exit ${result.exitCode}`);
      }
      const version = result.stdout.trim();
      return { status: "ok", failureKind: "ok", detail: version ? `daemon ${version}` : "daemon up" };
    } catch (error) {
      return down("unreachable", asMessage(error));
    }
  }

  private async runImage(signal: AbortSignal): Promise<ProbeDecision> {
    const ref = this.options.codexImageRef();
    if (!ref) return down("image_missing", "Codex image ref not configured");
    try {
      const result = await this.options.runtime.imageInspect(ref, signal);
      if (result.exitCode === -1) return down("unreachable", "docker CLI not found on PATH");
      if (result.exitCode !== 0) {
        const lower = result.stderr.toLowerCase();
        if (lower.includes("no such image") || lower.includes("not found")) {
          return down("image_missing", `Image ${ref} not pulled`);
        }
        return down("remote_error", trim(result.stderr) || `docker image inspect exit ${result.exitCode}`);
      }
      return { status: "ok", failureKind: "ok", detail: `${ref} present` };
    } catch (error) {
      return down("unreachable", asMessage(error));
    }
  }

  private async runWorkspace(signal: AbortSignal): Promise<ProbeDecision> {
    const root = this.options.workspaceRoot();
    if (!root) return down("resource", "Workspace root not configured");
    try {
      const result = await this.options.runtime.probeWorkspace(root, signal);
      if (result.ok) return { status: "ok", failureKind: "ok", detail: `${root} writable` };
      switch (result.errorCode) {
        case "ENOSPC":
          return down("resource", `Workspace full: ${result.message}`);
        case "EACCES":
        case "EPERM":
          return down("resource", `Workspace permission denied: ${result.message}`);
        case "EROFS":
          return down("resource", `Workspace read-only: ${result.message}`);
        case "ENOENT":
          return down("config_drift", `Workspace path missing: ${root}`);
        default:
          return down("resource", result.message || "Workspace probe failed");
      }
    } catch (error) {
      return down("resource", asMessage(error));
    }
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

function down(failureKind: HealthFailureKind, detail: string): ProbeDecision {
  return { status: "down", failureKind, detail };
}

function asMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function trim(s: string): string {
  const t = s.trim();
  return t.length > 200 ? `${t.slice(0, 197)}…` : t;
}
