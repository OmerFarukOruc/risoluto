import { test, expect } from "../../fixtures/test";
import { ConfigPage } from "../../pages/config.page";

test.describe("Settings Slack Test Button Smoke", () => {
  test.beforeEach(async ({ apiMock }) => {
    const scenario = apiMock.scenario().withSetupConfigured().build();
    await apiMock.install(scenario);
  });

  test("Send test button surfaces success toast when backend returns 200", async ({ page }) => {
    const settings = new ConfigPage(page);

    await page.route("**/api/v1/notifications/test", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, sentAt: "2026-04-04T16:00:00.000Z" }),
        });
      }
      return route.fallback();
    });

    await settings.goto("/settings#notifications");
    await settings.waitForPageContent();

    const notificationsSection = page.locator("#settings-notifications");
    await expect(notificationsSection).toBeVisible();

    const sendTestButton = notificationsSection.getByRole("button", { name: /send test/i });
    await expect(sendTestButton).toBeVisible();

    const testRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/v1/notifications/test") && req.method() === "POST",
    );
    await sendTestButton.click();
    await testRequestPromise;

    const toastContainer = page.locator(".toast-container .toast-success");
    await expect(toastContainer).toBeVisible({ timeout: 5000 });
    await expect(toastContainer).toContainText(/slack test sent/i);
  });

  test("Send test button surfaces error toast when backend returns 400", async ({ page }) => {
    const settings = new ConfigPage(page);

    await page.route("**/api/v1/notifications/test", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "slack_not_configured",
              message: "Save a Slack webhook URL first, then try again.",
            },
          }),
        });
      }
      return route.fallback();
    });

    await settings.goto("/settings#notifications");
    await settings.waitForPageContent();

    const notificationsSection = page.locator("#settings-notifications");
    const sendTestButton = notificationsSection.getByRole("button", { name: /send test/i });
    await sendTestButton.click();

    const errorToast = page.locator(".toast-container .toast-error");
    await expect(errorToast).toBeVisible({ timeout: 5000 });
    await expect(errorToast).toContainText(/save a slack webhook url first/i);
  });
});
