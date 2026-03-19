import { createEmptyState } from "../components/empty-state";

export function createContainersPage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page fade-in";

  const header = document.createElement("section");
  header.className = "mc-strip";
  header.innerHTML = `
    <div>
      <h1 class="page-title">Containers</h1>
      <p class="page-subtitle">Monitor sandboxed agent containers — health, resource usage, and lifecycle events.</p>
    </div>
  `;

  const summaryStrip = document.createElement("div");
  summaryStrip.className = "summary-strip";
  const stats = [
    { label: "Running", value: "0" },
    { label: "Stopped", value: "0" },
    { label: "Errored", value: "0" },
    { label: "Avg CPU", value: "—" },
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
      "No containers",
      "Containers are provisioned when sandbox mode is enabled.",
      undefined,
      undefined,
      "default",
    ),
  );

  page.append(header, summaryStrip, body);
  return page;
}
