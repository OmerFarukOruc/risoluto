import type { WorkflowColumn } from "../types/runtime.js";

export interface BulkToolbarOptions {
  getColumns: () => readonly WorkflowColumn[];
  getSelectedCount: () => number;
  onBulkMove: (targetColumnKey: string) => void;
  onClear: () => void;
}

export interface BulkToolbarHandle {
  element: HTMLElement;
  sync: () => void;
}

const START_PRIORITIES: ReadonlyArray<{ key?: string; kind?: WorkflowColumn["kind"] }> = [
  { key: "in_progress" },
  { kind: "active" },
];
const BLOCK_PRIORITIES: ReadonlyArray<{ key?: string; kind?: WorkflowColumn["kind"] }> = [
  { key: "blocked" },
  { kind: "gate" },
];
const DONE_PRIORITIES: ReadonlyArray<{ key?: string; kind?: WorkflowColumn["kind"] }> = [
  { key: "done" },
  { key: "completed" },
  { kind: "terminal" },
];

function findColumnKey(
  columns: readonly WorkflowColumn[],
  candidates: ReadonlyArray<{ key?: string; kind?: WorkflowColumn["kind"] }>,
): string | null {
  for (const candidate of candidates) {
    for (const column of columns) {
      if (candidate.key && column.key.toLowerCase() === candidate.key) return column.key;
      if (candidate.kind && column.kind === candidate.kind) return column.key;
    }
  }
  return null;
}

function makeAction(label: string, glyph: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mc-bulk-action";
  const glyphEl = document.createElement("span");
  glyphEl.setAttribute("aria-hidden", "true");
  glyphEl.textContent = glyph;
  const text = document.createElement("span");
  text.textContent = label;
  button.append(glyphEl, text);
  button.addEventListener("click", onClick);
  return button;
}

function makeSep(): HTMLElement {
  const span = document.createElement("span");
  span.className = "mc-bulk-sep";
  span.setAttribute("aria-hidden", "true");
  return span;
}

export function createBulkToolbar(options: BulkToolbarOptions): BulkToolbarHandle {
  const element = document.createElement("div");
  element.className = "mc-bulk";
  element.setAttribute("role", "toolbar");
  element.setAttribute("aria-label", "Bulk actions");
  element.hidden = true;

  const count = document.createElement("span");
  count.className = "mc-bulk-count";

  const tryMove = (selectors: ReadonlyArray<{ key?: string; kind?: WorkflowColumn["kind"] }>): (() => void) => {
    return (): void => {
      const target = findColumnKey(options.getColumns(), selectors);
      if (!target) return;
      options.onBulkMove(target);
    };
  };

  const startBtn = makeAction("Start", "⚡", tryMove(START_PRIORITIES));
  const blockBtn = makeAction("Block", "⛔", tryMove(BLOCK_PRIORITIES));
  const doneBtn = makeAction("Mark done", "✓", tryMove(DONE_PRIORITIES));
  const archiveBtn = makeAction("Archive", "▸", () => options.onClear());
  const clearBtn = makeAction("Clear", "✕", () => options.onClear());

  element.append(count, makeSep(), startBtn, blockBtn, doneBtn, archiveBtn, makeSep(), clearBtn);

  let lastCount = -1;
  function sync(): void {
    const selected = options.getSelectedCount();
    if (selected === lastCount) return;
    lastCount = selected;
    element.hidden = selected === 0;
    count.textContent = `${selected} selected`;
  }

  sync();
  return { element, sync };
}
