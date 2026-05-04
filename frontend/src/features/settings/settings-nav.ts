import { createIcon } from "../../ui/icons.js";
import type { SectionDef } from "./section-types.js";

export interface NavHandle {
  root: HTMLElement;
  setActive(sectionId: string): void;
}

export function createSettingsNav(sections: SectionDef[], onSelect: (id: string) => void): NavHandle {
  const nav = document.createElement("nav");
  nav.className = "settings-page-nav";
  nav.setAttribute("aria-label", "Settings sections");

  const title = document.createElement("h1");
  title.className = "settings-page-nav-title page-title";
  title.textContent = "Settings";
  nav.append(title);

  const buttons = new Map<string, HTMLButtonElement>();
  const groups = new Map<string, HTMLElement>();

  for (const section of sections) {
    if (!groups.has(section.group)) {
      const groupEl = document.createElement("div");
      groupEl.className = "settings-page-nav-group";

      const groupLabel = document.createElement("div");
      groupLabel.className = "settings-page-nav-group-label";
      groupLabel.textContent = section.group;
      groupEl.append(groupLabel);

      groups.set(section.group, groupEl);
      nav.append(groupEl);
    }

    const groupEl = groups.get(section.group)!;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "settings-page-nav-item";
    btn.dataset.sectionId = section.id;
    btn.addEventListener("click", () => onSelect(section.id));

    const indicator = document.createElement("span");
    indicator.className = "settings-page-nav-indicator";
    indicator.setAttribute("aria-hidden", "true");
    btn.append(indicator);

    const icon = createIcon(section.icon, { className: "settings-page-nav-icon", size: 16 });
    btn.append(icon);

    const label = document.createElement("span");
    label.className = "settings-page-nav-label";
    label.textContent = section.label;
    btn.append(label);

    groupEl.append(btn);
    buttons.set(section.id, btn);
  }

  return {
    root: nav,
    setActive(sectionId: string): void {
      for (const [id, btn] of buttons) {
        const isActive = id === sectionId;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-current", String(isActive));
      }
    },
  };
}
