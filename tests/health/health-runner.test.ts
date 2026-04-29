import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TypedEventBus } from "../../src/core/event-bus.js";
import type { RisolutoEventMap } from "../../src/core/risoluto-events.js";
import type { HealthProbe } from "../../src/health/probe-port.js";
import { HealthRunner } from "../../src/health/health-runner.js";
import type { HealthSubprobe } from "../../src/core/types/health.js";
import { createLogger } from "../../src/core/logger.js";

function memoryStore() {
  const rows: Array<{ atMs: number; probe: string; subprobes: HealthSubprobe[] }> = [];
  return {
    rows,
    port: {
      append: (input: { atMs: number; probe: string; subprobes: ReadonlyArray<HealthSubprobe> }) => {
        rows.push({ atMs: input.atMs, probe: input.probe, subprobes: [...input.subprobes] });
      },
      recentSamples: () => [],
    },
  };
}

function fakeProbe(
  id: "github" | "linear" | "docker",
  outcomes: HealthSubprobe[][] | (() => HealthSubprobe[]),
): HealthProbe {
  let i = 0;
  return {
    id,
    run: vi.fn(async () => {
      if (typeof outcomes === "function") return outcomes();
      const result = outcomes[Math.min(i, outcomes.length - 1)];
      i += 1;
      return result;
    }),
  };
}

function ok(name: string): HealthSubprobe {
  return { name, status: "ok", failureKind: "ok", latencyMs: 10, detail: "" };
}

