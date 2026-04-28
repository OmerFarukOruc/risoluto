import {
  createButton,
  createField,
  createSelectControl,
  createTextInput,
  createTextareaControl,
} from "../../components/forms";
import { openConfirmModal } from "../../ui/confirm-modal.js";
import { toast } from "../../ui/toast.js";
import { formatDurationHuman } from "../../utils/format.js";

import type { SettingsFieldDefinition } from "./settings-helpers";

interface SettingsFieldRenderOptions {
  value: string;
  hintId?: string;
  onInput: (value: string) => void;
  onFocus: () => void;
  onAction?: () => void;
}

export function createSettingsField(field: SettingsFieldDefinition, options: SettingsFieldRenderOptions): HTMLElement {
  const control = buildControl(field, options);
  const wrapper = createField({ label: field.label, hint: field.hint, required: field.validation?.required }, control);
  wrapper.dataset.fieldKind = field.kind;

  if (options.hintId) {
    const hintEl = wrapper.querySelector(".form-hint");
    if (hintEl) {
      // Only wire the IDREF when the hint element actually exists.
      // Without this guard, fields without a `hint` property still got
      // `aria-describedby="settings-hint-foo"` pointing at nothing, which
      // silently degrades AT comprehension.
      const oldHintId = hintEl.id;
      hintEl.id = options.hintId;
      const fieldControl = wrapper.querySelector("input, textarea, select");
      if (fieldControl) {
        const existing = fieldControl.getAttribute("aria-describedby") ?? "";
        const ids = existing ? existing.split(" ").filter((id) => id !== oldHintId) : [];
        ids.unshift(options.hintId);
        fieldControl.setAttribute("aria-describedby", ids.join(" "));
      }
    }
  }

  applyFieldEnhancements(wrapper, field, options);
  return wrapper;
}

function addDefaultHint(hintEl: Element, defaultValue: string): void {
  const defaultSpan = document.createElement("span");
  defaultSpan.className = "settings-field-default";
  const code = document.createElement("code");
  code.textContent = defaultValue;
  defaultSpan.append(document.createTextNode("Default: "), code);
  if (hintEl.textContent) {
    defaultSpan.append(document.createTextNode(" \u00b7 "));
  }
  hintEl.prepend(defaultSpan);
}

function addDurationSuffix(wrapper: HTMLElement, value: string): void {
  const val = Number(value);
  if (val > 0 && Number.isFinite(val)) {
    const suffix = document.createElement("span");
    suffix.className = "settings-field-duration";
    suffix.textContent = `= ${formatDurationHuman(val)}`;
    const controlParent = wrapper.querySelector("input")?.parentElement;
    controlParent?.append(suffix);
  }
}

/** Post-process a rendered field with default hints, copper dot, reset, and duration suffix. */
function applyFieldEnhancements(
  wrapper: HTMLElement,
  field: SettingsFieldDefinition,
  options: SettingsFieldRenderOptions,
): void {
  const hintEl = wrapper.querySelector(".form-hint");
  const isOverridden = field.defaultValue !== undefined && options.value !== "" && options.value !== field.defaultValue;

  if (field.defaultValue && hintEl) addDefaultHint(hintEl, field.defaultValue);

  if (isOverridden) {
    const labelEl = wrapper.querySelector(".form-label");
    if (labelEl) {
      const dot = document.createElement("span");
      dot.className = "settings-field-set-dot";
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", "Explicitly configured");
      labelEl.append(dot);
    }
  }

  if (isOverridden) {
    const reset = createButton("Reset", "ghost");
    reset.className += " settings-field-reset";
    reset.addEventListener("click", () => options.onInput(field.defaultValue ?? ""));
    if (hintEl) wrapper.insertBefore(reset, hintEl);
    else wrapper.append(reset);
  }

  if (field.unit === "ms") addDurationSuffix(wrapper, options.value);
}

export function createSectionAction(label: string, primary = false): HTMLButtonElement {
  return createButton(label, primary ? "primary" : "ghost");
}

