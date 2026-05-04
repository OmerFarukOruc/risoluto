import { api } from "../api";
import { router } from "../router";
import { getRuntimeClient } from "../state/runtime-client";
import type { AppState } from "../state/store";
import { createIcon } from "./icons";
import { MOBILE_BREAKPOINT } from "./breakpoints.js";
import { toggleTheme } from "./theme";
import { toast } from "./toast";
import { createIconButton } from "./buttons.js";
import {
  computeHeaderStatusCounts,
  totalHeaderStatusCount,
  type HeaderStatusCounts,
  type HeaderStatusKey,
} from "./header-status.js";

type SidebarStateDetail = {
  mobile: boolean;
  mobileOpen: boolean;
};

interface HeaderStatusDescriptor {
  key: HeaderStatusKey;
  label: string;
  modifier: string;
}

const STATUS_DESCRIPTORS: readonly HeaderStatusDescriptor[] = [
  { key: "running", label: "Running", modifier: "is-running" },
  { key: "queued", label: "Queued", modifier: "is-queued" },
  { key: "retrying", label: "Retrying", modifier: "is-retrying" },
];

let sidebarStateHandler: ((event: Event) => void) | null = null;

export function getHeaderNavButtonState(detail: SidebarStateDetail): {
  visible: boolean;
  title: string;
  ariaExpanded: string;
} {
  return {
    visible: detail.mobile,
    title: detail.mobileOpen ? "Close navigation" : "Open navigation",
    ariaExpanded: String(detail.mobileOpen),
  };
}

function createZoneSeparator(): HTMLElement {
  const separator = document.createElement("div");
  separator.className = "header-zone-separator";
  return separator;
}

function syncHeaderNavButton(headerEl: HTMLElement, navButton: HTMLButtonElement, detail: SidebarStateDetail): void {
  const state = getHeaderNavButtonState(detail);
  navButton.classList.toggle("is-active", detail.mobileOpen);
  navButton.title = state.title;
  navButton.setAttribute("aria-label", state.title);
  navButton.setAttribute("aria-expanded", state.ariaExpanded);

  if (state.visible) {
    if (navButton.parentElement !== headerEl) {
      headerEl.prepend(navButton);
    }
    return;
  }

  navButton.remove();
}

function createHeaderStatusStrip(): {
  element: HTMLElement;
  update: (counts: HeaderStatusCounts) => void;
} {
  const strip = document.createElement("div");
  strip.className = "header-status-strip";
  strip.setAttribute("role", "group");
  strip.setAttribute("aria-label", "Live queue counts");

  const chips = new Map<HeaderStatusKey, { chip: HTMLButtonElement; count: HTMLElement }>();
  for (const descriptor of STATUS_DESCRIPTORS) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `header-status-chip ${descriptor.modifier}`;
    const dot = document.createElement("span");
    dot.className = "header-status-dot";
    dot.setAttribute("aria-hidden", "true");
    const count = document.createElement("span");
    count.className = "header-status-count";
    count.textContent = "0";
    chip.append(dot, count);
    chip.addEventListener("click", () => {
      router.navigate("/queue");
    });
    strip.append(chip);
    chips.set(descriptor.key, { chip, count });
  }

  const update = (counts: HeaderStatusCounts): void => {
    strip.hidden = totalHeaderStatusCount(counts) === 0;
    for (const descriptor of STATUS_DESCRIPTORS) {
      const entry = chips.get(descriptor.key);
      if (!entry) continue;
      const value = counts[descriptor.key];
      entry.count.textContent = String(value);
      entry.chip.classList.toggle("is-empty", value === 0);
      entry.chip.title = `${descriptor.label}: ${value}`;
      entry.chip.setAttribute("aria-label", `${descriptor.label}: ${value}`);
    }
  };

  update({ running: 0, queued: 0, retrying: 0 });
  return { element: strip, update };
}

function createNotificationBell(): {
  element: HTMLButtonElement;
  setUnread: (count: number) => void;
} {
  const bell = createIconButton({
    iconName: "notifications",
    label: "Notifications",
    className: "header-action-btn header-bell",
  });
  const badge = document.createElement("span");
  badge.className = "header-bell-badge";
  badge.hidden = true;
  bell.append(badge);
  bell.addEventListener("click", () => {
    router.navigate("/notifications");
  });

  const setUnread = (count: number): void => {
    const safe = Math.max(0, Math.floor(count));
    badge.hidden = safe === 0;
    badge.textContent = safe > 99 ? "99+" : String(safe);
    bell.classList.toggle("has-unread", safe > 0);
    bell.title = safe === 0 ? "Notifications" : `Notifications (${safe} unread)`;
    bell.setAttribute("aria-label", bell.title);
  };

  setUnread(0);
  return { element: bell, setUnread };
}