function down(name: string, kind: HealthSubprobe["failureKind"] = "remote_error"): HealthSubprobe {
  return { name, status: "down", failureKind: kind, latencyMs: 10, detail: "boom" };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("HealthRunner", () => {
  it("aggregates the worst sub-probe into the top-level status", async () => {
    const probe = fakeProbe("github", [[ok("auth"), down("repo:acme/foo", "config_drift")]]);
    const store = memoryStore();
    const runner = new HealthRunner({
      probes: [probe],
      store: store.port,
      logger: createLogger(),
      random: () => 0.5,
      nowMs: () => 1000,
    });
    await runner.tick();
    const checks = runner.getChecks();
    expect(checks.github.status).toBe("down");
    expect(checks.github.failureKind).toBe("config_drift");
    expect(checks.github.subprobes).toHaveLength(2);
  });

  it("does not run a probe under steady-state cadence (only every 5 ticks)", async () => {
    const probe = fakeProbe("github", () => [ok("auth")]);
    const store = memoryStore();
    const runner = new HealthRunner({
      probes: [probe],
      store: store.port,
      logger: createLogger(),
      random: () => 0.5,
      nowMs: () => 1000,
      probeTimeoutMs: 1000,
    });
    // tick 1 → first run (always)
    await runner.tick();
    // ticks 2-5 → skipped (steady-state, cadence is every 5 ticks)
    await runner.tick();
    await runner.tick();
    await runner.tick();
    await runner.tick();
    expect(probe.run).toHaveBeenCalledTimes(1);
    // tick 6 → due again
    await runner.tick();
    expect(probe.run).toHaveBeenCalledTimes(2);
  });

  it("runs every tick once a probe is in 'watch' (any non-ok in window)", async () => {
    const probe = fakeProbe("github", [[down("auth", "auth_failure")], [ok("auth")], [ok("auth")]]);
    const store = memoryStore();
    const runner = new HealthRunner({
      probes: [probe],
      store: store.port,
      logger: createLogger(),
      random: () => 0.5,
      nowMs: () => 1000,
      probeTimeoutMs: 1000,
    });
    await runner.tick(); // run 1 — fail; window = [fail]
    await runner.tick(); // run 2 — ok but window still has fail → watch
    await runner.tick(); // run 3 — ok, window = [fail, ok, ok] → still watch
    expect(probe.run).toHaveBeenCalledTimes(3);
  });

  it("persists every sub-probe outcome to the store", async () => {
    const probe = fakeProbe("github", [[ok("auth"), ok("repo:acme/foo")]]);
    const store = memoryStore();
    const runner = new HealthRunner({
      probes: [probe],
      store: store.port,
      logger: createLogger(),
      random: () => 0.5,
      nowMs: () => 2000,
    });
    await runner.tick();
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0].probe).toBe("github");
    expect(store.rows[0].subprobes.map((s) => s.name)).toEqual(["auth", "repo:acme/foo"]);
  });

  it("emits a health.transition event when status changes", async () => {
    const probe = fakeProbe("github", [[ok("auth")], [down("auth", "auth_failure")]]);
    const store = memoryStore();
    const eventBus = new TypedEventBus<RisolutoEventMap>();
    const transitions: RisolutoEventMap["health.transition"][] = [];
    eventBus.on("health.transition", (event) => transitions.push(event));

    const runner = new HealthRunner({
      probes: [probe],
      store: store.port,
      logger: createLogger(),
      eventBus,
      random: () => 0.5,
      nowMs: () => 1000,
      probeTimeoutMs: 1000,
    });
    await runner.tick(); // tick 1 — unknown → ok
    // ticks 2..5 are gated by steady-state cadence (5-tick interval).
    for (let i = 0; i < 4; i++) await runner.tick();
    await runner.tick(); // tick 6 — ok → down (cadence elapsed)
    expect(transitions).toHaveLength(2);
    expect(transitions[0].previousStatus).toBe("unknown");
    expect(transitions[0].currentStatus).toBe("ok");
    expect(transitions[1].previousStatus).toBe("ok");
    expect(transitions[1].currentStatus).toBe("down");
    expect(transitions[1].failureKind).toBe("auth_failure");
  });

  it("hysteresis: 2 fails in window of 5 → degrades a single later ok", async () => {
    // Window: fail, fail, ok, ok, ok → after 5 outcomes, no demote (only 2 fails, current ok)
    // Build sequence so on the 3rd run window is [fail, fail, ok] with current ok.
    const probe = fakeProbe("github", [[down("auth")], [down("auth")], [ok("auth")]]);
    const store = memoryStore();
    const runner = new HealthRunner({
      probes: [probe],
      store: store.port,
      logger: createLogger(),
      random: () => 0.5,
      nowMs: () => 1000,
      probeTimeoutMs: 1000,
    });
    await runner.tick(); // fail; window=[fail]
    await runner.tick(); // fail; window=[fail, fail]
    await runner.tick(); // ok; window=[fail, fail, ok] — 2 fails → degraded
    expect(runner.getChecks().github.status).toBe("degraded");
  });

  it("hysteresis: 4+ fails in window forces down even if current sub-probe is ok", async () => {
    const probe = fakeProbe("github", [[down("auth")], [down("auth")], [down("auth")], [down("auth")], [ok("auth")]]);
    const store = memoryStore();
    const runner = new HealthRunner({
      probes: [probe],
      store: store.port,
      logger: createLogger(),
      random: () => 0.5,
      nowMs: () => 1000,
      probeTimeoutMs: 1000,
    });
    for (let i = 0; i < 5; i++) await runner.tick();
    expect(runner.getChecks().github.status).toBe("down"); // 4 fails → still down
  });

  it("runs all due probes in parallel", async () => {
    const order: string[] = [];
    const slow = (id: "github" | "docker"): HealthProbe => ({
      id,
      run: vi.fn(async () => {
        order.push(`${id}:start`);
        await new Promise((resolve) => setTimeout(resolve, 100));
        order.push(`${id}:end`);
        return [ok("a")];
      }),
    });
    const store = memoryStore();
    const runner = new HealthRunner({
      probes: [slow("github"), slow("docker")],
      store: store.port,
      logger: createLogger(),
      random: () => 0.5,
      nowMs: () => 1000,
      probeTimeoutMs: 5000,
    });
    const tickPromise = runner.tick();
    await vi.runAllTimersAsync();
    await tickPromise;
    expect(order).toEqual(["github:start", "docker:start", "github:end", "docker:end"]);
  });

  it("populates lastSuccessAt and lastFailureAt independently", async () => {
    let now = 1000;
    const probe = fakeProbe("github", [[ok("auth")], [down("auth", "auth_failure")], [ok("auth")]]);
    const store = memoryStore();
    const runner = new HealthRunner({
      probes: [probe],
      store: store.port,
      logger: createLogger(),
      random: () => 0.5,
      nowMs: () => now,
      probeTimeoutMs: 1000,
    });
    await runner.tick(); // tick 1 — first ok
    const after1 = runner.getChecks().github;
    expect(after1.lastSuccessAt).not.toBeNull();
    expect(after1.lastFailureAt).toBeNull();

    // ticks 2..5 gated by steady-state cadence; tick 6 runs.
    now = 2000;
    for (let i = 0; i < 4; i++) await runner.tick();
    await runner.tick(); // tick 6 — first failure
    const after2 = runner.getChecks().github;
    expect(after2.lastSuccessAt).toBe(after1.lastSuccessAt); // preserved across failure
    expect(after2.lastFailureAt).not.toBeNull();

    // After a fail, the probe is in watch mode and runs every tick.
    now = 3000;
    await runner.tick(); // tick 7 — recovery to ok
    const after3 = runner.getChecks().github;
    expect(after3.lastFailureAt).toBe(after2.lastFailureAt); // preserved across recovery
    expect(after3.lastSuccessAt).not.toBe(after1.lastSuccessAt); // updated to latest ok
  });

  it("returns 'unknown' for any probe that was never run", async () => {
    const store = memoryStore();
    const runner = new HealthRunner({
      probes: [],
      store: store.port,
      logger: createLogger(),
      random: () => 0.5,
      nowMs: () => 1000,
    });
    const checks = runner.getChecks();
    expect(checks.github.status).toBe("unknown");
    expect(checks.linear.status).toBe("unknown");
    expect(checks.docker.status).toBe("unknown");
  });
});
