import { createIcon, type IconName } from "../ui/icons";

const EMPTY_STATE_ICONS = {
  default: "emptyDefault",
  queue: "emptyQueue",
  terminal: "emptyTerminal",
  events: "emptyEvents",
  attention: "emptyAttention",
  error: "emptyError",
  notFound: "emptyError",
  serverError: "emptyError",
  timeout: "emptyNetwork",
  network: "emptyNetwork",
} as const satisfies Record<string, IconName>;

type EmptyStateVariant = keyof typeof EMPTY_STATE_ICONS;

const EMPTY_STATE_KICKERS = {
  default: "Standby",
  queue: "Board ready",
  terminal: "Archive calm",
  events: "Signal quiet",
  attention: "Clear runway",
  error: "Fetch error",
  notFound: "Not found",
  serverError: "Server error",
  timeout: "Request timed out",
  network: "Connection pending",
} as const satisfies Record<EmptyStateVariant, string>;

interface StateBoxConfig {
  containerClass: string;
  iconClass: string;
  kickerClass: string;
  headingClass: string;
  textClass: string;
  iconName: IconName;
  kicker: string;
  title: string;
  detail: string;
  variant: EmptyStateVariant;
  headingLevel: "h2" | "h3";
  actionLabel?: string;
  onAction?: () => void;
  actionVariant: "primary" | "ghost";
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
}

export interface EmptyStateOptions {
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  headingLevel?: "h2" | "h3";
  actionVariant?: "primary" | "ghost";
}

/**
 * Render detail text, converting `backtick`-wrapped runs to <code> spans so
 * operator-grade hints like "tail `./risoluto-logs`" render with monospace
 * emphasis. Newlines are preserved via `white-space: pre-line` in CSS.
 */
function appendDetailWithCode(target: HTMLElement, detail: string): void {
  const codePattern = /`([^`\n]+)`/g;
  let cursor = 0;
  for (const match of detail.matchAll(codePattern)) {
    const start = match.index;
    if (start > cursor) {
      target.append(document.createTextNode(detail.slice(cursor, start)));
    }
    const code = document.createElement("code");
    code.textContent = match[1];
    target.append(code);
    cursor = start + match[0].length;
  }
  if (cursor < detail.length) {
    target.append(document.createTextNode(detail.slice(cursor)));
  }
}

const LIVE_REGION_VARIANTS = new Set<EmptyStateVariant>(["error", "serverError", "timeout", "network", "notFound"]);

function buildStateBox(config: StateBoxConfig): HTMLElement {
  const box = document.createElement("div");
  box.className = config.containerClass;
  box.dataset.emptyVariant = config.variant;
  if (LIVE_REGION_VARIANTS.has(config.variant)) {
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
  }

  const icon = document.createElement("div");
  icon.className = config.iconClass;
  icon.setAttribute("aria-hidden", "true");
  icon.append(createIcon(config.iconName, { size: 32 }));

  const kicker = document.createElement("span");
  kicker.className = config.kickerClass;
  kicker.textContent = config.kicker;

  const heading = document.createElement(config.headingLevel);
  heading.className = config.headingClass;
  heading.textContent = config.title;

  const text = document.createElement("p");
  text.className = config.textClass;
  appendDetailWithCode(text, config.detail);

  box.append(icon, kicker, heading, text);

  if (config.actionLabel && config.onAction) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mc-button is-${config.actionVariant}`;
    button.textContent = config.actionLabel;
    button.addEventListener("click", config.onAction);
    box.append(button);
  }

  if (config.secondaryActionLabel && config.secondaryActionHref) {
    const link = document.createElement("a");
    link.className = "mc-button is-ghost";
    link.href = config.secondaryActionHref;
    link.textContent = config.secondaryActionLabel;
    box.append(link);
  }

  return box;
}

export function createEmptyState(
  title: string,
  detail: string,
  actionLabel?: string,
  onAction?: () => void,
  variant: EmptyStateVariant = "default",
  options: EmptyStateOptions = {},
): HTMLElement {
  const iconName = EMPTY_STATE_ICONS[variant] ?? EMPTY_STATE_ICONS.default;
  const box = buildStateBox({
    containerClass: "mc-empty-state",
    iconClass: "mc-empty-state-icon",
    kickerClass: "mc-empty-state-kicker",
    headingClass: "mc-empty-state-title",
    textClass: "mc-empty-state-detail",
    iconName,
    kicker: EMPTY_STATE_KICKERS[variant],
    title,
    detail,
    variant,
    headingLevel: options.headingLevel ?? "h3",
    actionLabel,
    onAction,
    actionVariant: options.actionVariant ?? "primary",
    secondaryActionLabel: options.secondaryActionLabel,
    secondaryActionHref: options.secondaryActionHref,
  });
  return box;
}
