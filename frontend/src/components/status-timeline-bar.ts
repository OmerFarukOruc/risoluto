/**
 * Status timeline bar — honest progress signal for an issue.
 *
 * In-flight states never show partial fills (we don't know total duration).
 * Terminal states show a solid bar because the outcome is known.
 *
 *   running / retrying / claimed → indeterminate stripe shimmer
 *   blocked                       → static danger stripe
 *   queued                        → empty grey track
 *   completed                     → full green bar
 *   cancelled                     → split (run portion + cancel portion)
 */

type TimelineStatus = "running" | "retrying" | "claimed" | "blocked" | "queued" | "completed" | "cancelled" | string;

export function createStatusTimelineBar(status: TimelineStatus): HTMLElement {
  const bar = document.createElement("span");
  bar.className = "status-timeline";
  bar.dataset.status = status;
  bar.setAttribute("aria-hidden", "true");

  if (status === "completed") {
    bar.classList.add("is-terminal", "is-completed");
    return bar;
  }
  if (status === "cancelled") {
    bar.classList.add("is-terminal", "is-cancelled");
    const ran = document.createElement("span");
    ran.className = "status-timeline-ran";
    const cancelled = document.createElement("span");
    cancelled.className = "status-timeline-cancelled";
    bar.append(ran, cancelled);
    return bar;
  }
  if (status === "queued") {
    bar.classList.add("is-empty");
    return bar;
  }
  if (status === "blocked") {
    bar.classList.add("is-blocked");
    return bar;
  }
  // running / retrying / claimed — indeterminate shimmer
  bar.classList.add("is-live");
  return bar;
}
