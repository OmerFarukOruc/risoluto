import { afterEach, describe, expect, it, vi } from "vitest";

import { registerPageCleanup } from "../../frontend/src/utils/page";

class MockMutationObserver {
  static readonly instances: MockMutationObserver[] = [];

  constructor(private readonly callback: MutationCallback) {
    MockMutationObserver.instances.push(this);
  }

  disconnect(): void {}

  observe(): void {}

  trigger(): void {
    this.callback([], this as unknown as MutationObserver);
  }
}

describe("registerPageCleanup", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalMutationObserver = globalThis.MutationObserver;

  afterEach(() => {
    MockMutationObserver.instances.length = 0;
    vi.restoreAllMocks();
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.MutationObserver = originalMutationObserver;
  });

  it("runs cleanup when the root is detached from the document", async () => {
    const windowTarget = new EventTarget() as Window & typeof globalThis;
    windowTarget.setTimeout = globalThis.setTimeout.bind(globalThis);
    windowTarget.clearTimeout = globalThis.clearTimeout.bind(globalThis);
    globalThis.window = windowTarget;
    globalThis.document = { body: {} } as Document;
    globalThis.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;

    const cleanup = vi.fn();
    const root = { isConnected: true } as HTMLElement;

    registerPageCleanup(root, cleanup);
    root.isConnected = false;
    MockMutationObserver.instances[0]?.trigger();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
