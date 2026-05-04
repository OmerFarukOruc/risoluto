import { api } from "../../../api.js";
import { toast } from "../../../ui/toast.js";
import { createSectionHeader } from "../primitives.js";
import type { SettingsWorkbench } from "../workbench.js";

export function buildOverlaySection(wb: SettingsWorkbench): HTMLElement {
  const root = document.createElement("section");
  root.className = "settings-section";
  root.id = "section-overlay";

  const { root: headerRoot } = createSectionHeader({
    title: "Config overlay",
    sub: "Raw JSON patch merged on top of the base config file. Handle with care.",
  });
  root.append(headerRoot);

  let editorValue = JSON.stringify(wb.snapshot.overlay ?? {}, null, 2);

  const textarea = document.createElement("textarea");
  textarea.className = "settings-overlay-editor";
  textarea.rows = 18;
  textarea.value = editorValue;
  textarea.placeholder = "{}";
  textarea.spellcheck = false;
  textarea.addEventListener("input", () => {
    editorValue = textarea.value;
  });

  const actions = document.createElement("div");
  actions.style.cssText =
    "display:flex;gap:8px;padding:10px var(--space-5);border-top:1px solid var(--border-muted);background:var(--bg-surface);";

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.className = "mc-button is-primary is-sm";
  applyBtn.textContent = "Apply overlay";
  applyBtn.addEventListener("click", async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editorValue) as Record<string, unknown>;
    } catch {
      toast("Invalid JSON — fix syntax errors before applying.", "error");
      return;
    }
    try {
      await api.putConfigOverlay(parsed);
      toast("Overlay applied", "success");
      await wb.load();
      textarea.value = JSON.stringify(wb.snapshot.overlay ?? {}, null, 2);
      editorValue = textarea.value;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Apply failed", "error");
    }
  });

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "mc-button is-ghost is-sm";
  resetBtn.textContent = "Reset overlay";
  resetBtn.addEventListener("click", async () => {
    try {
      await api.putConfigOverlay({});
      toast("Overlay cleared", "success");
      await wb.load();
      textarea.value = "{}";
      editorValue = "{}";
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reset failed", "error");
    }
  });

  actions.append(applyBtn, resetBtn);

  const unsubscribe = wb.subscribe(() => {
    const fresh = JSON.stringify(wb.snapshot.overlay ?? {}, null, 2);
    if (fresh !== editorValue) {
      textarea.value = fresh;
      editorValue = fresh;
    }
  });

  root.addEventListener("disconnectedcallback", unsubscribe);
  root.append(textarea, actions);
  return root;
}
