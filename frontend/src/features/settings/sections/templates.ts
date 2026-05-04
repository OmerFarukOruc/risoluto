import { api } from "../../../api.js";
import { toast } from "../../../ui/toast.js";
import type { PromptTemplate } from "../../../types/config.js";
import { createSectionHeader, createTextareaField, createTextField } from "../primitives.js";
import type { SettingsWorkbench } from "../workbench.js";

export function buildTemplatesSection(_wb: SettingsWorkbench): HTMLElement {
  const root = document.createElement("section");
  root.className = "settings-section";
  root.id = "section-templates";

  const { root: headerRoot } = createSectionHeader({ title: "Templates", sub: "Prompt templates used by agents." });
  root.append(headerRoot);

  const body = document.createElement("div");
  body.className = "settings-templates";
  root.append(body);

  let templates: PromptTemplate[] = [];
  let selectedId: string | null = null;
  let nameVal = "";
  let bodyVal = "";

  const listCol = document.createElement("div");
  listCol.className = "settings-templates-list";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "mc-button is-ghost is-sm";
  addBtn.style.cssText = "margin: 8px 14px;";
  addBtn.textContent = "+ New";
  addBtn.addEventListener("click", () => {
    selectedId = null;
    nameVal = "";
    bodyVal = "";
    render();
  });

  const editorCol = document.createElement("div");
  editorCol.className = "settings-templates-editor";

  body.append(listCol, editorCol);

  const render = (): void => {
    listCol.innerHTML = "";
    listCol.append(addBtn);

    for (const tpl of templates) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "settings-templates-list-item";
      item.setAttribute("aria-current", String(tpl.id === selectedId));
      item.textContent = tpl.name || tpl.id;
      item.addEventListener("click", () => {
        selectedId = tpl.id;
        nameVal = tpl.name;
        bodyVal = tpl.body;
        render();
      });
      listCol.append(item);
    }

    editorCol.innerHTML = "";
    const header = document.createElement("div");
    header.className = "settings-templates-editor-header";

    const nameField = createTextField({
      value: nameVal,
      placeholder: "Template name",
      onInput: (v) => {
        nameVal = v;
      },
    });
    header.append(nameField);

    const editorBody = document.createElement("div");
    editorBody.className = "settings-templates-body";

    const bodyField = createTextareaField({
      value: bodyVal,
      rows: 14,
      mono: true,
      placeholder: "Template body…",
      onInput: (v) => {
        bodyVal = v;
      },
    });
    bodyField.style.width = "100%";
    editorBody.append(bodyField);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;padding:8px 14px;border-top:1px solid var(--border-muted);";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "mc-button is-primary is-sm";
    saveBtn.textContent = selectedId ? "Save" : "Create";
    saveBtn.addEventListener("click", async () => {
      try {
        if (selectedId) {
          await api.updateTemplate(selectedId, { name: nameVal, body: bodyVal });
          toast("Template updated", "success");
        } else {
          const id = `tpl-${Date.now()}`;
          await api.createTemplate({ id, name: nameVal, body: bodyVal });
          selectedId = id;
          toast("Template created", "success");
        }
        const res = await api.getTemplates();
        templates = res.templates;
        render();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Save failed", "error");
      }
    });
    actions.append(saveBtn);

    if (selectedId) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "mc-button is-ghost is-sm";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (!selectedId) return;
        try {
          await api.deleteTemplate(selectedId);
          toast("Template deleted", "success");
          selectedId = null;
          const res = await api.getTemplates();
          templates = res.templates;
          render();
        } catch (err) {
          toast(err instanceof Error ? err.message : "Delete failed", "error");
        }
      });
      actions.append(delBtn);
    }

    editorCol.append(header, editorBody, actions);
  };

  api
    .getTemplates()
    .then((res) => {
      templates = res.templates;
      render();
    })
    .catch(() => {
      toast("Failed to load templates", "error");
    });

  render();
  return root;
}
