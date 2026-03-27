function createSkeleton(className: string, size?: string): HTMLElement {
  const element = document.createElement("div");
  element.className = `${className} skeleton`;
  element.setAttribute("aria-hidden", "true");
  if (size) {
    element.style.setProperty(className.includes("line") ? "width" : "height", size);
  }
  return element;
}

export function skeletonLine(width = "100%"): HTMLElement {
  return createSkeleton("skeleton-line", width);
}

export function skeletonBlock(height = "88px"): HTMLElement {
  return createSkeleton("skeleton-block", height);
}

export function skeletonCard(): HTMLElement {
  const card = document.createElement("div");
  card.className = "skeleton-card";
  card.setAttribute("aria-hidden", "true");
  card.append(skeletonLine("42%"), skeletonLine("76%"), skeletonBlock("72px"));
  return card;
}

export function skeletonColumn(): HTMLElement {
  const column = document.createElement("section");
  column.className = "skeleton-column";
  column.setAttribute("aria-hidden", "true");
  column.append(skeletonLine("38%"), skeletonCard(), skeletonCard(), skeletonCard());
  return column;
}
