type TabId = "activity" | "finished";

interface TabbedSection {
  root: HTMLElement;
  body: HTMLElement;
  bodies: Record<TabId, HTMLElement>;
  setActiveTab: (id: TabId) => void;
}

const TAB_LABEL: Record<TabId, string> = {
  activity: "Latest activity",
  finished: "Finished recently",
};

/**
 * Lower-grid tabbed panel: Latest activity / Finished recently.
 *
 * The two body containers are kept mounted so callers can fill them once
 * per snapshot tick without worrying about render order; the inactive body
 * is hidden via the `hidden` attribute. Active tab gets a copper underline
 * (the project's brand accent on the data spine).
 */
export function createTabbedActivitySection(initialTab: TabId = "activity"): TabbedSection {
  const root = document.createElement("section");
  root.className = "overview-tabbed";

  const tablist = document.createElement("div");
  tablist.className = "overview-tabbed-tablist";
  tablist.setAttribute("role", "tablist");

  const body = document.createElement("div");
  body.className = "overview-tabbed-body";

  const tabButtons: Record<TabId, HTMLButtonElement> = {
    activity: createTabButton("activity"),
    finished: createTabButton("finished"),
  };
  const bodies: Record<TabId, HTMLElement> = {
    activity: createTabPanel("activity"),
    finished: createTabPanel("finished"),
  };

  let active: TabId = initialTab;

  function setActiveTab(id: TabId): void {
    active = id;
    for (const tabId of Object.keys(tabButtons) as TabId[]) {
      const button = tabButtons[tabId];
      const panel = bodies[tabId];
      const isActive = tabId === id;
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
      button.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    }
  }

  for (const id of Object.keys(tabButtons) as TabId[]) {
    const button = tabButtons[id];
    button.addEventListener("click", () => setActiveTab(id));
    tablist.append(button);
    body.append(bodies[id]);
  }

  setActiveTab(active);

  root.append(tablist, body);
  return { root, body, bodies, setActiveTab };
}

function createTabButton(id: TabId): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "overview-tabbed-tab";
  button.dataset.tab = id;
  button.setAttribute("role", "tab");
  button.id = `overview-tab-${id}`;
  button.setAttribute("aria-controls", `overview-tabpanel-${id}`);
  button.textContent = TAB_LABEL[id];
  return button;
}

function createTabPanel(id: TabId): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "overview-tabbed-panel";
  panel.id = `overview-tabpanel-${id}`;
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", `overview-tab-${id}`);
  return panel;
}
