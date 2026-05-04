import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Page Object Model for the Settings page and its legacy URL aliases.
 *
 * The settings page uses a two-column layout: `.settings-page-nav` on the left
 * and a scrollable `.settings-page-pane-body` on the right. Navigation items
 * use `.settings-page-nav-item` with `aria-current="true"` for the active item.
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
    await this.goto("/settings#overlay");
    await this.waitForPageContent();
    await this.overlaySection.waitFor({ state: "attached" });
  }

  async navigateToSecrets(): Promise<void> {
    await this.goto("/settings#credentials");
    await this.waitForPageContent();
    await this.credentialsSection.waitFor({ state: "attached" });
  }

  // ── Rail Navigation ─────────────────────────────────────────────────

  get settingsRail(): Locator {
    return this.page.locator(".settings-page-nav");
  }

  get railNavItems(): Locator {
    return this.page.locator(".settings-page-nav-item");
  }

  railNavItemByTitle(title: string): Locator {
    return this.page.locator(".settings-page-nav-item").filter({ hasText: title });
  }

  // ── Sections ────────────────────────────────────────────────────────

  get credentialsSection(): Locator {
    return this.page.locator("#section-credentials");
  }

  get overlaySection(): Locator {
    return this.page.locator("#section-overlay");
  }

  get agentSection(): Locator {
    return this.page.locator("#section-agent");
  }

  // ── Credentials ─────────────────────────────────────────────────────

  get credentialPills(): Locator {
    return this.page.locator(".settings-list-row");
  }

  get addCredentialButton(): Locator {
    return this.page.getByRole("button", { name: /add secret/i });
  }

  credentialByKey(key: string): Locator {
    return this.page.locator(".settings-list-row").filter({ hasText: key });
  }

  credentialDeleteButton(key: string): Locator {
    return this.credentialByKey(key).locator("button");
  }
}