function buildCredentialControl(): HTMLElement {
  const container = document.createElement("div");
  container.className = "settings-credential-list";

  const loading = document.createElement("p");
  loading.className = "text-secondary";
  loading.textContent = "Loading credentials\u2026";
  container.append(loading);

  void (async () => {
    const { api } = await import("../../api.js");

    async function refresh(): Promise<void> {
      try {
        const { keys } = await api.getSecrets();
        container.replaceChildren();

        if (keys.length === 0) {
          const empty = document.createElement("p");
          empty.className = "text-secondary";
          empty.textContent = "No credentials stored yet.";
          container.append(empty);
        } else {
          const pills = document.createElement("div");
          pills.className = "settings-credential-pills";
          for (const key of keys) {
            const pill = document.createElement("span");
            pill.className = "settings-credential-pill";
            const name = document.createElement("span");
            name.textContent = key;
            const del = document.createElement("button");
            del.type = "button";
            del.className = "settings-credential-delete";
            del.textContent = "\u00d7";
            del.setAttribute("aria-label", `Delete ${key}`);
            del.addEventListener("click", () => {
              const body = document.createElement("p");
              body.className = "text-secondary";
              body.textContent = `Delete the credential "${key}"? Any service relying on this key will fail until it's re-added.`;
              openConfirmModal({
                title: `Delete ${key}?`,
                body,
                cancelLabel: "Keep credential",
                confirmLabel: "Delete credential",
                pendingLabel: "Deleting…",
                variant: "danger",
                onConfirm: async () => {
                  try {
                    await api.deleteSecret(key);
                    await refresh();
                  } catch (error) {
                    toast(error instanceof Error ? error.message : "Failed to delete credential.", "error");
                    return false;
                  }
                },
              });
            });
            pill.append(name, del);
            pills.append(pill);
          }
          container.append(pills);
        }

        const addBtn = createButton("+ Add credential", "ghost");
        addBtn.addEventListener("click", () => openCredentialAddModal(refresh, api));
        container.append(addBtn);
        // Encryption posture is documented once via the form field hint
        // (see settings-section-defs.ts), no need to repeat it here.
      } catch {
        container.replaceChildren();
        const err = document.createElement("p");
        err.className = "form-error";
        err.textContent = "Failed to load credentials.";
        const retryBtn = createButton("Retry", "ghost");
        retryBtn.addEventListener("click", () => {
          void refresh();
        });
        container.append(err, retryBtn);
      }
    }

    await refresh();
  })();

  return container;
}

interface CredentialApi {
  postSecret: (key: string, value: string) => Promise<unknown>;
}

function openCredentialAddModal(refresh: () => Promise<void>, api: CredentialApi): void {
  const form = document.createElement("div");
  form.className = "settings-credential-form";

  const idSuffix = crypto.randomUUID().slice(0, 8);
  const keyInputId = `credential-key-${idSuffix}`;
  const valueInputId = `credential-value-${idSuffix}`;

  const keyField = document.createElement("div");
  keyField.className = "form-field";
  const keyLabel = document.createElement("label");
  keyLabel.className = "form-label";
  keyLabel.htmlFor = keyInputId;
  keyLabel.textContent = "Credential key";
  const keyInput = document.createElement("input");
  keyInput.id = keyInputId;
  keyInput.type = "text";
  keyInput.className = "mc-input";
  keyInput.placeholder = "LINEAR_API_KEY";
  keyInput.autocomplete = "off";
  keyInput.spellcheck = false;
  keyField.append(keyLabel, keyInput);

  const valueField = document.createElement("div");
  valueField.className = "form-field";
  const valueLabel = document.createElement("label");
  valueLabel.className = "form-label";
  valueLabel.htmlFor = valueInputId;
  valueLabel.textContent = "Value";
  const valueInput = document.createElement("input");
  valueInput.id = valueInputId;
  valueInput.type = "password";
  valueInput.className = "mc-input";
  valueInput.placeholder = "Paste credential value";
  valueInput.autocomplete = "off";
  valueInput.spellcheck = false;
  valueField.append(valueLabel, valueInput);

  form.append(keyField, valueField);

  openConfirmModal({
    title: "Add credential",
    body: form,
    cancelLabel: "Cancel",
    confirmLabel: "Save credential",
    pendingLabel: "Saving…",
    variant: "primary",
    onOpen: (controls) => {
      controls.setConfirmDisabled(true);
      const update = (): void => controls.setConfirmDisabled(!keyInput.value.trim() || !valueInput.value.trim());
      keyInput.addEventListener("input", update);
      valueInput.addEventListener("input", update);
      keyInput.focus();
    },
    onConfirm: async () => {
      const key = keyInput.value.trim();
      const value = valueInput.value.trim();
      if (!key || !value) return false;
      try {
        await api.postSecret(key, value);
        await refresh();
      } catch (error) {
        toast(error instanceof Error ? error.message : "Failed to save credential.", "error");
        return false;
      }
    },
  });
}

