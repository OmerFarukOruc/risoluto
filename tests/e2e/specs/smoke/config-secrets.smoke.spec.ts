import { test, expect } from "../../fixtures/test";
import { ConfigPage } from "../../pages/config.page";

test.describe("Unified Settings Smoke", () => {
  test.beforeEach(async ({ apiMock }) => {
    const scenario = apiMock.scenario().withSetupConfigured().build();
    await apiMock.install(scenario);
  });

  test("settings page loads the General tab by default", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSettings();

    await expect(settings.tabButton("General")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("h1, .page-title").first()).toContainText("Settings");
  });

  test("configure nav is consolidated to a single Settings entry", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSettings();

    await expect(page.locator('.sidebar-item[data-path="/settings"]')).toBeVisible();
    await expect(page.locator('.sidebar-item[data-path="/config"]')).toHaveCount(0);
    await expect(page.locator('.sidebar-item[data-path="/secrets"]')).toHaveCount(0);
  });

  // ── Advanced Tab / Legacy Config Alias ─────────────────────────────

  test("legacy /config route redirects to Settings → Advanced", async ({ page }) => {
    const config = new ConfigPage(page);
    await config.navigateToConfig();

    expect(new URL(page.url()).pathname).toBe("/settings");
    expect(new URL(page.url()).hash).toBe("#advanced");
    await expect(config.tabButton("Advanced")).toHaveAttribute("aria-selected", "true");
  });

  test("advanced tab shows overlay entries", async ({ page }) => {
    const config = new ConfigPage(page);
    await config.navigateToConfig();

    await expect(page.getByText("codex.model").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("orchestrator.max_concurrent").first()).toBeVisible({ timeout: 5000 });
  });

  test("advanced tab shows config editor mode buttons", async ({ page }) => {
    const config = new ConfigPage(page);
    await config.navigateToConfig();

    await expect(page.locator(".config-mode-label").first()).toBeVisible({ timeout: 5000 });
  });

  test("advanced tab preserves unsaved raw edits across tab switches", async ({ page }) => {
    const config = new ConfigPage(page);
    await config.navigateToConfig();

    await page.getByRole("button", { name: "Raw JSON" }).click();
    const editor = page.locator(".config-textarea-large");
    await editor.fill('{"draft":"keep-me"}');

    await config.tabButton("Credentials").click();
    await config.tabButton("Advanced").click();

    await expect(editor).toHaveValue('{"draft":"keep-me"}');
  });

  // ── Credentials Tab / Legacy Secrets Alias ────────────────────────

  test("legacy /secrets route redirects to Settings → Credentials", async ({ page }) => {
    const config = new ConfigPage(page);
    await config.navigateToSecrets();

    expect(new URL(page.url()).pathname).toBe("/settings");
    expect(new URL(page.url()).hash).toBe("#credentials");
    await expect(config.tabButton("Credentials")).toHaveAttribute("aria-selected", "true");
  });

  test("credentials tab shows secret information", async ({ page }) => {
    const config = new ConfigPage(page);
    await config.navigateToSecrets();

    await expect(page.getByText(/LINEAR_API_KEY/).first()).toBeVisible({ timeout: 5000 });
  });

  test("credentials tab has new secret button", async ({ page }) => {
    const config = new ConfigPage(page);
    await config.navigateToSecrets();

    await expect(page.getByText("New secret")).toBeVisible({ timeout: 5000 });
  });

  test("global keyboard aliases open Advanced and Credentials tabs", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#main-content", { state: "attached" });
    await page.waitForFunction(() => {
      const outlet = document.getElementById("main-content");
      return outlet && outlet.children.length > 0;
    });

    await page.keyboard.press("g");
    await page.keyboard.press("c");
    await expect(page.getByRole("tab", { name: "Advanced" })).toHaveAttribute("aria-selected", "true");
    expect(new URL(page.url()).pathname).toBe("/settings");
    expect(new URL(page.url()).hash).toBe("#advanced");

    await page.keyboard.press("g");
    await page.keyboard.press("s");
    await expect(page.getByRole("tab", { name: "Credentials" })).toHaveAttribute("aria-selected", "true");
    expect(new URL(page.url()).hash).toBe("#credentials");
  });
});
