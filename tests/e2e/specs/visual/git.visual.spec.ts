import { expect, test } from "../../fixtures/test";
import { buildGitContext } from "../../mocks/data/git-context";
import { buildMergedPrRecord, buildPrRecord } from "../../mocks/data/pr";
import { freezeClock } from "../../support/clock";
import { applyScreenshotStyles } from "../../support/screenshot-css";

test.describe("Git Visual Regression", () => {
  test("git context with tracked PR lifecycle", async ({ page, apiMock }) => {
    await freezeClock(page);
    await apiMock.install({
      gitContext: buildGitContext(),
      prRecords: [
        buildPrRecord(),
        buildMergedPrRecord({
          number: 43,
          issueId: "issue-merged",
          url: "https://github.com/owner/repo/pull/43",
          branchName: "sym-41-cleanup",
          mergeCommitSha: "fedcba654321",
        }),
      ],
    });

    await page.goto("/git");
    await page.waitForSelector("#main-content", { state: "attached" });
    await page.waitForFunction(() => document.body.textContent?.includes("Tracked PR lifecycle") === true);

    await page.waitForTimeout(1000);
    await applyScreenshotStyles(page);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("git-lifecycle.png", {
      fullPage: true,
    });
  });
});
