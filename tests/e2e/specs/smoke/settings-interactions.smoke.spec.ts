import { test, expect } from "../../fixtures/test";
import { ConfigPage } from "../../pages/config.page";

test.describe("Settings Interaction Smoke", () => {
  test.beforeEach(async ({ apiMock }) => {
    const scenario = apiMock.scenario().withSetupConfigured().build();
    await apiMock.install(scenario);
  });

  // ── Dev Tools: Raw JSON Config Editing ──────────────────────────────

  test("raw JSON mode: editing and saving sends PUT with correct payload", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToConfig();

    await page.getByRole("button", { name: "Raw JSON" }).click();
    const editor = page.locator(".config-textarea-large");
    await expect(editor).toBeVisible({ timeout: 5000 });

    const payload = '{"codex.model":"o4-mini","orchestrator.max_concurrent":5}';
    await editor.fill(payload);

    const putPromise = page.waitForRequest((req) => {
      return req.url().includes("/api/v1/config/overlay") && req.method() === "PUT";
    });

    await page.route("**/api/v1/config/overlay", (route) => {
      if (route.request().method() === "PUT") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            updated: ["codex.model", "orchestrator.max_concurrent"],
            overlay: { "codex.model": "o4-mini", "orchestrator.max_concurrent": 5 },
          }),
        });
      }
      return route.fallback();
    });

    await page.getByRole("button", { name: "Save Changes" }).click();

    const putRequest = await putPromise;
    const body = putRequest.postDataJSON() as Record<string, unknown>;
    expect(body).toHaveProperty("patch");

    const patch = body.patch as Record<string, unknown>;
    expect(patch["codex.model"]).toBe("o4-mini");
    expect(patch["orchestrator.max_concurrent"]).toBe(5);
  });

  test("raw JSON mode: invalid JSON does not send PUT request", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToConfig();

    await page.getByRole("button", { name: "Raw JSON" }).click();
    const editor = page.locator(".config-textarea-large");
    await expect(editor).toBeVisible({ timeout: 5000 });

    await editor.fill("{invalid json}");

    let putSent = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/config/overlay") && req.method() === "PUT") {
        putSent = true;
      }
    });

    // JSON.parse fails client-side, so no PUT should fire
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForTimeout(300);
    expect(putSent).toBe(false);
  });

  // ── Credentials: Add Credential ───────────────────────────────────

  test("add credential: accepting prompt dialogs sends POST with value", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSecrets();

    // Wait for credentials to load
    await expect(page.getByText("LINEAR_API_KEY").first()).toBeVisible({ timeout: 5000 });

    const postPromise = page.waitForRequest((req) => {
      return req.url().includes("/api/v1/secrets/MY_NEW_KEY") && req.method() === "POST";
    });

    // Set up prompt dialog handlers in order: first for key, second for value
    let promptCount = 0;
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "prompt") {
        promptCount++;
        if (promptCount === 1) {
          await dialog.accept("MY_NEW_KEY");
        } else {
          await dialog.accept("super-secret-value-123");
        }
      }
    });

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

    await settings.addCredentialButton.click();

    const postRequest = await postPromise;
    const body = postRequest.postDataJSON() as Record<string, unknown>;
    expect(body).toHaveProperty("value", "super-secret-value-123");
  });

  // ── Credentials: Delete Credential ─────────────────────────────────

  test("delete credential: confirming deletion sends DELETE request", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSecrets();

    await expect(page.getByText("LINEAR_API_KEY").first()).toBeVisible({ timeout: 5000 });

    const deletePromise = page.waitForRequest((req) => {
      return req.url().includes("/api/v1/secrets/LINEAR_API_KEY") && req.method() === "DELETE";
    });

    // Accept the confirm dialog for deletion
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "confirm") {
        await dialog.accept();
      }
    });

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

    // Click the delete button (×) on the LINEAR_API_KEY credential pill
    await settings.credentialDeleteButton("LINEAR_API_KEY").click();

    const deleteRequest = await deletePromise;
    expect(deleteRequest.method()).toBe("DELETE");
    expect(deleteRequest.url()).toContain("/api/v1/secrets/LINEAR_API_KEY");
  });

  // ── Credentials: Empty Key Validation ──────────────────────────────

  test("add credential: dismissing key prompt does not send POST", async ({ page }) => {
    const settings = new ConfigPage(page);
    await settings.navigateToSecrets();

    await expect(page.getByText("LINEAR_API_KEY").first()).toBeVisible({ timeout: 5000 });

    let postSent = false;
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/secrets/") && req.method() === "POST") {
        postSent = true;
      }
    });

    // Dismiss the key prompt (cancel) — should prevent POST
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "prompt") {
        await dialog.dismiss();
      }
    });

    await settings.addCredentialButton.click();
    await page.waitForTimeout(300);
    expect(postSent).toBe(false);
  });
});
