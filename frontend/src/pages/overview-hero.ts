import { router } from "../router";
import { createSparkline } from "../components/sparkline";
import { createPulseRing } from "../components/pulse-ring";

export interface HeroBand {
  band: HTMLElement;
  /** Page header strip — shown above the KPI strip. */
  pageHeader: HTMLElement;
  /** Plain-language sub-line under the page title (mono kicker). */
  pageKicker: HTMLElement;
  /** Action-button row, right-aligned in the page header. */
  actionRow: HTMLElement;
  /** Per-tile setters keyed by KPI id. */
  countValues: Record<KpiId, HTMLElement>;
  /** Pulse ring slot rendered inside the running tile. */
  runningPulseSlot: HTMLElement;
  /** Cost hero refs — value, USD label, sparkline slot, runtime tail. */
  cost: {
    value: HTMLElement;
    sparklineSlot: HTMLElement;
    runtime: HTMLElement;
    successRate: HTMLElement;
  };
  /** Headroom tile refs. */
  headroom: {
    value: HTMLElement;
    sparklineSlot: HTMLElement;
  };
}

type KpiId = "running" | "queued" | "blocked" | "done";

interface CountTileSpec {
  id: KpiId;
  label: string;
  filterRoute: string;
  /** CSS variable name to colour the value. */
  colorVar: string;
}

const COUNT_TILES: CountTileSpec[] = [
  { id: "running", label: "Running", filterRoute: "/queue?filter=running", colorVar: "var(--status-running)" },
  { id: "queued", label: "Queued", filterRoute: "/queue?filter=queued", colorVar: "var(--status-queued)" },
  { id: "blocked", label: "Blocked", filterRoute: "/queue?filter=blocked", colorVar: "var(--status-blocked)" },
  { id: "done", label: "Done", filterRoute: "/queue?filter=done", colorVar: "var(--status-completed)" },
];

/**
 * Hero band — page header + KPI strip with copper cost hero.
 *
 * Layout: 4 count tiles | divider | cost hero (largest, copper, sparkline) |
 * headroom tile. Cost is the most visually weighted number on the page;
 * everything else recedes around it. Sparklines are populated separately
 * by the page so the band can stay agnostic to the data source.
 */
