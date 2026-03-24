import { createIcon, type IconName } from "./icons.js";

export type ButtonTone = "default" | "ghost" | "primary" | "danger";
export type ButtonSize = "sm" | "lg";

interface ButtonClassNameOptions {
  tone?: ButtonTone;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string | string[];
}

interface IconButtonOptions extends ButtonClassNameOptions {
  iconName: IconName;
  label: string;
  iconSize?: number;
}

function appendClassNames(classes: string[], className?: string | string[]): void {
  if (!className) {
    return;
  }
  if (Array.isArray(className)) {
    classes.push(...className.filter(Boolean));
    return;
  }
  classes.push(className);
}

export function buttonClassName(options: ButtonClassNameOptions = {}): string {
  const classes = ["mc-button"];
  if (options.tone && options.tone !== "default") {
    classes.push(`is-${options.tone}`);
  }
  if (options.size) {
    classes.push(`is-${options.size}`);
  }
  if (options.iconOnly) {
    classes.push("is-icon-only");
  }
  appendClassNames(classes, options.className);
  return classes.join(" ");
}

export function createIconButton(options: IconButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = buttonClassName({
    tone: options.tone ?? "ghost",
    size: options.size ?? "sm",
    iconOnly: true,
    className: options.className,
  });
  button.title = options.label;
  button.setAttribute("aria-label", options.label);
  button.append(createIcon(options.iconName, { size: options.iconSize ?? 16 }));
  return button;
}
