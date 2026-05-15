import {
  applyFieldConstraints,
  createCharacterCounter,
  type FieldControl,
  hasValidationRules,
  isFieldControl,
  isTextEntryControl,
  syncFieldError,
} from "./form-controls.js";
import { buttonClassName, type ButtonTone } from "../ui/buttons.js";

export interface FieldOptions {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Resolve the labellable control inside an arbitrary element tree. Many
 * field builders return a wrapper `<div>` that contains the real input
 * (e.g. number controls with inline error elements, or selects wrapped
 * for danger-warning patterns). Without this lookup, `label.htmlFor`
 * would point nowhere and the field would be unannounced to assistive
 * tech — a systemic accessibility regression.
 */
function resolveLabellableControl(root: HTMLElement): FieldControl | null {
  if (isFieldControl(root)) return root;
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select");
}

export function createField(options: FieldOptions, control: HTMLElement): HTMLElement {
  const field = document.createElement("div");
  field.className = "form-field";

  const label = document.createElement("label");
  label.className = `form-label${options.required ? " required" : ""}`;
  label.textContent = options.label;

  const labellable = resolveLabellableControl(control);
  const describedBy: string[] = [];
  if (labellable) {
    applyFieldConstraints(labellable, options);
    if (!labellable.id) {
      labellable.id = `field-${crypto.randomUUID()}`;
    }
    label.htmlFor = labellable.id;
  }

  field.append(label, control);

  if (options.hint) {
    const hint = document.createElement("span");
    hint.className = "form-hint";
    hint.id = `${labellable?.id ?? "field"}-hint`;
    hint.textContent = options.hint;
    describedBy.push(hint.id);
    field.append(hint);
  }

  if (labellable && isTextEntryControl(labellable) && options.maxLength) {
    field.append(createCharacterCounter(labellable, options.maxLength));
  }

  if (labellable) {
    const errorEl = document.createElement("span");
    errorEl.className = "form-error";
    errorEl.id = `${labellable.id}-error`;
    errorEl.hidden = true;
    errorEl.setAttribute("role", "alert");
    describedBy.push(errorEl.id);
    field.append(errorEl);
    syncFieldError(labellable, errorEl, options.error);

    if (hasValidationRules(options)) {
      const update = () => syncFieldError(labellable, errorEl);
      labellable.addEventListener(labellable instanceof HTMLSelectElement ? "change" : "input", update);
      labellable.addEventListener("blur", update);
    }
    labellable.setAttribute("aria-describedby", describedBy.join(" "));
  }

  return field;
}

export function createTextareaControl(options: {
  placeholder?: string;
  value?: string;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  rows?: number;
  className?: string;
  readOnly?: boolean;
  disabled?: boolean;
}): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.className = options.className ?? "mc-textarea";
  if (options.placeholder) textarea.placeholder = options.placeholder;
  if (options.value) textarea.value = options.value;
  if (options.required) textarea.required = true;
  if (options.maxLength) textarea.maxLength = options.maxLength;
  if (options.minLength) textarea.minLength = options.minLength;
  if (options.rows) textarea.rows = options.rows;
  textarea.readOnly = options.readOnly ?? false;
  textarea.disabled = options.disabled ?? false;
  return textarea;
}

export function createSelectControl(options: {
  options: SelectOption[];
  value?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = options.className ?? "mc-select";
  select.required = options.required ?? false;
  select.disabled = options.disabled ?? false;
  options.options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    option.selected = options.value === opt.value;
    select.append(option);
  });
  return select;
}

export function createButton(
  label: string,
  variant: ButtonTone = "ghost",
  type: "button" | "submit" = "button",
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = type;
  button.className = buttonClassName({ tone: variant });
  button.textContent = label;
  return button;
}
