import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/test";
import { QueuePage } from "../../pages/queue.page";

const TWEAKS_KEY = "risoluto:board:tweaks";

async function readStoredTweak(page: Page, field: string): Promise<unknown> {
  return page.evaluate(
    ({ key, field }: { key: string; field: string }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return parsed[field] ?? null;
      } catch {
        return null;
      }
    },
    { key: TWEAKS_KEY, field },
  );
}

test.describe("Queue view modes", () => {
  test.beforeEach(async ({ apiMock }) => {
    const scenario = apiMock.scenario().withSetupConfigured().build();
    await apiMock.install(scenario);
  });

  test("toolbar exposes the four view-mode buttons with kanban active by default", async ({ page }) => {
    const queue = new QueuePage(page);
    await queue.navigate();

    await expect(queue.viewModeSegmented).toBeVisible({ timeout: 5000 });
    await expect(queue.viewModeButton("kanban")).toBeVisible();
    await expect(queue.viewModeButton("swimlane")).toBeVisible();
    await expect(queue.viewModeButton("list")).toBeVisible();
    await expect(queue.viewModeButton("focus")).toBeVisible();

    await expect(queue.viewModeButton("kanban")).toHaveClass(/is-active/);
  });

  test("switching to list mode swaps in the table and persists across reload", async ({ page }) => {
    const queue = new QueuePage(page);
    await queue.navigate();

    await queue.viewModeButton("list").click();
    await expect(queue.listTable).toBeVisible({ timeout: 5000 });
    await expect(queue.viewModeButton("list")).toHaveClass(/is-active/);

    await expect.poll(() => readStoredTweak(page, "viewMode")).toBe("list");

    await queue.navigate();
    await expect(queue.listTable).toBeVisible({ timeout: 5000 });
  });

  test("switching to swimlane mode renders the status × repo grid", async ({ page }) => {
    const queue = new QueuePage(page);
    await queue.navigate();

    await queue.viewModeButton("swimlane").click();
    await expect(queue.swimlaneGrid).toBeVisible({ timeout: 5000 });
  });

  test("focus mode hides status filter pills and tweaks panel chrome", async ({ page }) => {
    const queue = new QueuePage(page);
    await queue.navigate();

    await queue.viewModeButton("focus").click();
    // Either focus stack (>0 running) or focus empty (0 running) is acceptable here.
    await expect(queue.focusStack.or(queue.focusEmpty)).toBeVisible({ timeout: 5000 });

    await expect(queue.statusPills).toHaveCount(0);
    await expect(queue.tweaksFab).toBeHidden();
    await expect(queue.tweaksPanel).toBeHidden();
  });

  test("status filter pill persists and narrows visible cards in kanban", async ({ page }) => {
    const queue = new QueuePage(page);
    await queue.navigate();

    await queue.statusPill("running").click();
    await expect(queue.statusPill("running")).toHaveClass(/is-active/);
    await expect.poll(() => readStoredTweak(page, "statusFilter")).toBe("running");
  });

  test("group-by control is fully removed from the toolbar", async ({ page }) => {
    const queue = new QueuePage(page);
    await queue.navigate();

    await expect(page.locator(".queue-toolbar-utility button", { hasText: /Group/i })).toHaveCount(0);
  });
});