function buildJsonTextareaGroup(textarea: HTMLTextAreaElement): HTMLElement {
  const errorEl = createInlineError();
  textarea.addEventListener("blur", () => {
    const val = textarea.value.trim();
    if (val === "") {
      textarea.classList.remove("settings-field-error");
      errorEl.hidden = true;
      return;
    }
    try {
      JSON.parse(val);
      textarea.classList.remove("settings-field-error");
      errorEl.hidden = true;
    } catch (error_) {
      textarea.classList.add("settings-field-error");
      errorEl.textContent = `Invalid JSON: ${error_ instanceof SyntaxError ? error_.message : "parse error"}`;
      errorEl.hidden = false;
    }
  });
  textarea.addEventListener("input", () => {
    textarea.classList.remove("settings-field-error");
    errorEl.hidden = true;
  });
  const group = document.createElement("div");
  group.append(textarea, errorEl);
  return group;
}

function validateNumberInput(
  input: HTMLInputElement,
  errorEl: HTMLParagraphElement,
  validation: import("./settings-types").SettingsFieldValidation | undefined,
): void {
  const val = input.value.trim();
  const numeric = Number(val);
  let message = "";
  if (val !== "" && !Number.isFinite(numeric)) {
    message = "Must be a valid number.";
  } else if (val !== "" && validation?.min !== undefined && numeric < validation.min) {
    message = `Must be at least ${validation.min}.`;
  } else if (val !== "" && validation?.max !== undefined && numeric > validation.max) {
    message = `Must be at most ${validation.max}.`;
  }
  if (message) {
    input.classList.add("settings-field-error");
    errorEl.textContent = message;
    errorEl.hidden = false;
  } else {
    input.classList.remove("settings-field-error");
    errorEl.hidden = true;
  }
}

function buildActionRow(children: HTMLElement[], actionLabel: string, onAction: () => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "settings-field-action-row";
  const btn = createButton(actionLabel, "ghost");
  btn.addEventListener("click", onAction);
  row.append(...children, btn);
  return row;
}

function buildNumberControl(field: SettingsFieldDefinition, options: SettingsFieldRenderOptions): HTMLElement {
  const input = createTextInput({
    className: "mc-input",
    type: "number",
    placeholder: field.placeholder ?? "",
    value: options.value,
    readOnly: field.editable === false,
  });
  if (field.validation?.min !== undefined) input.min = String(field.validation.min);
  if (field.validation?.max !== undefined) input.max = String(field.validation.max);
  input.addEventListener("input", () => options.onInput(input.value));
  input.addEventListener("focus", options.onFocus);
  const errorEl = createInlineError();
  input.addEventListener("blur", () => validateNumberInput(input, errorEl, field.validation));
  input.addEventListener("input", () => {
    input.classList.remove("settings-field-error");
    errorEl.hidden = true;
  });
  if (field.actionLabel && options.onAction) {
    return buildActionRow([input, errorEl], field.actionLabel, options.onAction);
  }
  const group = document.createElement("div");
  group.append(input, errorEl);
  return group;
}