export function createHeroBand(): HeroBand {
  const band = document.createElement("section");
  band.className = "overview-hero-band";

  const pageHeader = document.createElement("header");
  pageHeader.className = "overview-page-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "overview-page-title-group";

  const pageTitle = document.createElement("h1");
  pageTitle.className = "overview-page-title";
  pageTitle.textContent = "Overview";

  const pageKicker = document.createElement("p");
  pageKicker.className = "overview-page-kicker";

  titleGroup.append(pageTitle, pageKicker);

  const actionRow = document.createElement("div");
  actionRow.className = "overview-page-actions";

  pageHeader.append(titleGroup, actionRow);

  const strip = document.createElement("div");
  strip.className = "overview-kpi-strip";

  // ---- Count tiles ----
  const countValues = {} as Record<KpiId, HTMLElement>;
  const runningPulseSlot = document.createElement("span");
  runningPulseSlot.className = "overview-kpi-pulse";
  runningPulseSlot.setAttribute("aria-hidden", "true");

  for (const spec of COUNT_TILES) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "overview-kpi-tile";
    tile.dataset.kpi = spec.id;
    tile.setAttribute("aria-label", `${spec.label} — open filtered queue`);
    tile.addEventListener("click", () => router.navigate(spec.filterRoute));

    const label = document.createElement("span");
    label.className = "overview-kpi-label";
    label.textContent = spec.label;

    const valueWrap = document.createElement("span");
    valueWrap.className = "overview-kpi-valuewrap";

    const value = document.createElement("strong");
    value.className = "overview-kpi-value";
    value.style.setProperty("--kpi-color", spec.colorVar);
    value.textContent = "—";

    valueWrap.append(value);
    if (spec.id === "running") {
      valueWrap.append(runningPulseSlot);
    }

    tile.append(label, valueWrap);
    strip.append(tile);
    countValues[spec.id] = value;
  }

  // ---- Divider ----
  const divider = document.createElement("span");
  divider.className = "overview-kpi-divider";
  divider.setAttribute("aria-hidden", "true");
  strip.append(divider);

  // ---- Cost hero ----
  const costTile = document.createElement("article");
  costTile.className = "overview-kpi-cost";

  const costHead = document.createElement("div");
  costHead.className = "overview-kpi-cost-head";

  const costLabel = document.createElement("span");
  costLabel.className = "overview-kpi-cost-label";
  costLabel.textContent = "Session cost";

  const costMeter = document.createElement("span");
  costMeter.className = "overview-kpi-cost-meter";
  costMeter.textContent = "accumulating";

  costHead.append(costLabel, costMeter);

  const costMain = document.createElement("div");
  costMain.className = "overview-kpi-cost-main";

  const costValueGroup = document.createElement("div");
  costValueGroup.className = "overview-kpi-cost-valuegroup";

  const costValue = document.createElement("strong");
  costValue.className = "overview-kpi-cost-value";
  costValue.textContent = "—";

  const costUsd = document.createElement("span");
  costUsd.className = "overview-kpi-cost-usd";
  costUsd.textContent = "USD";

  costValueGroup.append(costValue, costUsd);

  const costSparklineSlot = document.createElement("span");
  costSparklineSlot.className = "overview-kpi-cost-sparkline";
  costSparklineSlot.setAttribute("aria-hidden", "true");

  costMain.append(costValueGroup, costSparklineSlot);

  const costFootRow = document.createElement("div");
  costFootRow.className = "overview-kpi-cost-foot";

  const runtime = document.createElement("span");
  runtime.className = "overview-kpi-cost-runtime";
  runtime.textContent = "—";

  const successRate = document.createElement("span");
  successRate.className = "overview-kpi-cost-success";
  successRate.hidden = true;

  costFootRow.append(runtime, successRate);

  costTile.append(costHead, costMain, costFootRow);
  strip.append(costTile);

  // ---- Headroom tile ----
  const headroomTile = document.createElement("article");
  headroomTile.className = "overview-kpi-headroom";

  const headroomLabel = document.createElement("span");
  headroomLabel.className = "overview-kpi-label";
  headroomLabel.textContent = "API headroom";

  const headroomMain = document.createElement("div");
  headroomMain.className = "overview-kpi-headroom-main";

  const headroomValue = document.createElement("strong");
  headroomValue.className = "overview-kpi-headroom-value";
  headroomValue.textContent = "—";

  const headroomSparklineSlot = document.createElement("span");
  headroomSparklineSlot.className = "overview-kpi-headroom-sparkline";
  headroomSparklineSlot.setAttribute("aria-hidden", "true");

  headroomMain.append(headroomValue, headroomSparklineSlot);

  const headroomFoot = document.createElement("span");
  headroomFoot.className = "overview-kpi-headroom-foot";
  headroomFoot.textContent = "rate limit";

  headroomTile.append(headroomLabel, headroomMain, headroomFoot);
  strip.append(headroomTile);

  band.append(pageHeader, strip);

  return {
    band,
    pageHeader,
    pageKicker,
    actionRow,
    countValues,
    runningPulseSlot,
    cost: { value: costValue, sparklineSlot: costSparklineSlot, runtime, successRate },
    headroom: { value: headroomValue, sparklineSlot: headroomSparklineSlot },
  };
}

/**
 * Renders a sparkline into the slot. Skips DOM mutation when the data is
 * unchanged from the previous render — SSE pushes arrive every few seconds
 * and the underlying samples only change ~once per minute, so most calls
 * land on the same data.
 */
export function setSparklineSlot(
  slot: HTMLElement,
  data: ReadonlyArray<number | null>,
  options: { color: string; width: number; height: number; filled?: boolean; label?: string },
): void {
  const fingerprint = `${options.color}|${options.width}|${options.height}|${data.join(",")}`;
  if (slot.dataset.sparklineFp === fingerprint) return;
  slot.dataset.sparklineFp = fingerprint;
  const svg = createSparkline({ data, ...options });
  slot.replaceChildren();
  if (svg) slot.append(svg);
}

/** Clears or sets the running pulse ring atom on the running tile. */
export function setRunningPulse(slot: HTMLElement, isLive: boolean): void {
  // Re-creating the pulse on every tick restarts the keyframes animation —
  // skip the DOM write when the live flag matches the existing element.
  const wasLive = slot.childElementCount > 0;
  if (wasLive === isLive) return;
  slot.replaceChildren();
  if (isLive) slot.append(createPulseRing({ color: "var(--status-running)", size: 6 }));
}
