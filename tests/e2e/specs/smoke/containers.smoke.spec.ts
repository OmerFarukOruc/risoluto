import { expect, test } from "../../fixtures/test";
import { AppShellPage } from "../../pages/app-shell.page";
import { buildIssueView, buildRuntimeSnapshot } from "../../mocks/data/runtime-snapshot";

test.describe("Containers Smoke", () => {
  test.beforeEach(async ({ page, apiMock }) => {
    const retryingIssue = buildIssueView({
      issueId: "issue-004",
      identifier: "SYM-44",
      title: "Recover flaky migration run",
      status: "retrying",
      state: "In Review",
      attempt: 3,
      updatedAt: "2026-01-15T11:58:00.000Z",
      workspaceKey: "ws-004",
      branchName: "sym-44-retry",
    });

    await apiMock.install({
      runtimeSnapshot: buildRuntimeSnapshot({
        counts: { running: 1, retrying: 1 },
        retrying: [retryingIssue],
      }),
    });

    await page.goto("/containers");
    await page.waitForSelector("#main-content", { state: "attached" });
    await page.waitForFunction(() => document.body.textContent?.includes("Active sandboxes") === true);
  });

  test("shows running and retrying sandbox state", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Active sandboxes" })).toBeVisible();
    await expect(page.locator(".containers-card-identifier", { hasText: "SYM-42" })).toBeVisible();
    await expect(page.locator(".containers-card-identifier", { hasText: "SYM-44" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Logs" }).first()).toBeVisible();
  });

  test("marks the containers sidebar item active", async ({ page }) => {
    const shell = new AppShellPage(page);
    await expect(shell.sidebarItemByPath("/containers")).toHaveClass(/is-active/);
  });
});
