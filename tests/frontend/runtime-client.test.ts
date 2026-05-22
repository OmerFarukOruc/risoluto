import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StateStore } from "../../frontend/src/state/store";
import { createRuntimeClient, type AgentEventPayload } from "../../frontend/src/state/runtime-client";
import { createSnapshot, installDomHarness } from "./helpers";

interface FakeEventSource {
  close: ReturnType<typeof vi.fn>;
  onopen: ((this: EventSource, ev: Event) => unknown) | null;
  onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null;
}

function createFakeEventSource(): FakeEventSource {
  return {
    close: vi.fn(),
    onopen: null,
    onmessage: null,
    onerror: null,
  };
}

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve = (_value: T): void => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function makePayload(overrides: Partial<AgentEventPayload> = {}): AgentEventPayload {
  return {
    issueId: "id-1",
    identifier: "ENG-1",
    type: "tool_use",
    message: "Running tests",
    sessionId: null,
    ...overrides,
  };
}

describe("RuntimeClient", () => {
  let dom: ReturnType<typeof installDomHarness> | null = null;
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    const harness = installDomHarness();
    dom = harness;
    restoreDom = () => harness.restore();
  });

  afterEach(() => {
    restoreDom?.();
    dom = null;
    restoreDom = null;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("starts one runtime boundary that polls state and reacts to lifecycle SSE events", async () => {
    const eventSource = createFakeEventSource();
    const eventSourceFactory = vi.fn(() => eventSource);
    const getState = vi
      .fn()
      .mockResolvedValueOnce(createSnapshot("2026-03-20T00:00:00.000Z"))
      .mockResolvedValueOnce(createSnapshot("2026-03-20T00:00:05.000Z"));
    const lifecycleHandler = vi.fn();
    const client = createRuntimeClient({
      api: { getState },
      buildReadTokenQueryParam: () => "read_token=read-secret",
      eventSourceFactory,
      store: new StateStore(),
    });

    const unsubscribe = client.subscribeIssueLifecycle("ENG-1", lifecycleHandler);
    client.start();
    await flushMicrotasks();

    expect(getState).toHaveBeenCalledTimes(1);
    expect(eventSourceFactory).toHaveBeenCalledWith("/api/v1/events?read_token=read-secret");

    eventSource.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "issue.started",
          payload: { identifier: "ENG-1" },
        }),
      }),
    );
    expect(lifecycleHandler).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_000);
    await flushMicrotasks();

    expect(getState).toHaveBeenCalledTimes(2);

    unsubscribe();
    client.stop();
  });

  it("skips state polling while the tab is hidden and refreshes when visible again", async () => {
    dom?.setHidden(true);

    const getState = vi.fn().mockResolvedValue(createSnapshot("2026-03-20T00:00:00.000Z"));
    const client = createRuntimeClient({
      api: { getState },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory: () => createFakeEventSource(),
      store: new StateStore(),
    });

    client.startPolling();

    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(getState).not.toHaveBeenCalled();

    dom?.setHidden(false);
    dom?.dispatchVisibilityChange();
    await flushMicrotasks();

    expect(getState).toHaveBeenCalledTimes(1);

    client.stop();
  });

  it("does not start a second state poll while the previous request is still running", async () => {
    const deferred = createDeferred<ReturnType<typeof createSnapshot>>();
    const getState = vi.fn().mockImplementation(() => deferred.promise);
    const client = createRuntimeClient({
      api: { getState },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory: () => createFakeEventSource(),
      store: new StateStore(),
    });

    client.startPolling();

    await flushMicrotasks();
    expect(getState).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(getState).toHaveBeenCalledTimes(1);

    deferred.resolve(createSnapshot("2026-03-20T00:00:00.000Z"));
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(getState).toHaveBeenCalledTimes(2);

    client.stop();
  });

  it("dismisses the stale banner through the runtime boundary", () => {
    const banner = {
      hidden: false,
      classList: {
        contains: vi.fn((value: string) => value === "is-visible"),
        remove: vi.fn(),
      },
    } as unknown as HTMLElement;
    vi.spyOn(dom!.document, "getElementById").mockReturnValue(banner);
    const client = createRuntimeClient({
      api: { getState: vi.fn().mockRejectedValue(new Error("offline")) },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory: () => createFakeEventSource(),
      store: new StateStore(),
    });

    client.dismissStaleBanner();

    expect(banner.hidden).toBe(true);
    expect(banner.classList.remove).toHaveBeenCalledWith("is-visible");
  });

  it("reconnects the SSE stream through the same runtime client after an error", async () => {
    const firstSource = createFakeEventSource();
    const secondSource = createFakeEventSource();
    const sources = [firstSource, secondSource];
    const eventSourceFactory = vi.fn((url: string) => {
      expect(url).toBe("/api/v1/events");
      const source = sources.shift();
      if (!source) {
        throw new Error("missing fake event source");
      }
      return source;
    });
    const client = createRuntimeClient({
      api: { getState: vi.fn().mockResolvedValue(createSnapshot("2026-03-20T00:00:00.000Z")) },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory,
      store: new StateStore(),
    });

    client.connectEventSource();
    expect(eventSourceFactory).toHaveBeenCalledTimes(1);

    firstSource.onerror?.(new Event("error"));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(eventSourceFactory).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(eventSourceFactory).toHaveBeenCalledTimes(2);

    client.stop();
  });

  it("appends the stored read token to the SSE URL", () => {
    const eventSource = createFakeEventSource();
    const eventSourceFactory = vi.fn(() => eventSource);
    const client = createRuntimeClient({
      api: { getState: vi.fn().mockResolvedValue(createSnapshot("2026-03-20T00:00:00.000Z")) },
      buildReadTokenQueryParam: () => "read_token=read-secret",
      eventSourceFactory,
      store: new StateStore(),
    });

    client.connectEventSource();

    expect(eventSourceFactory).toHaveBeenCalledWith("/api/v1/events?read_token=read-secret");

    client.stop();
  });

  it("subscribes to state updates and optional heartbeats through the runtime boundary", () => {
    const client = createRuntimeClient({
      api: { getState: vi.fn().mockResolvedValue(createSnapshot("2026-03-20T00:00:00.000Z")) },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory: () => createFakeEventSource(),
      store: new StateStore(),
    });
    const handler = vi.fn();

    const unsubscribe = client.subscribeState(handler, { includeHeartbeat: true });
    window.dispatchEvent(new CustomEvent("state:update", { detail: client.getAppState() }));
    window.dispatchEvent(new CustomEvent("state:heartbeat", { detail: client.getAppState() }));

    expect(handler).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("subscribes to agent events by issue identifier through the runtime boundary", () => {
    const client = createRuntimeClient({
      api: { getState: vi.fn().mockResolvedValue(createSnapshot("2026-03-20T00:00:00.000Z")) },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory: () => createFakeEventSource(),
      store: new StateStore(),
    });
    const handler = vi.fn();

    const unsubscribe = client.subscribeIssueEvents("ENG-1", handler);
    window.dispatchEvent(new CustomEvent("risoluto:agent-event", { detail: makePayload({ identifier: "ENG-1" }) }));
    window.dispatchEvent(new CustomEvent("risoluto:agent-event", { detail: makePayload({ identifier: "ENG-2" }) }));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(makePayload({ identifier: "ENG-1" }));

    unsubscribe();
    window.dispatchEvent(new CustomEvent("risoluto:agent-event", { detail: makePayload({ identifier: "ENG-1" }) }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("subscribes to filtered runtime events by issue identifier through the runtime boundary", () => {
    const client = createRuntimeClient({
      api: { getState: vi.fn().mockResolvedValue(createSnapshot("2026-03-20T00:00:00.000Z")) },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory: () => createFakeEventSource(),
      store: new StateStore(),
    });
    const handler = vi.fn();

    const unsubscribe = client.subscribeAllEvents("ENG-1", handler);
    window.dispatchEvent(
      new CustomEvent("risoluto:any-event", {
        detail: { type: "issue.started", payload: { identifier: "ENG-1", status: "running" } },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("risoluto:any-event", {
        detail: { type: "issue.started", payload: { identifier: "ENG-2", status: "running" } },
      }),
    );
    window.dispatchEvent(new CustomEvent("risoluto:any-event", { detail: { type: "issue.started" } }));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      type: "issue.started",
      payload: { identifier: "ENG-1", status: "running" },
    });

    unsubscribe();
  });

  it("subscribes to poll-complete notifications through the runtime boundary", () => {
    const client = createRuntimeClient({
      api: { getState: vi.fn().mockResolvedValue(createSnapshot("2026-03-20T00:00:00.000Z")) },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory: () => createFakeEventSource(),
      store: new StateStore(),
    });
    const handler = vi.fn();

    const unsubscribe = client.subscribePollComplete(handler);
    window.dispatchEvent(new CustomEvent("risoluto:poll-complete"));

    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("subscribes to webhook health and receipt notifications through the runtime boundary", () => {
    const client = createRuntimeClient({
      api: { getState: vi.fn().mockResolvedValue(createSnapshot("2026-03-20T00:00:00.000Z")) },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory: () => createFakeEventSource(),
      store: new StateStore(),
    });
    const healthHandler = vi.fn();
    const receiptHandler = vi.fn();

    const unsubscribeHealth = client.subscribeWebhookHealth(healthHandler);
    const unsubscribeReceipt = client.subscribeWebhookReceived(receiptHandler);

    window.dispatchEvent(
      new CustomEvent("risoluto:webhook-health-changed", {
        detail: { status: "healthy", connected: true },
      }),
    );
    window.dispatchEvent(new CustomEvent("risoluto:webhook-received"));

    expect(healthHandler).toHaveBeenCalledWith({ status: "healthy", connected: true });
    expect(receiptHandler).toHaveBeenCalledTimes(1);

    unsubscribeHealth();
    unsubscribeReceipt();
  });

  it("subscribes to notification updates through the runtime boundary", () => {
    const client = createRuntimeClient({
      api: { getState: vi.fn().mockResolvedValue(createSnapshot("2026-03-20T00:00:00.000Z")) },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory: () => createFakeEventSource(),
      store: new StateStore(),
    });
    const handler = vi.fn();

    const unsubscribe = client.subscribeNotificationUpdates(handler);
    window.dispatchEvent(new CustomEvent("risoluto:notification-created"));
    window.dispatchEvent(new CustomEvent("risoluto:notification-updated"));

    expect(handler).toHaveBeenCalledTimes(2);

    unsubscribe();
    window.dispatchEvent(new CustomEvent("risoluto:notification-created"));
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("subscribes to workspace events through the runtime boundary", () => {
    const client = createRuntimeClient({
      api: { getState: vi.fn().mockResolvedValue(createSnapshot("2026-03-20T00:00:00.000Z")) },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory: () => createFakeEventSource(),
      store: new StateStore(),
    });
    const handler = vi.fn();

    const unsubscribe = client.subscribeWorkspaceEvents(handler);
    window.dispatchEvent(new CustomEvent("risoluto:workspace-event"));

    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("subscribes to unfiltered runtime events through the runtime boundary", () => {
    const client = createRuntimeClient({
      api: { getState: vi.fn().mockResolvedValue(createSnapshot("2026-03-20T00:00:00.000Z")) },
      buildReadTokenQueryParam: () => "",
      eventSourceFactory: () => createFakeEventSource(),
      store: new StateStore(),
    });
    const handler = vi.fn();

    const unsubscribe = client.subscribeRuntimeEvents(handler);
    window.dispatchEvent(
      new CustomEvent("risoluto:any-event", {
        detail: { type: "codex.event", payload: { source: "worker" } },
      }),
    );

    expect(handler).toHaveBeenCalledWith({ type: "codex.event", payload: { source: "worker" } });

    unsubscribe();
  });
});
