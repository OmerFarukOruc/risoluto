import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Page Object Model for the Queue ("/queue") page.
 */
export class QueuePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.goto("/queue");
    await this.waitForPageContent();
  }

  // ── Kanban Board ─────────────────────────────────────────────────────

  get board(): Locator {
    return this.page.locator(".kanban-board, .queue-board, [class*='kanban'], [class*='board']").first();
  }

  get columns(): Locator {
    return this.page.locator("section.kanban-column, section.queue-column");
  }

  columnByLabel(label: string): Locator {
    return this.columns.filter({ hasText: label });
  }

  // ── Issue Cards ──────────────────────────────────────────────────────

  get issueCards(): Locator {
    return this.page.locator("button.kanban-card, button.issue-card");
  }

  issueCardByIdentifier(identifier: string): Locator {
    return this.issueCards.filter({ hasText: identifier });
  }

  async clickIssue(identifier: string): Promise<void> {
    await this.issueCardByIdentifier(identifier).click();
    // Wait for the SPA to navigate to the issue detail
    await this.page.waitForFunction(
      (id: string) => window.location.pathname.includes(id) || window.location.pathname.includes("issues"),
      identifier,
      { timeout: 5000 },
    );
  }

  async shiftClickIssue(identifier: string): Promise<void> {
    await this.issueCardByIdentifier(identifier).click({ modifiers: ["Shift"] });
  }

  // ── Column Counts ────────────────────────────────────────────────────

  async getColumnCount(label: string): Promise<number> {
    const column = this.columnByLabel(label);
    const cards = column.locator(".kanban-card, .issue-card, [class*='kanban-card']");
    return cards.count();
  }

  // ── Toolbar (redesign) ───────────────────────────────────────────────

  get search(): Locator {
    return this.page.locator(".queue-toolbar-search input.mc-input");
  }

  get priorityFilterButton(): Locator {
    return this.page.locator(".queue-toolbar-filters button", { hasText: "Priority" });
  }

  get modelFilterButton(): Locator {
    return this.page.locator(".queue-toolbar-filters button", { hasText: "Model" });
  }

  get repoFilterButton(): Locator {
    return this.page.locator(".queue-toolbar-filters button", { hasText: "Repo" });
  }

  get labelsFilterButton(): Locator {
    return this.page.locator(".queue-toolbar-filters button", { hasText: "Labels" });
  }

  get groupByButton(): Locator {
    return this.page.locator(".queue-toolbar-utility button", { hasText: "Group" });
  }

  get newIssueAnchor(): Locator {
    return this.page.locator("a.queue-toolbar-newissue");
  }

  get popover(): Locator {
    return this.page.locator(".mc-popover");
  }

  get filterChips(): Locator {
    return this.page.locator(".mc-filter-chip");
  }

  // ── Tweaks panel ─────────────────────────────────────────────────────

  get tweaksFab(): Locator {
    return this.page.locator(".mc-tweaks-fab");
  }

  get tweaksPanel(): Locator {
    return this.page.locator(".mc-tweaks");
  }

  tweaksRow(label: string): Locator {
    return this.tweaksPanel.locator(".mc-tweak-row").filter({ hasText: label });
  }

  // ── Bulk action toolbar ──────────────────────────────────────────────

  get bulkToolbar(): Locator {
    return this.page.locator(".mc-bulk");
  }

  bulkAction(label: string): Locator {
    return this.bulkToolbar.locator(".mc-bulk-action", { hasText: label });
  }
}
