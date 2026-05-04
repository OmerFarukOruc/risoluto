import { registerPageCleanup } from "../../utils/page.js";
import { SECTION_BUILDERS, SECTION_DEFS } from "./section-catalog.js";
import { createSettingsNav } from "./settings-nav.js";
import { createSettingsWorkbench } from "./workbench.js";

function resolveActiveId(): string {
  const hash = window.location.hash.replace(/^#/, "");
  const valid = SECTION_DEFS.find((s) => s.id === hash);
  return valid?.id ?? SECTION_DEFS[0].id;
}

export function createSettingsPage(): HTMLElement {
  const root = document.createElement("div");
  root.className = "settings-page";

  const wb = createSettingsWorkbench();

  const nav = createSettingsNav(SECTION_DEFS, (id) => {
    showSection(id);
    window.history.replaceState(null, "", `#${id}`);
  });
  root.append(nav.root);

  const pane = document.createElement("div");
  pane.className = "settings-page-pane";

  const paneBody = document.createElement("div");
  paneBody.className = "settings-page-pane-body";
  pane.append(paneBody);
  root.append(pane);

  const sectionEls = new Map<string, HTMLElement>();

  for (const def of SECTION_DEFS) {
    const builder = SECTION_BUILDERS[def.id];
    if (!builder) continue;
    const sectionEl = builder(wb);
    sectionEl.id = `section-${def.id}`;
    sectionEl.hidden = true;
    paneBody.append(sectionEl);
    sectionEls.set(def.id, sectionEl);
  }

  const showSection = (id: string): void => {
    for (const [sectionId, el] of sectionEls) {
      el.hidden = sectionId !== id;
    }
    nav.setActive(id);
    paneBody.scrollTop = 0;
  };

  const onHashChange = (): void => {
    showSection(resolveActiveId());
  };

  window.addEventListener("hashchange", onHashChange);

  const unsubscribe = wb.subscribe(() => {
    // no-op: sections subscribe individually
  });

  void wb.load().then(() => {
    showSection(resolveActiveId());
  });

  registerPageCleanup(root, () => {
    window.removeEventListener("hashchange", onHashChange);
    unsubscribe();
  });

  return root;
}
