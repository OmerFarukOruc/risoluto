import { test, expect } from "../../fixtures/test";
import { freezeClock } from "../../support/clock";
import { screenshotCss } from "../../support/screenshot-css";

test.describe("Settings Tabs Visual Regression", () => {
  test("settings general tab", async ({ page, apiMock }) => {
    await freezeClock(page);
    const scenario = apiMock.scenario().withSetupConfigured().build();
    await apiMock.install(scenario);

    await page.goto("/settings");
    await page.waitForSelector("#main-content", { state: "attached" });
    await page.waitForFunction(() => {
      const outlet = document.getElementById("main-content");
      return outlet && outlet.children.length > 0;
    });

    await page.waitForTimeout(1000);
    await page.addStyleTag({ content: screenshotCss });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("settings-general-tab.png", {
      fullPage: true,
    });
  });

  test("settings credentials tab", async ({ page, apiMock }) => {
    await freezeClock(page);
    const scenario = apiMock.scenario().withSetupConfigured().build();
    await apiMock.install(scenario);

    await page.goto("/settings#credentials");
    await page.waitForSelector("#main-content", { state: "attached" });
    await page.waitForFunction(() => {
      const outlet = document.getElementById("main-content");
      return outlet && outlet.children.length > 0;
    });

    await page.waitForTimeout(1000);
    await page.addStyleTag({ content: screenshotCss });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("settings-credentials-tab.png", {
      fullPage: true,
    });
  });

  test("settings devtools tab", async ({ page, apiMock }) => {
    await freezeClock(page);
    const scenario = apiMock.scenario().withSetupConfigured().build();
    await apiMock.install(scenario);

    await page.goto("/settings#devtools");
    await page.waitForSelector("#main-content", { state: "attached" });
    await page.waitForFunction(() => {
      const outlet = document.getElementById("main-content");
      return outlet && outlet.children.length > 0;
    });

    await page.waitForTimeout(1000);
    await page.addStyleTag({ content: screenshotCss });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("settings-devtools-tab.png", {
      fullPage: true,
    });
  });
});
