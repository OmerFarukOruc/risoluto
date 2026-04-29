/**
 * A single live indicator: a coloured dot wrapped in a ring that pulses
 * outward on infinite loop. Dramatic enough to read as "agent is working
 * right now" without becoming visual noise. Respects `prefers-reduced-motion`
 * via the CSS — this factory just emits structure.
 */

export interface PulseRingOptions {
  /** CSS colour token, e.g. "var(--status-running)". Defaults to running. */
  color?: string;
  /** Dot diameter in px. The ring is drawn around it via box-shadow. */
  size?: number;
}

export function createPulseRing(options: PulseRingOptions = {}): HTMLElement {
  const color = options.color ?? "var(--status-running)";
  const size = options.size ?? 7;
  const ring = document.createElement("span");
  ring.className = "pulse-ring";
  ring.setAttribute("aria-hidden", "true");
  ring.style.width = `${size}px`;
  ring.style.height = `${size}px`;
  ring.style.background = color;
  ring.style.setProperty("--pulse-color", color);
  return ring;
}
