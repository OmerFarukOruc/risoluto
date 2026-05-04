import { api } from "../../../api.js";
import { toast } from "../../../ui/toast.js";
import { createSectionHeader } from "../primitives.js";
import type { SettingsWorkbench } from "../workbench.js";

function buildSecretRow(key: string, onDelete: () => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "settings-list-row";

  const keyEl = document.createElement("span");
  keyEl.className = "settings-list-row-name";
  keyEl.textContent = key;

  const masked = document.createElement("span");
  masked.className = "settings-list-row-meta";
  masked.textContent = "•••••••••";

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "mc-button is-ghost is-sm";
  delBtn.textContent = "Remove";
  delBtn.addEventListener("click", onDelete);

  row.append(keyEl, masked, delBtn);
  return row;
}

export function buildCredentialsSection(_wb: SettingsWorkbench): HTMLElement {
  const root = document.createElement("section");
  root.className = "settings-section";
  root.id = "section-credentials";

  const { root: headerRoot } = createSectionHeader({
    title: "Credentials",
    sub: "Encrypted key-value secrets available to agents at runtime.",
  });
  root.append(headerRoot);

  const list = document.createElement("div");
  list.className = "settings-section-body";
  root.append(list);

  const addForm = document.createElement("div");
  addForm.style.cssText =
    "display:flex;gap:8px;align-items:center;padding:12px var(--space-5);border-bottom:1px solid var(--border-muted);";

  const keyInput = document.createElement("input");
  keyInput.type = "text";
  keyInput.className = "mc-input is-mono";
  keyInput.placeholder = "Secret key";
  keyInput.setAttribute("aria-label", "Secret key");

  const valInput = document.createElement("input");
  valInput.type = "password";
  valInput.className = "mc-input is-mono";
  valInput.placeholder = "Secret value";
  valInput.setAttribute("aria-label", "Secret value");

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "mc-button is-primary is-sm";
  addBtn.textContent = "Add secret";
  addBtn.addEventListener("click", async () => {
    const key = keyInput.value.trim();
    const value = valInput.value;
    if (!key || !value) return;
    try {
      await api.postSecret(key, value);
      keyInput.value = "";
      valInput.value = "";
      toast(`Secret "${key}" saved`, "success");
      await loadSecrets();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save secret", "error");
    }
  });

  addForm.append(keyInput, valInput, addBtn);
  list.append(addForm);

  const loadSecrets = async (): Promise<void> => {
    const existingRows = list.querySelectorAll(".settings-list-row, .settings-list-empty");
    for (const el of existingRows) el.remove();

    try {
      const res = await api.getSecrets();
      if (res.keys.length === 0) {
        const empty = document.createElement("div");
        empty.className = "settings-list-empty";
        empty.style.cssText = "padding:12px var(--space-5);color:var(--text-muted);font-size:var(--text-xs);";
        empty.textContent = "No secrets stored.";
        list.append(empty);
        return;
      }
      for (const key of res.keys) {
        list.append(
          buildSecretRow(key, async () => {
            try {
              await api.deleteSecret(key);
              toast(`Secret "${key}" removed`, "success");
              await loadSecrets();
            } catch (err) {
              toast(err instanceof Error ? err.message : "Delete failed", "error");
            }
          }),
        );
      }
    } catch {
      toast("Failed to load secrets", "error");
    }
  };

  void loadSecrets();
  return root;
}
