import { createEmptyState } from "../components/empty-state";

export function createNotificationsPage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page fade-in";

  const header = document.createElement("section");
  header.innerHTML = `
    <div>
      <h1 class="page-title">Notifications</h1>
      <p class="page-subtitle">Webhook deliveries, system alerts, and operator notifications in one timeline.</p>
    </div>
  `;
  header.className = "mc-strip";

  const filterBar = document.createElement("div");
  filterBar.className = "filter-bar";
  const channels = ["All", "Slack", "System", "Alerts"];
  for (const ch of channels) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `filter-chip${ch === "All" ? " is-active" : ""}`;
    chip.textContent = ch;
    chip.addEventListener("click", () => {
      filterBar.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
    });
    filterBar.append(chip);
  }

  const body = document.createElement("section");
  body.style.padding = "var(--space-5)";
  body.append(
    createEmptyState(
      "No notifications",
      "Notifications will appear here when webhooks fire or system alerts trigger.",
      undefined,
      undefined,
      "events",
    ),
  );

  page.append(header, filterBar, body);
  return page;
}