function buildControl(field: SettingsFieldDefinition, options: SettingsFieldRenderOptions): HTMLElement {
  if (field.kind === "credential") return buildCredentialControl();
  if (field.kind === "select") {
    const select = createSelectControl({
      options: field.options ?? [],
      value: options.value,
      disabled: field.editable === false,
    });
    select.addEventListener("change", () => options.onInput(select.value));
    select.addEventListener("focus", options.onFocus);

    if (field.path === "codex.approval_policy") {
      const wrapper = document.createElement("div");
      wrapper.className = "settings-approval-wrapper";
      const warning = document.createElement("p");
      warning.className = "settings-approval-warning";
      warning.textContent = "Auto-approves all agent actions without human review.";
      warning.hidden = options.value !== "never";
      wrapper.append(select, warning);
      select.addEventListener("change", () => {
        const isDangerous = select.value === "never";
        warning.hidden = !isDangerous;
        select.classList.toggle("is-danger", isDangerous);
      });
      if (options.value === "never") {
        select.classList.add("is-danger");
      }
      return wrapper;
    }

    return select;
  }
  if (field.kind === "boolean") {
    const select = createSelectControl({
      options: [
        { value: "true", label: "Enabled" },
        { value: "false", label: "Disabled" },
      ],
      value: options.value || "false",
      disabled: field.editable === false,
    });
    select.addEventListener("change", () => options.onInput(select.value));
    select.addEventListener("focus", options.onFocus);
    return select;
  }
  if (field.kind === "list") return buildChipEditor(field, options);
  if (field.kind === "number") return buildNumberControl(field, options);
  if (field.kind === "textarea" || field.kind === "json") {
    const textarea = createTextareaControl({
      className: "mc-textarea settings-textarea",
      placeholder: field.placeholder ?? "",
      value: options.value,
      readOnly: field.editable === false,
    });
    textarea.addEventListener("input", () => options.onInput(textarea.value));
    textarea.addEventListener("focus", options.onFocus);
    return field.kind === "json" ? buildJsonTextareaGroup(textarea) : textarea;
  }
  const input = createTextInput({
    className: "mc-input",
    type: "text",
    placeholder: field.placeholder ?? "",
    value: options.value,
    readOnly: field.editable === false,
  });
  input.addEventListener("input", () => options.onInput(input.value));
  input.addEventListener("focus", options.onFocus);
  if (field.actionLabel && options.onAction) {
    return buildActionRow([input], field.actionLabel, options.onAction);
  }
  return input;
}

function createInlineError(): HTMLParagraphElement {
  const errorEl = document.createElement("p");
  errorEl.className = "settings-field-error-text";
  errorEl.hidden = true;
  return errorEl;
}

/** Interactive chip/tag editor for list-kind fields. Replaces textarea with visual chips. */
function buildChipEditor(field: SettingsFieldDefinition, options: SettingsFieldRenderOptions): HTMLElement {
  const container = document.createElement("div");
  container.className = "settings-chip-editor";
  const items = options.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "settings-chip-input";
  input.placeholder = field.placeholder ?? "Type and press Enter\u2026";
  input.setAttribute("aria-label", `Add ${field.label}`);

  function emitValue(): void {
    options.onInput(items.join("\n"));
  }

  function renderChips(): void {
    container.querySelectorAll(".mc-chip").forEach((c) => c.remove());
    for (const item of items) {
      const chip = document.createElement("span");
      chip.className = "mc-chip is-sm";
      const text = document.createElement("span");
      text.textContent = item;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "settings-chip-delete";
      del.textContent = "\u00d7";
      del.setAttribute("aria-label", `Remove ${item}`);
      del.addEventListener("click", () => {
        const idx = items.indexOf(item);
        if (idx >= 0) items.splice(idx, 1);
        emitValue();
        renderChips();
      });
      chip.append(text, del);
      container.insertBefore(chip, input);
    }
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      e.preventDefault();
      items.push(input.value.trim());
      input.value = "";
      emitValue();
      renderChips();
    }
    if (e.key === "Backspace" && input.value === "" && items.length > 0) {
      items.pop();
      emitValue();
      renderChips();
    }
  });

  input.addEventListener("paste", (e) => {
    const text = e.clipboardData?.getData("text") ?? "";
    const newItems = text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (newItems.length > 0) {
      e.preventDefault();
      items.push(...newItems);
      emitValue();
      renderChips();
    }
  });

  input.addEventListener("focus", options.onFocus);
  container.append(input);
  container.addEventListener("click", () => input.focus());
  renderChips();
  return container;
}
