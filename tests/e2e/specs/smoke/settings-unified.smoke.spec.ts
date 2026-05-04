import { test, expect } from "../../fixtures/test";
import { ConfigPage } from "../../pages/config.page";

/**
 * Settings v2 page: page load, nav rail, section rendering, and a11y.
 * Credential tests live in config-secrets.smoke.spec.ts.
 * Overlay/raw-JSON tests live in settings-interactions.smoke.spec.ts.
 */
test.describe("Settings v2 Smoke", () => {
  test.beforeEach(async ({ apiMock }) => {
    const scenario = apiMock.scenario().withSetupConfigured().build();
    await apiMock.install(scenario);
  });

  // ── Page Load ──────────────────────────────────────────────────────

  test("settings page loads and displays Settings heading", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSettings();

    await expect(page.locator("h1, .page-title").first()).toContainText("Settings");
  });

  test("settings page renders sidebar rail with navigation items", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSettings();

    await expect(settings.settingsRail).toBeVisible({ timeout: 5000 });

    const navItems = settings.railNavItems;
    const count = await navItems.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  // ── Rail Section Content ──────────────────────────────────────────

  test("first nav item is active by default and shows Agent section", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSettings();

    const firstNavItem = settings.railNavItems.first();
    await expect(firstNavItem).toHaveAttribute("aria-current", "true", { timeout: 5000 });
    await expect(page.getByRole("heading", { name: "Agent", level: 2 }).first()).toBeVisible({ timeout: 5000 });
  });

  test("settings page renders section title elements", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSettings();

    const sectionTitles = page.locator(".settings-section-title");
    await expect(sectionTitles.first()).toBeVisible({ timeout: 5000 });

    const count = await sectionTitles.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("clicking a nav item swaps to the corresponding section", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSettings();

    await settings.railNavItemByTitle("Templates").click();
    await expect(page.locator("#section-templates")).toBeVisible({ timeout: 5000 });
  });

  // ── Accessibility ──────────────────────────────────────────────────

  test("rail navigation items are keyboard-focusable", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSettings();

    const firstNavItem = settings.railNavItems.first();
    await expect(firstNavItem).toBeVisible({ timeout: 5000 });
    await firstNavItem.focus();
    await expect(firstNavItem).toBeFocused();
  });
});
