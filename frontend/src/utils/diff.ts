export function flashDiff(element: Element): void {
  element.classList.remove("diff-flash");
  if (element instanceof HTMLElement) {
    element.getBoundingClientRect();
  }
  element.classList.add("diff-flash");
  globalThis.setTimeout(() => element.classList.remove("diff-flash"), 900);
}

/**
 * Adds GPU-composited metric pulse for KPI value elements.
 * Complements flashDiff for numeric metric displays.
 */
function flashMetric(element: HTMLElement): void {
  element.classList.remove("metric-updated");
  element.getBoundingClientRect();
  element.classList.add("metric-updated");
  globalThis.setTimeout(() => element.classList.remove("metric-updated"), 300);
}

export function setTextWithDiff(element: HTMLElement, nextValue: string): void {
  if (element.textContent === nextValue) {
    return;
  }
  element.textContent = nextValue;
  flashDiff(element);

  /* Trigger metric pulse for KPI-style value elements */
  if (element.classList.contains("overview-live-value") || element.classList.contains("text-metric")) {
    flashMetric(element);
  }
}
