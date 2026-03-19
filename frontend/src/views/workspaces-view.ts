import { createEmptyState } from "../components/empty-state";

export function createWorkspacesPage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page fade-in";

  const header = document.createElement("section");
  header.className = "mc-strip";
  header.innerHTML = `
    <div>
      <h1 class="page-title">Workspaces</h1>
      <p class="page-subtitle">Manage agent workspaces — monitor disk usage, inspect workspace state, and trigger cleanup.</p>
    </div>
  `;

  const summaryStrip = document.createElement("div");
  summaryStrip.className = "summary-strip";
  const stats = [
    { label: "Total", value: "0" },
    { label: "Active", value: "0" },
    { label: "Stale", value: "0" },
    { label: "Disk usage", value: "0 B" },
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
      "No workspaces",
      "Workspaces are created automatically when the orchestrator processes issues.",
      undefined,
      undefined,
      "queue",
    ),
  );

  page.append(header, summaryStrip, body);
  return page;
}
