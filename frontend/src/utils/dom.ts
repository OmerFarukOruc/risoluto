/** Shorthand element factory: creates a DOM element with optional class and text content. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

export interface TypingTargetOptions {
  includeSelect?: boolean;
}

export function isTypingTarget(target: EventTarget | null, options: TypingTargetOptions = {}): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (options.includeSelect === true && target instanceof HTMLSelectElement) ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
