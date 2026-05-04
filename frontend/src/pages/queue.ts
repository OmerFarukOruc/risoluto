import "../styles/queue.css";
import "../styles/issue.css";
import "../styles/issue-inspector-rail.css";
import "../styles/queue-dnd.css";
import "../styles/board-redesign.css";
import "../styles/queue-modes.css";

import { createQueuePage } from "./queue-view";

export function render(params?: Record<string, string>): HTMLElement {
  return createQueuePage(params);
}
