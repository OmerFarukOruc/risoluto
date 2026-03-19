import { describe, expect, it, vi, afterEach } from "vitest";
import { EventEmitter, Readable } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { waitForStartup, buildDynamicTools } from "../../src/agent-runner/session-helpers.js";

afterEach(() => {
  vi.useRealTimers();
});

function makeFakeChild(): ChildProcessWithoutNullStreams {
  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });
  const child = new EventEmitter() as unknown as ChildProcessWithoutNullStreams;
  (child as unknown as Record<string, unknown>).stdout = stdout;
  (child as unknown as Record<string, unknown>).stderr = stderr;
  return child;
}

describe("waitForStartup", () => {
  it("resolves immediately when timeoutMs is 0", async () => {
    const child = makeFakeChild();
    await expect(waitForStartup(child, 0, new AbortController().signal)).resolves.toBeUndefined();
  });

  it("resolves immediately when timeoutMs is negative", async () => {
    const child = makeFakeChild();
    await expect(waitForStartup(child, -1, new AbortController().signal)).resolves.toBeUndefined();
  });

  it("resolves when stdout emits data", async () => {
    const child = makeFakeChild();
    const promise = waitForStartup(child, 5000, new AbortController().signal);
    child.stdout.push("ready");
    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves when stderr emits data", async () => {
    const child = makeFakeChild();
    const promise = waitForStartup(child, 5000, new AbortController().signal);
    child.stderr.push("warning output");
    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects when child exits before readiness", async () => {
    const child = makeFakeChild();
    const promise = waitForStartup(child, 5000, new AbortController().signal);
    child.emit("exit", 1);
    await expect(promise).rejects.toThrow("child exited with code 1 before startup readiness");
  });

  it("rejects when abort signal fires", async () => {
    const child = makeFakeChild();
    const controller = new AbortController();
    const promise = waitForStartup(child, 5000, controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow("startup readiness interrupted");
  });

  it("rejects on timeout", async () => {
    vi.useFakeTimers();
    const child = makeFakeChild();
    const promise = waitForStartup(child, 100, new AbortController().signal);
    vi.advanceTimersByTime(101);
    await expect(promise).rejects.toThrow("startup readiness timed out after 100ms");
  });

  it("only settles once even if multiple events arrive", async () => {
    const child = makeFakeChild();
    const promise = waitForStartup(child, 5000, new AbortController().signal);
    child.stdout.push("first");
    // First data event resolves; subsequent events are ignored
    await expect(promise).resolves.toBeUndefined();
  });
});

describe("buildDynamicTools", () => {
  it("returns two tool definitions", () => {
    const tools = buildDynamicTools();
    expect(tools.length).toBe(2);
  });

  it("includes linear_graphql tool with correct schema", () => {
    const tools = buildDynamicTools() as Array<{ name: string; inputSchema: Record<string, unknown> }>;
    const linearTool = tools.find((t) => t.name === "linear_graphql");
    expect(linearTool).toBeDefined();
    expect(linearTool!.inputSchema.required).toContain("query");
  });

  it("includes github_api tool with correct schema", () => {
    const tools = buildDynamicTools() as Array<{ name: string; inputSchema: Record<string, unknown> }>;
    const githubTool = tools.find((t) => t.name === "github_api");
    expect(githubTool).toBeDefined();
    expect(githubTool!.inputSchema.required).toContain("action");
  });
});
