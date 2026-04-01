import { api } from "../api.js";
import { createEmptyState } from "../components/empty-state.js";
import { createPageHeader } from "../components/page-header.js";
import { router } from "../router.js";
import { skeletonCard } from "../ui/skeleton.js";
import type { RuntimeSnapshot } from "../types.js";

function buildLoadingSkeleton(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.append(skeletonCard());
  return wrapper;
}

function hasRunningIssues(snapshot: RuntimeSnapshot): boolean {
  return snapshot.running.length > 0 || snapshot.counts.running > 0;
}

function buildEmptyStateForSnapshot(snapshot: RuntimeSnapshot): HTMLElement {
  if (hasRunningIssues(snapshot)) {
    return createEmptyState(
      "Containers are active",
      "Agents are running in sandboxed containers. Head to Observability for live CPU and memory metrics while work is in progress.",
      "View observability",
      () => router.navigate("/observability"),
      "network",
      { headingLevel: "h2" },
    );
  }

  return createEmptyState(
    "No containers running",
    "This page shows container health and resource usage once agent workers start. Pick an issue from the board to launch a sandboxed container.",
    "Open board",
    () => router.navigate("/queue"),
    "default",
    { secondaryActionLabel: "View observability", secondaryActionHref: "/observability", headingLevel: "h2" },
  );
}

function buildFallbackEmptyState(onRetry: () => void): HTMLElement {
  return createEmptyState(
    "Could not load container status",
    "Something went wrong fetching container data. Check the server logs for details, or try refreshing.",
    "Retry",
    onRetry,
    "error",
    { headingLevel: "h2" },
  );
}

export function createContainersPage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page fade-in";

  const header = createPageHeader(
    "Containers",
    "Monitor sandboxed agent containers — health, resource usage, and lifecycle events.",
  );

  const body = document.createElement("section");
  body.className = "page-body";
  body.append(buildLoadingSkeleton());

  page.append(header, body);

  async function fetchAndRender(): Promise<void> {
    try {
      const snapshot = await api.getState();
      body.replaceChildren(buildEmptyStateForSnapshot(snapshot));
    } catch {
      body.replaceChildren(buildFallbackEmptyState(() => void fetchAndRender()));
    }
  }

  void fetchAndRender();

  return page;
}
