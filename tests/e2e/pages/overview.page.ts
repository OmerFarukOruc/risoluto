import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Page Object Model for the Overview ("/") page.
 */
export class OverviewPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.goto("/");
    await this.waitForPageContent();
  }

  // ── Metric Cards ─────────────────────────────────────────────────────

  /** The KPI strip across the top of the page. */
  get statusBar(): Locator {
    return this.page.locator(".overview-kpi-strip");
  }

  get runningCount(): Locator {
    return this.page.locator(".overview-kpi-tile[data-kpi='running']");
  }

  get queueCount(): Locator {
    return this.page.locator(".overview-kpi-tile[data-kpi='queued']");
  }

  // ── Attention Queue ──────────────────────────────────────────────────

  get attentionSection(): Locator {
    return this.page.getByRole("heading", { name: "Needs review" });
  }

  get issueCards(): Locator {
    return this.page.locator(".issue-card, .attention-card, [class*='issue-card']");
  }

  // ── Token Burn ───────────────────────────────────────────────────────

  get tokenBurnSection(): Locator {
    return this.page.getByRole("heading", { name: "Session usage" });
  }

  // ── Recent Events ────────────────────────────────────────────────────

  get recentEventsSection(): Locator {
    return this.page.getByText("Latest activity");
  }

  get eventRows(): Locator {
    return this.page.locator(".event-row, [class*='event-row']");
  }

  // ── System Health ────────────────────────────────────────────────────

  get systemHealthSection(): Locator {
    return this.page.getByText("System health");
  }

  // ── Quick Actions ────────────────────────────────────────────────────

  get quickActionsSection(): Locator {
    return this.page.getByText("QUICK ACTIONS");
  }

  // ── Webhook Health ──────────────────────────────────────────────────

  get webhookHealthPanel(): Locator {
    return this.page.locator("[data-testid='webhook-health-panel']");
  }

  get webhookStatus(): Locator {
    return this.page.locator("[data-testid='webhook-status']");
  }

  get webhookLastEvent(): Locator {
    return this.page.locator("[data-testid='webhook-last-event']");
  }

  get webhookInterval(): Locator {
    return this.page.locator("[data-testid='webhook-interval']");
  }

  get webhookDeliveries(): Locator {
    return this.page.locator("[data-testid='webhook-deliveries']");
  }
}
