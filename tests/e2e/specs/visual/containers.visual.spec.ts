import { expect, test } from "../../fixtures/test";
import { buildIssueView, buildRuntimeSnapshot } from "../../mocks/data/runtime-snapshot";
import { freezeClock } from "../../support/clock";
import { applyScreenshotStyles } from "../../support/screenshot-css";

test.describe("Containers Visual Regression", () => {
  test("containers page with active sandboxes", async ({ page, apiMock }) => {
    await freezeClock(page);
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

    await page.waitForTimeout(1000);
    await applyScreenshotStyles(page);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("containers-active.png", {
      fullPage: true,
    });
  });
});
