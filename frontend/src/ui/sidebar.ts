import { router } from "../router";
import { createIcon, createIconSlot } from "./icons";
import { navGroups, navItems } from "./nav-items";

const STORAGE_KEY = "symphony-sidebar-expanded";

let _navHandler: (() => void) | null = null;

function readExpandedPref(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

function saveExpandedPref(expanded: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(expanded));
}

function updateActiveState(sidebarEl: HTMLElement): void {
  const current = window.location.pathname;
  for (const item of sidebarEl.querySelectorAll<HTMLElement>(".sidebar-item")) {
    const path = item.dataset.path ?? "";
    const active = current === path || (path !== "/" && current.startsWith(`${path}/`));
    item.classList.toggle("is-active", active);
  }
}

function buildNavItems(groupEl: HTMLElement, groupName: string): void {
  const items = navItems.filter((item) => item.group === groupName);

  // Create items container for animation
  const itemsContainer = document.createElement("div");
  itemsContainer.className = "sidebar-group-items";

  const itemsInner = document.createElement("div");
  itemsInner.className = "sidebar-group-items-inner";

  for (const item of items) {
    const button = document.createElement("button");
    button.className = "sidebar-item transition-base";
    button.type = "button";
    button.dataset.path = item.path;
    button.title = `${item.name} (${item.hotkey.replace(" ", " then ")})`;

    const labelSpan = document.createElement("span");
    labelSpan.className = "sidebar-item-label";
    labelSpan.textContent = item.name;

    const hotkeySpan = document.createElement("span");
    hotkeySpan.className = "sidebar-hotkey";
    hotkeySpan.textContent = item.hotkey;

    const tooltipSpan = document.createElement("span");
    tooltipSpan.className = "sidebar-item-tooltip";
    tooltipSpan.textContent = item.name;

    button.append(
      createIconSlot(item.icon, { slotClassName: "sidebar-icon", size: 18 }),
      labelSpan,
      hotkeySpan,
      tooltipSpan,
    );
    button.addEventListener("click", () => router.navigate(item.path));
    itemsInner.append(button);
  }

  itemsContainer.append(itemsInner);
  groupEl.append(itemsContainer);
}

function buildGroupHeader(groupName: string, groupEl: HTMLElement): HTMLButtonElement {
  const header = document.createElement("button");
  header.className = "sidebar-group-header";
  header.type = "button";
  header.setAttribute("aria-expanded", "true");
  header.setAttribute("aria-controls", `sidebar-group-${groupName.toLowerCase().replace(/\s+/g, "-")}`);

  const groupLabel = document.createElement("span");
  groupLabel.className = "sidebar-group-label";
  groupLabel.textContent = groupName;

  const groupToggle = document.createElement("span");
  groupToggle.className = "sidebar-group-toggle";
  groupToggle.textContent = "⌃";
  groupToggle.setAttribute("aria-hidden", "true");

  header.append(groupLabel, groupToggle);

  // Toggle collapse state and update ARIA
  header.addEventListener("click", () => {
    const isCollapsed = groupEl.classList.toggle("is-collapsed");
    header.setAttribute("aria-expanded", String(!isCollapsed));
  });

  return header;
}

function buildCollapseToggle(sidebarEl: HTMLElement): HTMLButtonElement {
  const toggle = document.createElement("button");
  toggle.className = "sidebar-collapse-toggle";
  toggle.type = "button";
  toggle.title = "Collapse sidebar";

  const icon = document.createElement("span");
  icon.className = "sidebar-collapse-toggle-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.append(createIcon("chevronLeft", { size: 16 }));

  const label = document.createElement("span");
  label.className = "sidebar-collapse-label";
  label.textContent = "Collapse";

  toggle.append(icon, label);

  toggle.addEventListener("click", () => {
    const isExpanded = sidebarEl.classList.toggle("is-expanded");
    saveExpandedPref(isExpanded);
    toggle.title = isExpanded ? "Collapse sidebar" : "Expand sidebar";
    label.textContent = isExpanded ? "Collapse" : "Expand";
  });

  return toggle;
}

export function initSidebar(sidebarEl: HTMLElement): void {
  sidebarEl.classList.add("transition-base");
  sidebarEl.replaceChildren();

  if (readExpandedPref()) {
    sidebarEl.classList.add("is-expanded");
  }

  for (const groupName of navGroups) {
    const group = document.createElement("section");
    group.className = "sidebar-group";
    group.id = `sidebar-group-${groupName.toLowerCase().replace(/\s+/g, "-")}`;

    const header = buildGroupHeader(groupName, group);
    group.append(header);
    buildNavItems(group, groupName);
    sidebarEl.append(group);
  }

  sidebarEl.append(buildCollapseToggle(sidebarEl));

  updateActiveState(sidebarEl);
  if (_navHandler) window.removeEventListener("router:navigate", _navHandler);
  _navHandler = () => updateActiveState(sidebarEl);
  window.addEventListener("router:navigate", _navHandler);
}
