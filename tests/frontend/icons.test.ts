import { afterEach, describe, expect, it } from "vitest";

import { createIcon } from "../../frontend/src/ui/icons";

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();

  constructor(readonly tagName: string) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}

function installSvgDocument(): () => void {
  const previous = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElementNS: (_ns: string, tagName: string) => new FakeElement(tagName),
    },
  });
  return () => {
    if (previous === undefined) {
      Reflect.deleteProperty(globalThis, "document");
      return;
    }
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previous,
    });
  };
}

let restoreDocument = () => {};

afterEach(() => {
  restoreDocument();
  restoreDocument = () => {};
});

describe("createIcon", () => {
  it("renders the density icon used by the logs page", () => {
    restoreDocument = installSvgDocument();

    const icon = createIcon("dense");

    expect(icon.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(icon.children).toHaveLength(3);
  });

  it("falls back to a safe default icon for unknown runtime input", () => {
    restoreDocument = installSvgDocument();

    const icon = createIcon("missing" as never);

    expect(icon.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(icon.children.length).toBeGreaterThan(0);
  });
});
