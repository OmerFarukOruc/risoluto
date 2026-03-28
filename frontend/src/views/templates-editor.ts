import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { html } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";

export interface TemplateEditorOptions {
  parent: HTMLElement;
  initialValue: string;
  onChange: (value: string) => void;
}

export interface TemplateEditor {
  view: EditorView;
  getValue: () => string;
  setValue: (value: string) => void;
  destroy: () => void;
}

export function createTemplateEditor(options: TemplateEditorOptions): TemplateEditor {
  const isDark = document.documentElement.dataset.theme === "dark";

  const extensions = [
    basicSetup,
    html(),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        options.onChange(update.state.doc.toString());
      }
    }),
  ];

  if (isDark) {
    extensions.push(oneDark);
  }

  const view = new EditorView({
    state: EditorState.create({
      doc: options.initialValue,
      extensions,
    }),
    parent: options.parent,
  });

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue: (value: string) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    },
    destroy: () => view.destroy(),
  };
}
