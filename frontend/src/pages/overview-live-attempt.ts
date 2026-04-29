import { router } from "../router";
import type { RecentEvent, RuntimeIssueView } from "../types/runtime.js";
import { createEventRow } from "../components/event-row";
import { createPulseRing } from "../components/pulse-ring";

const MAX_LIVE_LINES = 5;

interface LiveAttemptPanel {
  root: HTMLElement;
  update: (input: LiveAttemptInput) => void;
}

interface LiveAttemptInput {
  active: RuntimeIssueView | null;
  events: ReadonlyArray<RecentEvent>;
  /** Elapsed seconds since the active attempt started — formatted by the caller. */
  elapsedLabel?: string;
}

/**
 * Live preview of the active running attempt. Mirrors the prototype's
 * panel anatomy: outer header (pulse + status + ID chip), inner LIVE
 * OUTPUT sub-bar with attempt + elapsed, mono log lines, and an action
 * footer (Stop / Retry / Copy ID). When no active issue is selected the
 * panel collapses to a static empty state so vertical space stays stable.
 */
export function createLiveAttemptPanel(): LiveAttemptPanel {
  const root = document.createElement("article");
  root.className = "overview-live-attempt";

  // ── Outer header ────────────────────────────────────────────────
  const header = document.createElement("header");
  header.className = "overview-live-attempt-header";

  const pulseSlot = document.createElement("span");
  pulseSlot.className = "overview-live-attempt-pulse";
  pulseSlot.setAttribute("aria-hidden", "true");

  const heading = document.createElement("h2");
  heading.className = "overview-live-attempt-title";

  const idLink = document.createElement("button");
  idLink.type = "button";
  idLink.className = "overview-live-attempt-id";
  idLink.hidden = true;

  header.append(pulseSlot, heading, idLink);

  // ── Inner LIVE OUTPUT sub-bar ───────────────────────────────────
  const subbar = document.createElement("div");
  subbar.className = "overview-live-attempt-subbar";

  const subbarPulse = document.createElement("span");
  subbarPulse.className = "overview-live-attempt-subpulse";
  subbarPulse.setAttribute("aria-hidden", "true");

  const subbarLabel = document.createElement("span");
  subbarLabel.className = "overview-live-attempt-sublabel";
  subbarLabel.textContent = "LIVE OUTPUT";

  const subbarIdChip = document.createElement("span");
  subbarIdChip.className = "overview-live-attempt-subchip is-id";

  const subbarAttemptChip = document.createElement("span");
  subbarAttemptChip.className = "overview-live-attempt-subchip";

  const subbarElapsedChip = document.createElement("span");
  subbarElapsedChip.className = "overview-live-attempt-subchip overview-live-attempt-subchip--mono";

  subbar.append(subbarPulse, subbarLabel, subbarIdChip, subbarAttemptChip, subbarElapsedChip);

  // ── Body (mono log lines) ───────────────────────────────────────
  const body = document.createElement("div");
  body.className = "overview-live-attempt-body";
  body.setAttribute("role", "log");
  body.setAttribute("aria-label", "Live attempt activity");

  // ── Action footer ───────────────────────────────────────────────
  const footer = document.createElement("footer");
  footer.className = "overview-live-attempt-footer";

  const stopButton = document.createElement("button");
  stopButton.type = "button";
  stopButton.className = "mc-button is-danger is-sm overview-live-attempt-action";
  stopButton.textContent = "Stop";
  stopButton.hidden = true;

  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.className = "mc-button is-ghost is-sm overview-live-attempt-action";
  retryButton.textContent = "Retry";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "mc-button is-ghost is-sm overview-live-attempt-action";
  copyButton.textContent = "Copy ID";

  footer.append(stopButton, retryButton, copyButton);

  root.append(header, subbar, body, footer);

  function update(input: LiveAttemptInput): void {
    const { active } = input;
    pulseSlot.replaceChildren();
    subbarPulse.replaceChildren();
    idLink.replaceChildren();
    body.replaceChildren();

    if (!active) {
      heading.textContent = "No active issue";
      idLink.hidden = true;
      subbar.hidden = true;
      footer.hidden = true;
      body.append(emptyState("Awaiting first claim. Live agent output will appear here."));
      return;
    }

    const isLive = active.status === "running" || active.status === "retrying";
    if (isLive) {
      pulseSlot.append(createPulseRing({ color: "var(--status-running)", size: 7 }));
      subbarPulse.append(createPulseRing({ color: "var(--status-running)", size: 5 }));
    }

    heading.textContent = isLive ? "Live attempt" : "Latest attempt";

    idLink.hidden = false;
    idLink.textContent = active.identifier;
    idLink.title = active.title;
    idLink.onclick = () => router.navigate(`/queue/${active.identifier}`);

    subbar.hidden = false;
    subbarLabel.textContent = isLive ? "LIVE OUTPUT" : "LAST OUTPUT";
    subbarIdChip.textContent = active.identifier;
    subbarAttemptChip.textContent = `attempt ${active.attempt ?? 1}`;
    subbarElapsedChip.textContent = input.elapsedLabel ?? "—";

    footer.hidden = false;
    stopButton.hidden = !isLive;
    stopButton.onclick = () => router.navigate(`/queue/${active.identifier}?action=stop`);
    retryButton.onclick = () => router.navigate(`/queue/${active.identifier}?action=retry`);
    copyButton.onclick = () => {
      void navigator.clipboard?.writeText(active.identifier);
    };

    const filtered = input.events
      .filter((event) => event.issue_identifier === active.identifier)
      .slice(-MAX_LIVE_LINES);

    if (filtered.length === 0) {
      body.append(emptyState("Awaiting first event from this attempt…"));
      return;
    }

    for (const event of filtered) {
      body.append(createEventRow(event, true));
    }
  }

  return { root, update };
}

function emptyState(text: string): HTMLElement {
  const node = document.createElement("p");
  node.className = "overview-live-attempt-empty";
  node.textContent = text;
  return node;
}
