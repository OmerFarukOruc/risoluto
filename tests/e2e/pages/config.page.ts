import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Page Object Model for the unified Settings page and its legacy aliases.
 *
 * The settings page uses a scroll-synced sidebar rail with `.settings-nav-item`
 * buttons instead of tabs. Sections are rendered as cards in a scrollable area.
 */
export class ConfigPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToSettings(): Promise<void> {
    await this.goto("/settings");
    await this.waitForPageContent();
  }

  async navigateToConfig(): Promise<void> {
    await this.goto("/settings#devtools");
    await this.waitForPageContent();
    await this.devToolsSection.waitFor({ state: "attached" });
    // Wait for the details element to open (triggered by hash navigation)
    await this.page.waitForFunction(() => {
      const details = document.querySelector<HTMLDetailsElement>(".settings-devtools-section");
      return details?.open === true;
    });
  }

  async navigateToSecrets(): Promise<void> {
    await this.goto("/settings#credentials");
    await this.waitForPageContent();
    // Wait for the credentials section card to be visible
    await this.credentialsSection.waitFor({ state: "attached" });
  }

  // ── Rail Navigation ─────────────────────────────────────────────────

  get settingsRail(): Locator {
    return this.page.locator(".settings-rail");
  }

  get railNavItems(): Locator {
    return this.page.locator(".settings-nav-item");
  }

  railNavItemByTitle(title: string): Locator {
    return this.page.locator(".settings-nav-item").filter({ hasText: title });
  }

  // ── Sections ────────────────────────────────────────────────────────

  get credentialsSection(): Locator {
    return this.page.locator("#settings-credentials");
  }

  get devToolsSection(): Locator {
    return this.page.locator(".settings-devtools-section");
  }

  // ── Config View ──────────────────────────────────────────────────────

  get configTable(): Locator {
    return this.page.locator("table, .config-table, [class*='config']").first();
  }

  get configRows(): Locator {
    return this.page.locator("tr, .config-row, [class*='config-row']");
  }

  get overlaySection(): Locator {
    return this.page.locator("[class*='overlay'], [class*='override']").first();
  }

  // ── Credentials ─────────────────────────────────────────────────────

  get credentialPills(): Locator {
    return this.page.locator(".settings-credential-pill");
  }

  get addCredentialButton(): Locator {
    return this.page.getByRole("button", { name: /add credential/i });
  }

  credentialByKey(key: string): Locator {
    return this.page.locator(".settings-credential-pill").filter({ hasText: key });
  }

  credentialDeleteButton(key: string): Locator {
    return this.credentialByKey(key).locator(".settings-credential-delete");
  }

  // ── Legacy Aliases (kept for backward compat) ───────────────────────

  get secretsList(): Locator {
    return this.page.locator(".settings-credential-list, .secrets-list, table, [class*='secret']").first();
  }

  get secretRows(): Locator {
    return this.page
      .locator(".settings-credential-pill, .secret-row, tr")
      .filter({ has: this.page.locator("span, td, .secret-key") });
  }

  get addSecretButton(): Locator {
    return this.addCredentialButton;
  }

  secretByKey(key: string): Locator {
    return this.credentialByKey(key);
  }
}
