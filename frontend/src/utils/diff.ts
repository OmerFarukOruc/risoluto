export function flashDiff(element: Element): void {
  element.classList.remove("diff-flash");
  if (element instanceof HTMLElement) {
    element.getBoundingClientRect();
  }
  element.classList.add("diff-flash");
  globalThis.setTimeout(() => element.classList.remove("diff-flash"), 900);
}

export function setTextWithDiff(element: HTMLElement, nextValue: string): void {
  if (element.textContent === nextValue) {
    return;
  }
  element.textContent = nextValue;
  flashDiff(element);
}
