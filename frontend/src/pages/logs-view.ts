import { createLogRow } from "../components/log-row";
import { createEmptyState } from "../components/empty-state";
import { registerPageCleanup } from "../utils/page";
import { eventMatchesSearch, eventTypeLabel } from "../utils/events";
import type { RecentEvent } from "../types";
import { loadArchiveLogs, loadLiveLogs } from "./logs-data";
import { stringifyPayload } from "../utils/events";
import { createIconButton } from "../ui/buttons.js";
import { createIcon } from "../ui/icons.js";
import { subscribeIssueLifecycle, subscribeAllEvents } from "../state/event-source.js";
import type { AgentEventPayload } from "../state/event-source.js";
import { createLogBuffer } from "../state/log-buffer.js";

type Mode = "live" | "archive";
type Density = "compact" | "comfortable";

function makeIconBtn(iconName: Parameters<typeof createIconButton>[0]["iconName"], label: string): HTMLButtonElement {
  return createIconButton({
    iconName,
    label,
    iconSize: 15,
    className: "logs-icon-btn",
  });
}

export function createLogsPage(id: string): HTMLElement {
  const page = document.createElement("div");
  page.className = "page logs-page fade-in";

  // ── Header: breadcrumb + mode tabs ───────────────────────────────────────
  const header = document.createElement("div");
  header.className = "logs-header";

  const breadcrumb = document.createElement("div");
  breadcrumb.className = "logs-breadcrumb text-secondary";

  const modeSegment = document.createElement("div");
  modeSegment.className = "mc-button-segment";
  const liveBtn = document.createElement("button");
  liveBtn.type = "button";
  liveBtn.className = "mc-button is-sm logs-live-btn";
  liveBtn.textContent = "Live";
  const archiveBtn = document.createElement("button");
  archiveBtn.type = "button";
  archiveBtn.className = "mc-button is-sm";
  archiveBtn.textContent = "History";
  modeSegment.append(liveBtn, archiveBtn);
  header.append(breadcrumb, modeSegment);

  // ── Filter bar: type chips + search + view icon buttons ──────────────────
  const controls = document.createElement("section");
  controls.className = "logs-control";

  const typeBar = document.createElement("div");
  typeBar.className = "logs-toolbar-group";
  const search = Object.assign(document.createElement("input"), {
    className: "mc-input logs-search",
    placeholder: "Search logs",
  });

  const sortToggle = makeIconBtn("sort", "Sort order");
  const autoToggle = makeIconBtn("scrollDown", "Follow live");
  const expandToggle = makeIconBtn("unfold", "Expand payloads");
  const densityToggle = makeIconBtn("dense", "Compact");

  const copyAllBtn = makeIconBtn("copy", "Copy all logs");

  const viewActions = document.createElement("div");
  viewActions.className = "logs-view-actions";
  viewActions.append(sortToggle, densityToggle, autoToggle, expandToggle, copyAllBtn);
  controls.append(typeBar, search, viewActions);

  // ── Log scroll area ───────────────────────────────────────────────────────
  const scroll = document.createElement("section");
  scroll.className = "logs-scroll";

  const indicator = document.createElement("button");
  indicator.type = "button";
  indicator.className = "mc-button is-ghost logs-new-indicator";
  indicator.hidden = true;
  indicator.textContent = "↓ New events";
  indicator.addEventListener("click", () => {
    scroll.scrollTop = scroll.scrollHeight;
    newEventCount = 0;
    indicator.hidden = true;
  });

  page.append(header, controls, scroll, indicator);

  // ── State ─────────────────────────────────────────────────────────────────
  let mode: Mode = "live";
  const activeFilters = new Set<string>();
  let searchText = "";
  let autoScroll = false;
  let density: Density = "compact";
  let data: { title: string; issueId: string; events: RecentEvent[] } = { title: "Loading…", issueId: id, events: [] };
  let timer = 0;
  let unsubscribeLifecycle: (() => void) | null = null;
  let unsubscribeAllEvents: (() => void) | null = null;
  const expandedEvents = new Set<string>();
  let newEventCount = 0;
  const buffer = createLogBuffer("desc");

  function filtered(): RecentEvent[] {
    return buffer.events().filter((event) => {
      const matchesType = activeFilters.size === 0 || activeFilters.has(event.event);
      return matchesType && eventMatchesSearch(event, searchText);
    });
  }

  function renderTypeFilters(): void {
    const eventTypes = [...new Set(buffer.events().map((event) => event.event))];

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = `mc-chip is-interactive${activeFilters.size === 0 ? " is-active" : ""}`;
    allBtn.textContent = "All";
    allBtn.addEventListener("click", () => {
      activeFilters.clear();
      renderTypeFilters();
      render();
    });

    const chips = eventTypes.map((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mc-chip is-interactive${activeFilters.has(value) ? " is-active" : ""}`;
      button.textContent = eventTypeLabel(value);
      button.addEventListener("click", () => {
        if (activeFilters.has(value)) {
          activeFilters.delete(value);
        } else {
          activeFilters.add(value);
        }
        renderTypeFilters();
        render();
      });
      return button;
    });

    typeBar.replaceChildren(allBtn, ...chips);
  }

  function render(): void {
    breadcrumb.textContent = `Queue → ${data.issueId} → Logs`;
    liveBtn.classList.toggle("is-active", mode === "live");
    archiveBtn.classList.toggle("is-active", mode === "archive");
    autoToggle.classList.toggle("is-active", autoScroll);
    densityToggle.classList.toggle("is-active", density === "compact");
    expandToggle.classList.toggle("is-active", expandedEvents.size > 0);
    sortToggle.classList.toggle("is-flipped", buffer.direction() === "asc");
    scroll.classList.toggle("is-compact", density === "compact");
    scroll.classList.toggle("is-comfortable", density === "comfortable");
    renderTypeFilters();
    const events = filtered();
    if (events.length === 0) {
      scroll.replaceChildren(
        createEmptyState(
          mode === "live" ? "No activity yet" : "No archived events recorded",
          mode === "live"
            ? "Waiting for the worker to start."
            : "Switch back to live mode to watch the current stream.",
          mode === "live" ? "Refresh logs" : "Switch to live logs",
          () => {
            if (mode === "live") {
              void refresh(true);
              return;
            }
            mode = "live";
            render();
            restartPolling();
            void refresh(true);
          },
        ),
      );
      return;
    }
    const total = events.length;
    scroll.replaceChildren(
      ...events.map((event, index) => {
        const key = `${event.at}:${event.event}:${event.message}`;
        const row = createLogRow({
          event,
          expanded: expandedEvents.has(key),
          highlightedText: searchText,
          onToggle: () => {
            if (expandedEvents.has(key)) expandedEvents.delete(key);
            else expandedEvents.add(key);
            render();
          },
        });
        // Only animate the last 30 rows (most recent, visible after auto-scroll).
        // With 24ms stagger a raw index on 1000+ events → multi-second delays.
        const staggerPos = index - (total - 30);
        if (staggerPos >= 0) {
          row.classList.add("timeline-enter");
          row.style.setProperty("--stagger-index", String(staggerPos));
        }
        return row;
      }),
    );
    if (autoScroll) {
      scroll.scrollTop = scroll.scrollHeight;
    }
  }

  function appendSingleEvent(event: RecentEvent): void {
    if (!buffer.insert(event)) return;
    const matchesType = activeFilters.size === 0 || activeFilters.has(event.event);
    if (!matchesType || !eventMatchesSearch(event, searchText)) return;
    const key = `${event.at}:${event.event}:${event.message}`;
    const row = createLogRow({
      event,
      expanded: expandedEvents.has(key),
      highlightedText: searchText,
      onToggle: () => {
        if (expandedEvents.has(key)) expandedEvents.delete(key);
        else expandedEvents.add(key);
        render();
      },
    });
    row.classList.add("timeline-enter");
    if (buffer.direction() === "desc") {
      scroll.prepend(row);
    } else {
      scroll.append(row);
    }
    if (autoScroll) {
      scroll.scrollTop = scroll.scrollHeight;
    } else if (!indicator.hidden) {
      newEventCount += 1;
      indicator.textContent = `↓ ${newEventCount} new`;
    }
  }

  async function refresh(force = false): Promise<void> {
    const prevSize = buffer.size();
    data = mode === "live" ? await loadLiveLogs(id) : await loadArchiveLogs(id);
    buffer.load(data.events);
    const added = Math.max(0, buffer.size() - prevSize);
    const changed = force || added > 0;
    if (changed) {
      if (!autoScroll && added > 0 && !indicator.hidden) {
        newEventCount += added;
        indicator.textContent = `↓ ${newEventCount} new`;
      }
      render();
    }
  }

  function restartPolling(): void {
    window.clearInterval(timer);
    unsubscribeLifecycle?.();
    unsubscribeLifecycle = null;
    unsubscribeAllEvents?.();
    unsubscribeAllEvents = null;
    if (mode === "live") {
      timer = window.setInterval(() => {
        void refresh();
      }, 10_000);
      unsubscribeLifecycle = subscribeIssueLifecycle(id, () => void refresh());
      unsubscribeAllEvents = subscribeAllEvents((eventData) => {
        const payload = eventData.payload as AgentEventPayload | undefined;
        if (!payload || payload.identifier !== id) return;
        appendSingleEvent({
          at: payload.timestamp ?? new Date().toISOString(),
          issue_id: payload.issueId,
          issue_identifier: payload.identifier,
          session_id: payload.sessionId,
          event: payload.type,
          message: payload.message,
          content: payload.content ?? null,
        });
      });
    }
  }

  sortToggle.addEventListener("click", () => {
    buffer.setDirection(buffer.direction() === "desc" ? "asc" : "desc");
    render();
  });
  liveBtn.addEventListener("click", () => {
    if (mode === "live") return;
    mode = "live";
    render();
    restartPolling();
    void refresh(true);
  });
  archiveBtn.addEventListener("click", () => {
    if (mode === "archive") return;
    mode = "archive";
    render();
    restartPolling();
    void refresh(true);
  });
  autoToggle.addEventListener("click", () => {
    autoScroll = !autoScroll;
    render();
  });
  densityToggle.addEventListener("click", () => {
    density = density === "compact" ? "comfortable" : "compact";
    render();
  });
  expandToggle.addEventListener("click", () => {
    if (expandedEvents.size > 0) {
      expandedEvents.clear();
    } else {
      for (const event of filtered()) {
        if (stringifyPayload(event.content)) {
          expandedEvents.add(`${event.at}:${event.event}:${event.message}`);
        }
      }
    }
    render();
  });
  copyAllBtn.addEventListener("click", () => {
    const events = filtered();
    if (events.length === 0) return;
    const lines = events.map((event) => {
      const payload = stringifyPayload(event.content);
      const header = `[${event.at}] [${event.event}] ${event.message}`;
      return payload ? `${header}\n${payload}` : header;
    });
    const text = lines.join("\n\n");
    navigator.clipboard.writeText(text).then(
      () => {
        copyAllBtn.textContent = "✓";
        setTimeout(() => {
          copyAllBtn.textContent = "";
          copyAllBtn.append(createIcon("copy", { size: 15 }));
        }, 1200);
      },
      () => undefined,
    );
  });
  search.addEventListener("input", () => {
    searchText = search.value;
    render();
  });
  scroll.addEventListener("scroll", () => {
    const nearBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 24;
    indicator.hidden = nearBottom || autoScroll;
    if (nearBottom) {
      newEventCount = 0;
      indicator.textContent = "↓ New events";
    }
  });
  // Make the shell outlet non-scrolling so logs-scroll is the true scroll boundary
  const outlet = document.querySelector(".shell-outlet") as HTMLElement | null;
  if (outlet) {
    const prev = outlet.style.overflowY;
    outlet.style.overflowY = "hidden";
    registerPageCleanup(page, () => {
      outlet.style.overflowY = prev;
    });
  }

  void refresh();
  restartPolling();
  registerPageCleanup(page, () => {
    window.clearInterval(timer);
    unsubscribeLifecycle?.();
    unsubscribeAllEvents?.();
  });
  return page;
}
