import type { Editor } from "@tiptap/core";

const owners = new WeakMap<Editor, Editor>();

/** Projected footnote editors discover roles in their canonical ritual document. */
export function registerRitualEditorOwner(editor: Editor, owner: Editor) {
  owners.set(editor, owner);
  return () => {
    owners.delete(editor);
  };
}

export function ritualEditorOwner(editor: Editor): Editor {
  const owner = owners.get(editor);
  return owner ? ritualEditorOwner(owner) : editor;
}
