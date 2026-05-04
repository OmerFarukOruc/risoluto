import { test, expect } from "../../fixtures/test";
import { ConfigPage } from "../../pages/config.page";

test.describe("Settings Interaction Smoke", () => {
  test.beforeEach(async ({ apiMock }) => {
    const scenario = apiMock.scenario().withSetupConfigured().build();
    await apiMock.install(scenario);
  });

  // ── Overlay Editor ────────────────────────────────────────────────

  test("overlay editor: editing and saving sends PUT with correct payload", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToConfig();

    const editor = page.locator(".settings-overlay-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });

    const payload = JSON.stringify({ codex: { model: "o4-mini" } });
    await editor.fill(payload);

    await page.route("**/api/v1/config/overlay", (route) => {
      if (route.request().method() === "PUT") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ updated: ["codex.model"], overlay: { codex: { model: "o4-mini" } } }),
        });
      }
      return route.fallback();
    });

    const putPromise = page.waitForRequest((req) => {
      return req.url().includes("/api/v1/config/overlay") && req.method() === "PUT";
    });

    await page.getByRole("button", { name: "Apply overlay" }).click();

    const putRequest = await putPromise;
    const body = putRequest.postDataJSON() as Record<string, unknown>;
    const codex = body.codex as Record<string, unknown>;
    expect(codex.model).toBe("o4-mini");
  });

  test("overlay editor: invalid JSON does not send PUT request", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToConfig();

    const editor = page.locator(".settings-overlay-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });

    await editor.fill("{invalid json}");

    let putSent = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/config/overlay") && req.method() === "PUT") {
        putSent = true;
      }
    });

    await page.getByRole("button", { name: "Apply overlay" }).click();
    await page.waitForTimeout(300);
    expect(putSent).toBe(false);
  });

  // ── Credentials: Add Credential (inline form, no modal) ───────────

  test("add credential: inline form sends POST with value", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSecrets();

    await expect(page.getByText("LINEAR_API_KEY").first()).toBeVisible({ timeout: 5000 });

    await page.getByLabel("Secret key").fill("MY_NEW_KEY");
    await page.getByLabel("Secret value").fill("super-secret-value-123");

    await page.route("**/api/v1/secrets/MY_NEW_KEY", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ key: "MY_NEW_KEY" }),
        });
      }
      return route.fallback();
    });

    const postPromise = page.waitForRequest((req) => {
      return req.url().includes("/api/v1/secrets/MY_NEW_KEY") && req.method() === "POST";
    });

    await settings.addCredentialButton.click();

    const postRequest = await postPromise;
    const body = postRequest.postDataJSON() as Record<string, unknown>;
    expect(body).toHaveProperty("value", "super-secret-value-123");
  });

  // ── Credentials: Delete Credential (direct, no modal) ─────────────

  test("delete credential: clicking delete button sends DELETE request", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSecrets();

    await expect(page.getByText("LINEAR_API_KEY").first()).toBeVisible({ timeout: 5000 });

    await page.route("**/api/v1/secrets/LINEAR_API_KEY", (route) => {
      if (route.request().method() === "DELETE") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ deleted: true }),
        });
      }
      return route.fallback();
    });

    const deletePromise = page.waitForRequest((req) => {
      return req.url().includes("/api/v1/secrets/LINEAR_API_KEY") && req.method() === "DELETE";
    });

    await settings.credentialDeleteButton("LINEAR_API_KEY").click();

    const deleteRequest = await deletePromise;
    expect(deleteRequest.method()).toBe("DELETE");
    expect(deleteRequest.url()).toContain("/api/v1/secrets/LINEAR_API_KEY");
  });

  // ── Credentials: Clear form after add ─────────────────────────────

  test("add credential: empty key does not send POST", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSecrets();

    await expect(page.getByText("LINEAR_API_KEY").first()).toBeVisible({ timeout: 5000 });

    let postSent = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/secrets/") && req.method() === "POST") {
        postSent = true;
      }
    });

    // Leave key empty, fill only value, click add
    await page.getByLabel("Secret value").fill("some-value");
    await settings.addCredentialButton.click();

    await page.waitForTimeout(300);
    expect(postSent).toBe(false);
  });
});
