import { router } from "../router";
import { getRuntimeClient } from "../state/runtime-client";
import type { AppState } from "../state/store";
import type { RuntimeIssueView, WebhookHealth } from "../types/runtime.js";
import { createEventRow } from "../components/event-row";
import { createSystemHealthChecklist } from "../components/system-health-checklist";
import { createWebhookHealthPanel } from "../components/webhook-health-panel";
import { createStallEventsTable } from "../components/stall-events-table";
import { buildAttentionList, latestTerminalIssues } from "../utils/issues";
import {
  formatCompactNumber,
  formatCostUsd,
  formatDuration,
  formatElapsedMmSs,
  formatRateLimitHeadroom,
  formatRuntimeShort,
} from "../utils/format";
import { setTextWithDiff } from "../utils/diff";
import { registerPageCleanup } from "../utils/page";
import { createHeroBand, setRunningPulse, setSparklineSlot } from "./overview-hero.js";
import { readCollapsedSections, createCollapsibleSection } from "./overview-sections.js";
import { issueRow, finishedPeekRow, fillList } from "./overview-rows.js";
import { createLiveAttemptPanel } from "./overview-live-attempt.js";
import { createTabbedActivitySection } from "./overview-tabs.js";
import { isGettingStartedDismissed, createTeachingEmptyState, createGettingStartedCard } from "./overview-empty.js";

