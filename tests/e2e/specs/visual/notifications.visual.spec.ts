import { expect, test } from "../../fixtures/test";
import { freezeClock } from "../../support/clock";
import { applyScreenshotStyles } from "../../support/screenshot-css";

test.describe("Notifications Visual Regression", () => {
  test("notifications inbox with unread and delivered alerts", async ({ page, apiMock }) => {
    await freezeClock(page);
    await apiMock.install({
      notifications: {
        notifications: [
          {
            id: "notif-1",
            type: "worker_failed",
            severity: "critical",
            title: "Worker failed",
            message: "ENG-1 crashed during review",
            source: "ENG-1",
            href: null,
            read: false,
            dedupeKey: "notif-1",
            metadata: { issueIdentifier: "ENG-1" },
            deliverySummary: {
              deliveredChannels: ["slack"],
              failedChannels: [],
              skippedDuplicate: false,
            },
            createdAt: "2026-04-04T09:00:00.000Z",
            updatedAt: "2026-04-04T09:00:00.000Z",
          },
          {
            id: "notif-2",
            type: "issue_completed",
            severity: "info",
            title: "Issue completed",
            message: "SYM-42 landed cleanly",
            source: "SYM-42",
            href: null,
            read: true,
            dedupeKey: "notif-2",
            metadata: { issueIdentifier: "SYM-42", attempt: 2 },
            deliverySummary: {
              deliveredChannels: ["slack", "webhook"],
              failedChannels: [],
              skippedDuplicate: false,
            },
            createdAt: "2026-04-04T08:40:00.000Z",
            updatedAt: "2026-04-04T08:40:00.000Z",
          },
        ],
        unreadCount: 1,
        totalCount: 2,
      },
    });

    await page.goto("/notifications");
    await page.waitForSelector("#main-content", { state: "attached" });
    await page.waitForFunction(() => document.body.textContent?.includes("Worker failed") === true);

    await page.waitForTimeout(1000);
    await applyScreenshotStyles(page);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("notifications-inbox.png", {
      fullPage: true,
    });
  });
});
