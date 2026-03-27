import { test, expect } from "../../fixtures/test";
import { buildIssueDrilldownScenario } from "../../mocks/scenarios/issue-drilldown";

async function waitForOutlet(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForSelector("#main-content", { state: "attached" });
  await page.waitForFunction(() => {
    const outlet = document.getElementById("main-content");
    return outlet !== null && outlet.children.length > 0;
  });
}

test.describe("Sidebar contextual issue nav", () => {
  test.beforeEach(async ({ apiMock }) => {
    await apiMock.install(buildIssueDrilldownScenario());
  });

  test("contextual group appears on issue detail with correct label and items", async ({ page }) => {
    await page.goto("/issues/SYM-42");
    await waitForOutlet(page);

    const group = page.locator(".sidebar-group--contextual");
    await expect(group).toBeVisible({ timeout: 5000 });
    await expect(group.locator(".sidebar-group-label")).toHaveText("SYM-42");
    await expect(group.getByRole("button", { name: "Detail" })).toBeVisible();
    await expect(group.getByRole("button", { name: "Logs" })).toBeVisible();
    await expect(group.getByRole("button", { name: "Runs" })).toBeVisible();
  });

  test("Detail item is active on issue detail page, Logs is not", async ({ page }) => {
    await page.goto("/issues/SYM-42");
    await waitForOutlet(page);

    const detailBtn = page.locator(".sidebar-group--contextual").getByRole("button", { name: "Detail" });
    const logsBtn = page.locator(".sidebar-group--contextual").getByRole("button", { name: "Logs" });

    await expect(detailBtn).toHaveClass(/is-active/, { timeout: 5000 });
    await expect(logsBtn).not.toHaveClass(/is-active/);
  });

  test("active item updates when navigating to logs sub-page", async ({ page }) => {
    await page.goto("/issues/SYM-42/logs");
    await waitForOutlet(page);

    const detailBtn = page.locator(".sidebar-group--contextual").getByRole("button", { name: "Detail" });
    const logsBtn = page.locator(".sidebar-group--contextual").getByRole("button", { name: "Logs" });

    await expect(logsBtn).toHaveClass(/is-active/, { timeout: 5000 });
    await expect(detailBtn).not.toHaveClass(/is-active/);
  });

  test("active item updates when navigating to runs sub-page", async ({ page }) => {
    await page.goto("/issues/SYM-42/runs");
    await waitForOutlet(page);

    const runsBtn = page.locator(".sidebar-group--contextual").getByRole("button", { name: "Runs" });
    const detailBtn = page.locator(".sidebar-group--contextual").getByRole("button", { name: "Detail" });

    await expect(runsBtn).toHaveClass(/is-active/, { timeout: 5000 });
    await expect(detailBtn).not.toHaveClass(/is-active/);
  });

  test("contextual group disappears when navigating away from issue", async ({ page }) => {
    await page.goto("/issues/SYM-42");
    await waitForOutlet(page);
    await expect(page.locator(".sidebar-group--contextual")).toBeVisible({ timeout: 5000 });

    await page.goto("/queue");
    await waitForOutlet(page);

    await expect(page.locator(".sidebar-group--contextual")).not.toBeVisible();
  });

  test("contextual group label updates when switching to a different issue", async ({ page }) => {
    await page.goto("/issues/SYM-42");
    await waitForOutlet(page);
    await expect(page.locator(".sidebar-group--contextual .sidebar-group-label")).toHaveText("SYM-42", {
      timeout: 5000,
    });

    await page.goto("/issues/SYM-43");
    await waitForOutlet(page);

    await expect(page.locator(".sidebar-group--contextual .sidebar-group-label")).toHaveText("SYM-43", {
      timeout: 5000,
    });
  });
});
