const STATE_GUIDE_SEEN_KEY = "risoluto-state-guide-seen";

interface StateGuideDefinition {
  name: string;
  stage: string;
  tagline: string;
  description: string;
}

const STATE_GUIDE_STATES: StateGuideDefinition[] = [
  {
    name: "Backlog",
    stage: "backlog",
    tagline: "parked work",
    description: "Backlog stays visible on the board, but agents do not treat it as ready to pick up yet.",
  },
  {
    name: "Todo",
    stage: "todo",
    tagline: "ready next",
    description: "Todo means the issue is eligible for the queue and can be selected for the next agent run.",
  },
  {
    name: "In Progress",
    stage: "in_progress",
    tagline: "active queue",
    description: "In Progress is active work Risoluto watches closely and may continue dispatching from.",
  },
  {
    name: "In Review",
    stage: "in_review",
    tagline: "human gate",
    description: "In Review is a checkpoint stage where work waits for approval or feedback before it can finish.",
  },
  {
    name: "Done",
    stage: "done",
    tagline: "terminal success",
    description: "Done is a terminal state that removes the issue from active work and records a successful outcome.",
  },
  {
    name: "Canceled",
    stage: "canceled",
    tagline: "terminal stop",
    description: "Canceled is a terminal state that stops further agent action and closes the issue out of the queue.",
  },
];

function hasSeenStateGuide(): boolean {
  return localStorage.getItem(STATE_GUIDE_SEEN_KEY) === "true";
}

function markStateGuideSeen(): void {
  localStorage.setItem(STATE_GUIDE_SEEN_KEY, "true");
}

function createStateRow(definition: StateGuideDefinition): HTMLElement {
  const row = document.createElement("div");
  row.className = "state-guide-row";
  row.dataset.stage = definition.stage;
  row.title = definition.description;

  const dot = document.createElement("span");
  dot.className = "state-guide-dot";
  dot.setAttribute("aria-hidden", "true");

  const name = document.createElement("span");
  name.className = "state-guide-name";
  name.textContent = definition.name;

  const tagline = document.createElement("span");
  tagline.className = "state-guide-tagline";
  tagline.textContent = definition.tagline;

  row.append(dot, name, tagline);
  return row;
}

export function createStateGuide(): { element: HTMLElement; show(): void; hide(): void } {
  const element = document.createElement("section");
  element.className = "state-guide";

  const panel = document.createElement("div");
  panel.className = "state-guide-panel";

  const header = document.createElement("div");
  header.className = "state-guide-header";

  const title = document.createElement("strong");
  title.className = "state-guide-title";
  title.textContent = "Workflow States";

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "mc-button is-ghost is-sm state-guide-dismiss";
  dismiss.textContent = "Got it";

  const intro = document.createElement("p");
  intro.className = "state-guide-intro";
  intro.textContent = "How your Linear states control agent behavior.";

  const rows = document.createElement("div");
  rows.className = "state-guide-rows";
  rows.append(...STATE_GUIDE_STATES.map(createStateRow));

  header.append(title, dismiss);
  panel.append(header, intro, rows);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "mc-button is-ghost is-sm state-guide-trigger";
  trigger.textContent = "?";
  trigger.title = "Show workflow states guide";
  trigger.setAttribute("aria-label", "Show workflow states guide");

  let collapseTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  function clearCollapseTimer(): void {
    if (collapseTimer === null) {
      return;
    }
    globalThis.clearTimeout(collapseTimer);
    collapseTimer = null;
  }

  function show(): void {
    clearCollapseTimer();
    element.classList.remove("is-collapsed");
    panel.hidden = false;
    panel.classList.remove("is-collapsing");
    trigger.hidden = true;
    trigger.setAttribute("aria-expanded", "true");
  }

  function hide(): void {
    clearCollapseTimer();
    markStateGuideSeen();
    panel.classList.add("is-collapsing");
    trigger.hidden = false;
    trigger.setAttribute("aria-expanded", "false");
    element.classList.add("is-collapsed");
    collapseTimer = globalThis.setTimeout(() => {
      panel.hidden = true;
      panel.classList.remove("is-collapsing");
      collapseTimer = null;
    }, 180);
  }

  dismiss.addEventListener("click", hide);
  trigger.addEventListener("click", show);

  element.append(panel, trigger);

  if (hasSeenStateGuide()) {
    panel.hidden = true;
    trigger.hidden = false;
    element.classList.add("is-collapsed");
    trigger.setAttribute("aria-expanded", "false");
  } else {
    trigger.hidden = true;
    trigger.setAttribute("aria-expanded", "true");
  }

  return { element, show, hide };
}