async function refreshUnreadCount(setUnread: (count: number) => void): Promise<void> {
  try {
    const result = await api.getNotifications({ unread: true, limit: 1 });
    setUnread(result.unreadCount ?? 0);
  } catch {
    // Silent — header should never crash on transient API failures.
  }
}

export function initHeader(headerEl: HTMLElement): void {
  headerEl.replaceChildren();

  const navButton = createIconButton({
    iconName: "menu",
    label: "Open navigation",
    iconSize: 18,
    className: ["header-action-btn", "shell-nav-toggle"],
  });
  navButton.setAttribute("aria-controls", "shell-sidebar");
  navButton.setAttribute("aria-expanded", "false");
  navButton.addEventListener("click", () => {
    globalThis.dispatchEvent(new CustomEvent("shell:toggle-sidebar"));
  });

  if (sidebarStateHandler) {
    globalThis.removeEventListener("shell:sidebar-state", sidebarStateHandler);
  }

  sidebarStateHandler = (event) => {
    const detail = (event as CustomEvent<SidebarStateDetail>).detail;
    syncHeaderNavButton(headerEl, navButton, detail);
  };
  globalThis.addEventListener("shell:sidebar-state", sidebarStateHandler);

  const brand = document.createElement("div");
  brand.className = "header-brand";
  const brandIcon = document.createElement("span");
  brandIcon.className = "header-brand-icon";
  brandIcon.append(createIcon("planner", { size: 20 }));
  const titleSpan = document.createElement("span");
  titleSpan.className = "header-brand-name";
  titleSpan.textContent = "Risoluto";
  const badgeSpan = document.createElement("span");
  badgeSpan.className = "mc-badge header-env-badge";
  const dot = document.createElement("span");
  dot.className = "status-dot status-dot--local";
  dot.textContent = "●";
  const envLabel = document.createElement("span");
  envLabel.className = "header-env-label";
  envLabel.textContent = "LOCAL";
  badgeSpan.append(dot, envLabel);
  badgeSpan.title =
    "Local mode — Risoluto is running on your machine. Issues are processed in sandboxed Docker containers for security.";
  brand.append(brandIcon, titleSpan, badgeSpan);

  const command = document.createElement("div");
  command.className = "header-command";
  const commandButton = document.createElement("button");
  commandButton.type = "button";
  commandButton.className = "mc-button is-command header-command-trigger";
  const searchIcon = document.createElement("span");
  searchIcon.className = "mc-button-icon header-command-icon";
  searchIcon.append(createIcon("search", { size: 16 }));
  const cmdLabel = document.createElement("span");
  cmdLabel.className = "header-command-label";
  cmdLabel.textContent = "Search pages, issues, actions…";
  const cmdHint = document.createElement("span");
  cmdHint.className = "mc-button-hint header-command-hint";
  cmdHint.textContent = "Ctrl K";
  commandButton.append(searchIcon, cmdLabel, cmdHint);
  commandButton.addEventListener("click", () => {
    globalThis.dispatchEvent(new CustomEvent("palette:open"));
  });
  command.append(commandButton);

  const status = createHeaderStatusStrip();

  const actions = document.createElement("div");
  actions.className = "header-actions";

  const refreshButton = createIconButton({
    iconName: "refresh",
    label: "Refresh orchestrator state",
    className: "header-action-btn",
  });

  const bell = createNotificationBell();

  const themeButton = createIconButton({
    iconName: "theme",
    label: "Toggle color theme",
    className: "header-action-btn",
  });

  refreshButton.addEventListener("click", async () => {
    refreshButton.disabled = true;
    refreshButton.classList.add("is-disabled", "is-busy");
    try {
      await api.postRefresh();
      toast("Refresh queued.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Refresh failed.", "error");
    }
    globalThis.setTimeout(() => {
      refreshButton.disabled = false;
      refreshButton.classList.remove("is-disabled", "is-busy");
    }, 500);
  });

  themeButton.addEventListener("click", () => {
    const next = toggleTheme();
    toast(`Theme: ${next}`, "info");
  });

  actions.append(refreshButton, bell.element, themeButton);
  headerEl.append(brand, createZoneSeparator(), command, status.element, createZoneSeparator(), actions);

  const runtimeClient = getRuntimeClient();
  const onState = (appState: AppState): void => {
    status.update(computeHeaderStatusCounts(appState.snapshot));
    void refreshUnreadCount(bell.setUnread);
  };
  runtimeClient.subscribeState(onState);
  status.update(computeHeaderStatusCounts(runtimeClient.getAppState().snapshot));
  void refreshUnreadCount(bell.setUnread);

  syncHeaderNavButton(headerEl, navButton, {
    mobile: globalThis.matchMedia(MOBILE_BREAKPOINT).matches,
    mobileOpen: false,
  });
}