export function createOverviewPage(): HTMLElement {
  const runtimeClient = getRuntimeClient();
  const page = document.createElement("div");
  page.className = "page overview-page fade-in";

  const hero = createHeroBand();
  page.append(hero.band);

  // Getting started card (shown when dashboard is empty)
  const gettingStartedContainer = document.createElement("div");
  let gettingStartedEl: HTMLElement | null = null;

  function showGettingStarted(): void {
    if (gettingStartedEl || isGettingStartedDismissed()) return;
    gettingStartedEl = createGettingStartedCard(() => {
      gettingStartedEl?.remove();
      gettingStartedEl = null;
    });
    gettingStartedContainer.append(gettingStartedEl);
  }

  function hideGettingStarted(): void {
    if (gettingStartedEl) {
      gettingStartedEl.remove();
      gettingStartedEl = null;
    }
  }

  page.append(gettingStartedContainer);

  // Main 2-col grid: [attention zone + live attempt] left, [collapsible sidebar] right
  const mainGrid = document.createElement("section");
  mainGrid.className = "overview-main-grid";

  const leftStack = document.createElement("div");
  leftStack.className = "overview-left-stack";

  const attentionZone = document.createElement("article");
  attentionZone.className = "overview-attention-zone";

  const attentionHeader = document.createElement("header");
  attentionHeader.className = "overview-attention-header";
  const attentionTitle = document.createElement("h2");
  attentionTitle.className = "overview-section-title";
  attentionTitle.textContent = "Needs review";
  const attentionCount = document.createElement("span");
  attentionCount.className = "overview-attention-count";
  attentionCount.hidden = true;
  attentionHeader.append(attentionTitle, attentionCount);
  attentionZone.append(attentionHeader);

  const attentionList = document.createElement("div");
  attentionList.className = "overview-attention-list";
  attentionZone.append(attentionList);

  const liveAttempt = createLiveAttemptPanel();

  leftStack.append(attentionZone, liveAttempt.root);

  const secondary = document.createElement("aside");
  secondary.className = "overview-secondary";

  const collapsedSections = readCollapsedSections();

  const healthCollapsible = createCollapsibleSection("health", "System health", "Live", collapsedSections);
  healthCollapsible.section.classList.add("overview-health-section");
  const { root: healthChecklist, update: updateHealthChecklist } = createSystemHealthChecklist();
  const { root: webhookPanel, update: updateWebhookPanel } = createWebhookHealthPanel();
  healthCollapsible.body.append(healthChecklist, webhookPanel);
  secondary.append(healthCollapsible.section);

  const tokenCollapsible = createCollapsibleSection("tokens", "Session usage", "This session", collapsedSections);
  tokenCollapsible.section.classList.add("overview-token-section");

  const tokenGrid = document.createElement("div");
  tokenGrid.className = "overview-token-grid";

  const inputTokens = createTokenStat("Input tokens");
  const outputTokens = createTokenStat("Output tokens");
  const runtimeStat = createTokenStat("Runtime");
  const costSidebar = createTokenStat("Cost", { copperEmphasis: true });

  tokenGrid.append(inputTokens.root, outputTokens.root, runtimeStat.root, costSidebar.root);
  tokenCollapsible.body.append(tokenGrid);
  secondary.append(tokenCollapsible.section);

  const stallCollapsible = createCollapsibleSection("stalls", "Recovered stalls", "Recovery log", collapsedSections);
  stallCollapsible.section.classList.add("overview-stall-section");
  const { root: stallList, update: updateStallEvents } = createStallEventsTable();
  stallCollapsible.body.append(stallList);
  secondary.append(stallCollapsible.section);

  // Finished recently — compact peek list in the sidebar (full list lives
  // in the lower tabbed section).
  const finishedCollapsible = createCollapsibleSection("finished", "Finished recently", "", collapsedSections);
  finishedCollapsible.section.classList.add("overview-finished-section");
  const finishedList = document.createElement("div");
  finishedList.className = "overview-finished-peek";
  finishedCollapsible.body.append(finishedList);
  secondary.append(finishedCollapsible.section);

  mainGrid.append(leftStack, secondary);
  page.append(mainGrid);

  // Tabbed lower: Latest activity / Finished recently
  const tabbed = createTabbedActivitySection("activity");
  page.append(tabbed.root);

  const loadingSections = [
    attentionZone,
    tokenCollapsible.section,
    tabbed.root,
    healthCollapsible.section,
    stallCollapsible.section,
    finishedCollapsible.section,
  ];
  for (const section of loadingSections) {
    section.setAttribute("aria-busy", "true");
  }

  function updateCollapsibleSummaries(snapshot: NonNullable<AppState["snapshot"]>, terminalCount?: number): void {
    const healthStatus = snapshot.system_health ? snapshot.system_health.status : "healthy";
    healthCollapsible.summary.textContent = healthStatus;

    const totalCost = formatCostUsd(snapshot.codex_totals.cost_usd);
    const totalRuntime = formatDuration(snapshot.codex_totals.seconds_running);
    tokenCollapsible.summary.textContent =
      (snapshot.codex_totals.cost_usd ?? 0) > 0 ? `${totalCost} · ${totalRuntime}` : "no usage";

    const stallCount = snapshot.stall_events?.length ?? 0;
    stallCollapsible.summary.textContent =
      stallCount > 0 ? `${stallCount} event${stallCount === 1 ? "" : "s"}` : "none";

    void terminalCount;
  }

  function renderEmptyStates(): void {
    if (attentionList.childElementCount === 0) {
      attentionList.replaceChildren(
        createTeachingEmptyState(
          "All clear",
          "Blocked, retrying, or decision-ready work will appear here the moment it needs review.",
          "Open board",
          () => router.navigate("/queue"),
        ),
      );
    }

    if (tabbed.bodies.activity.childElementCount === 0) {
      tabbed.bodies.activity.replaceChildren(
        createTeachingEmptyState(
          "No activity yet",
          "Workflow events will stream in here once Risoluto starts processing work.",
        ),
      );
    }

    if (tabbed.bodies.finished.childElementCount === 0) {
      tabbed.bodies.finished.replaceChildren(
        createTeachingEmptyState(
          "No finished runs yet",
          "Completed and failed runs will appear here after the first issue finishes.",
        ),
      );
    }
  }

  function renderSnapshot(state: AppState): void {
    const snapshot = state.snapshot;
    if (!snapshot) {
      for (const section of loadingSections) {
        if (section.childElementCount <= 1) {
          const skeleton = document.createElement("div");
          skeleton.className = "overview-skeleton";
          section.append(skeleton);
        }
      }
      return;
    }

    for (const section of loadingSections) {
      section.setAttribute("aria-busy", "false");
    }

    setTextWithDiff(hero.countValues.running, String(snapshot.counts.running));
    setTextWithDiff(hero.countValues.queued, String((snapshot.queued ?? []).length));
    setTextWithDiff(
      hero.countValues.blocked,
      String(snapshot.workflow_columns?.find((c) => c.key === "blocked")?.count ?? 0),
    );
    setTextWithDiff(hero.countValues.done, String((snapshot.completed ?? []).length));
    setRunningPulse(hero.runningPulseSlot, snapshot.counts.running > 0);

    const costUsd = snapshot.codex_totals.cost_usd ?? null;
    setTextWithDiff(hero.cost.value, costUsd === null ? "—" : formatCostUsd(costUsd).replace("$", "$"));
    setTextWithDiff(hero.cost.runtime, formatDuration(snapshot.codex_totals.seconds_running));

    const successRate = computeSuccessRate(snapshot.completed ?? []);
    if (successRate === null) {
      hero.cost.successRate.hidden = true;
    } else {
      hero.cost.successRate.hidden = false;
      hero.cost.successRate.textContent = `${successRate}% success rate`;
    }

    // Sparklines hide automatically when fewer than 2 finite samples are present.
    const samples = snapshot.cost_samples ?? [];
    setSparklineSlot(
      hero.cost.sparklineSlot,
      samples.map((s) => s.cost_usd),
      { color: "var(--color-copper-400)", width: 80, height: 28, filled: true, label: "Session cost trend" },
    );
    setSparklineSlot(
      hero.headroom.sparklineSlot,
      samples.map((s) => s.headroom_pct),
      { color: "var(--text-accent)", width: 52, height: 20, label: "API headroom trend" },
    );

    setTextWithDiff(hero.headroom.value, formatRateLimitHeadroom(snapshot.rate_limits));

    setTextWithDiff(hero.pageKicker, "Updated just now · SSE connected");

    setTextWithDiff(inputTokens.value, formatCompactNumber(snapshot.codex_totals.input_tokens));
    setTextWithDiff(outputTokens.value, formatCompactNumber(snapshot.codex_totals.output_tokens));
    setTextWithDiff(runtimeStat.value, formatRuntimeShort(snapshot.codex_totals.seconds_running));
    setTextWithDiff(costSidebar.value, formatCostUsd(costUsd));

    const attentionIssues = buildAttentionList(snapshot.workflow_columns ?? []);
    attentionZone.classList.toggle("is-all-clear", attentionIssues.length === 0);
    if (attentionIssues.length === 0) {
      attentionCount.hidden = true;
      attentionCount.textContent = "";
    } else {
      attentionCount.hidden = false;
      setTextWithDiff(attentionCount, `${attentionIssues.length} waiting`);
    }
    fillList(
      attentionList,
      attentionIssues.map((issue) => issueRow(issue, "attention")),
    );

    const active = pickActiveIssue(snapshot);
    liveAttempt.update({
      active,
      events: snapshot.recent_events ?? [],
      elapsedLabel: active ? (formatElapsedMmSs(active.startedAt) ?? "—") : undefined,
    });

    const isEmpty =
      snapshot.counts.running === 0 &&
      snapshot.counts.retrying === 0 &&
      (snapshot.queued ?? []).length === 0 &&
      (snapshot.completed ?? []).length === 0 &&
      attentionIssues.length === 0;
    if (isEmpty) {
      showGettingStarted();
    } else {
      hideGettingStarted();
    }

    fillList(
      tabbed.bodies.activity,
      (snapshot.recent_events ?? []).slice(-12).map((event) => createEventRow(event, true)),
    );

    const terminalIssues = latestTerminalIssues(snapshot.completed ?? []);
    fillList(
      tabbed.bodies.finished,
      terminalIssues.slice(0, 12).map((issue) => issueRow(issue, "terminal")),
    );

    // Compact peek rows in the sidebar — full list lives in the lower tab.
    fillList(
      finishedList,
      terminalIssues.slice(0, 4).map((issue) => finishedPeekRow(issue)),
    );
    finishedCollapsible.summary.textContent = terminalIssues.length === 0 ? "none" : `${terminalIssues.length}`;

    updateHealthChecklist(snapshot);
    updateWebhookPanel(snapshot.webhook_health);
    updateStallEvents(snapshot.stall_events);

    updateCollapsibleSummaries(snapshot, terminalIssues.length);
    renderEmptyStates();
  }

  const onState = (state: AppState): void => renderSnapshot(state);
  const unsubscribeState = runtimeClient.subscribeState(onState);

  const unsubscribeWebhookHealth = runtimeClient.subscribeWebhookHealth((health) => {
    if (health && typeof health.status === "string") {
      updateWebhookPanel(health as WebhookHealth);
    }
  });
  const unsubscribeWebhookReceived = runtimeClient.subscribeWebhookReceived(() => {
    renderSnapshot(runtimeClient.getAppState());
  });

  renderSnapshot(runtimeClient.getAppState());
  registerPageCleanup(page, () => {
    unsubscribeState();
    unsubscribeWebhookHealth();
    unsubscribeWebhookReceived();
  });

  return page;
}

function createTokenStat(
  label: string,
  options: { copperEmphasis?: boolean } = {},
): { root: HTMLElement; value: HTMLElement } {
  const root = document.createElement("div");
  root.className = "overview-token-stat" + (options.copperEmphasis ? " is-copper" : "");
  const labelEl = document.createElement("span");
  labelEl.className = "overview-token-label";
  labelEl.textContent = label;
  const value = document.createElement("strong");
  value.className = "overview-token-value";
  value.textContent = "—";
  root.append(labelEl, value);
  return { root, value };
}

function pickActiveIssue(snapshot: NonNullable<AppState["snapshot"]>): RuntimeIssueView | null {
  const running = snapshot.running ?? [];
  const live = running.find((issue) => issue.status === "running" || issue.status === "retrying");
  if (live) return live;
  return running.length > 0 ? running[0] : null;
}

function computeSuccessRate(completed: ReadonlyArray<{ status: string }>): number | null {
  if (completed.length === 0) return null;
  const succeeded = completed.filter((issue) => issue.status === "completed" || issue.status === "closed").length;
  return Math.round((succeeded / completed.length) * 100);
}
