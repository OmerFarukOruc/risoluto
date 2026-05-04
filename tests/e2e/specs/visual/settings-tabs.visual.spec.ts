import { test, expect } from "../../fixtures/test";
import { ConfigPage } from "../../pages/config.page";
import { freezeClock } from "../../support/clock";
import { applyScreenshotStyles } from "../../support/screenshot-css";

test.describe("Settings Tabs Visual Regression", () => {
  test("settings credentials tab", async ({ page, apiMock }) => {
    await freezeClock(page);
    const scenario = apiMock.scenario().withSetupConfigured().build();
    await apiMock.install(scenario);

    const config = new ConfigPage(page);
    await config.navigateToSecrets();

    await expect(config.credentialsSection).toBeVisible();
    await expect(page.getByText("LINEAR_API_KEY").first()).toBeVisible();
    await expect(config.addCredentialButton).toBeVisible();
    await applyScreenshotStyles(page);
    await page.waitForTimeout(100);

    await expect(config.credentialsSection).toHaveScreenshot("settings-credentials-tab.png");
  });

  test("settings overlay tab", async ({ page, apiMock }) => {
    await freezeClock(page);
    const scenario = apiMock.scenario().withSetupConfigured().build();
    await apiMock.install(scenario);

    const config = new ConfigPage(page);
    await config.navigateToConfig();
    await expect(config.overlaySection).toBeVisible();

    await page.waitForTimeout(500);
    await applyScreenshotStyles(page);
    await page.waitForTimeout(200);

    await expect(config.overlaySection).toHaveScreenshot("settings-overlay-tab.png");
  });
});
