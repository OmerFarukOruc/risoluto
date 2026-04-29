import { describe, expect, it } from "vitest";

import {
  createFilters,
  hasActiveFilters,
  isDefaultFilters,
  modelInitials,
  repoOf,
  retryCountOf,
} from "../../frontend/src/pages/queue-state";

describe("isDefaultFilters", () => {
  it("returns true for fresh filters", () => {
    expect(isDefaultFilters(createFilters())).toBe(true);
  });

  it("returns false when search has text", () => {
    const filters = createFilters();
    filters.search = "auth";
    expect(isDefaultFilters(filters)).toBe(false);
  });

  it("returns false when priority is not all", () => {
    const filters = createFilters();
    filters.priority = "urgent";
    expect(isDefaultFilters(filters)).toBe(false);
  });

  it("returns false when model is not all", () => {
    const filters = createFilters();
    filters.model = "claude-opus-4-7";
    expect(isDefaultFilters(filters)).toBe(false);
  });

  it("returns false when repo is not all", () => {
    const filters = createFilters();
    filters.repo = "risoluto-web";
    expect(isDefaultFilters(filters)).toBe(false);
  });

  it("returns false when any label is selected", () => {
    const filters = createFilters();
    filters.labels.add("bug");
    expect(isDefaultFilters(filters)).toBe(false);
  });
});

describe("hasActiveFilters", () => {
  it("returns false for fresh filters", () => {
    expect(hasActiveFilters(createFilters())).toBe(false);
  });

  it("returns true when search has text", () => {
    const filters = createFilters();
    filters.search = "auth";
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("returns true when priority is not all", () => {
    const filters = createFilters();
    filters.priority = "high";
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("returns true when model is not all", () => {
    const filters = createFilters();
    filters.model = "claude-sonnet-4-6";
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("returns true when any label is selected", () => {
    const filters = createFilters();
    filters.labels.add("ux");
    expect(hasActiveFilters(filters)).toBe(true);
  });
});

describe("repoOf", () => {
  it("uses an explicit repositoryName field when present", () => {
    expect(repoOf({ repositoryName: "risoluto-web" } as never)).toBe("risoluto-web");
  });

  it("uses an explicit repo field when present", () => {
    expect(repoOf({ repo: "agents-runtime" } as never)).toBe("agents-runtime");
  });

  it("does not derive pseudo-repos from workspace keys", () => {
    expect(repoOf({ workspaceKey: "MT-42", identifier: "MT-42" } as never)).toBeNull();
    expect(repoOf({ workspaceKey: "risoluto-web-RSL-412", identifier: "RSL-412" } as never)).toBeNull();
  });

  it("returns null when no real repo field is present", () => {
    expect(repoOf({ workspaceKey: null, identifier: "RSL-1" } as never)).toBeNull();
  });
});

describe("retryCountOf", () => {
  it("treats the first attempt as zero retries", () => {
    expect(retryCountOf({ attempt: 1 } as never)).toBe(0);
  });

  it("counts attempts beyond the first as retries", () => {
    expect(retryCountOf({ attempt: 3 } as never)).toBe(2);
  });

  it("treats null attempts as zero retries", () => {
    expect(retryCountOf({ attempt: null } as never)).toBe(0);
  });
});

describe("modelInitials", () => {
  it("recognizes the Anthropic family", () => {
    expect(modelInitials("claude-opus-4-7")).toBe("OP");
    expect(modelInitials("claude-sonnet-4-6")).toBe("SO");
    expect(modelInitials("claude-haiku-4-5-20251001")).toBe("HK");
  });

  it("returns dotted placeholder for nullish models", () => {
    expect(modelInitials(null)).toBe("··");
  });

  it("derives a two-letter label from arbitrary model ids", () => {
    expect(modelInitials("gpt-4o-mini")).toBe("GP");
    expect(modelInitials("custom-model")).toBe("CU");
  });
});
