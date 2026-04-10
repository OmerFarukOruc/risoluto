import { expect, test } from "../../fixtures/test";
import { buildIssueDrilldownScenario } from "../../mocks/scenarios/issue-drilldown";
import { freezeClock } from "../../support/clock";
import { applyScreenshotStyles } from "../../support/screenshot-css";

test.describe("Logs Visual Regression", () => {
  test("logs page with live issue activity", async ({ page, apiMock }) => {
    await freezeClock(page);
    await apiMock.install(buildIssueDrilldownScenario());

    await page.goto("/issues/SYM-42/logs");
    await page.waitForSelector("#main-content", { state: "attached" });
    await page.waitForFunction(() => document.body.textContent?.includes("Agent started attempt #2") === true);

    await page.waitForTimeout(1000);
    await applyScreenshotStyles(page);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("logs-live.png", {
      fullPage: true,
    });
  });
});
