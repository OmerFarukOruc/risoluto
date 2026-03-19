import { createEmptyState } from "../components/empty-state";

export function createGitPage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page fade-in";

  const header = document.createElement("section");
  header.className = "mc-strip";
  header.innerHTML = `
    <div>
      <h1 class="page-title">Git & Pull Requests</h1>
      <p class="page-subtitle">Track branches, pull requests, and git operations managed by the orchestrator.</p>
    </div>
  `;

  const summaryStrip = document.createElement("div");
  summaryStrip.className = "summary-strip";
  const stats = [
    { label: "Active branches", value: "0" },
    { label: "Open PRs", value: "0" },
    { label: "Merged today", value: "0" },
    { label: "Failed ops", value: "0" },
  ];
  for (const stat of stats) {
    const item = document.createElement("div");
    item.className = "summary-strip-item";
    item.innerHTML = `<span class="summary-strip-label">${stat.label}</span><span class="summary-strip-value">${stat.value}</span>`;
    summaryStrip.append(item);
  }

  const body = document.createElement("section");
  body.style.padding = "var(--space-5)";
  body.append(
    createEmptyState(
      "No git activity",
      "Git operations and pull requests will appear here as issues are processed.",
      undefined,
      undefined,
      "default",
    ),
  );

  page.append(header, summaryStrip, body);
  return page;
}
