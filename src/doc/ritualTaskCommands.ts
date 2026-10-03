import type { Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { Selection } from "@tiptap/pm/state";
import { RITUAL_SETTINGS_CHANGE } from "./ritualEditorHistory";
import { ritualEditorOwner } from "./ritualEditorOwner";
import { createRitualNodeId } from "./ritualNodeIds";
import { validateRitualSemantic } from "./semantic";

/** Passed through footnote projections so the canonical toolbar can offer Undo. */
export const RITUAL_TASK_DELETED = "magickli:task-deleted";

/** Construct one validated task for toolbar and slash insertion. */
export function ritualTaskContent(mode: "say" | "do", role: string) {
  const id = createRitualNodeId();
  const attrs = { [mode]: true, role };
  if (
    validateRitualSemantic({
      format: "magickli-ritual",
      version: 1,
      nodes: [{ kind: "element", id, tag: "task", attrs, children: [] }],
    }).length
  )
    return null;
  return {
    type: "ritualTask",
    attrs: { id, tag: "task", attrs },
    content: [{ type: "paragraph" }],
  };
}

/** Delete by stable identity, as its own canonical history step. */
export function deleteRitualTask(editor: Editor, id: string): boolean {
  if (
    editor.isDestroyed ||
    !editor.isEditable ||
    !ritualEditorOwner(editor).isEditable
  )
    return false;
  let range: { from: number; to: number } | undefined;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "ritualTask" && node.attrs.id === id) {
      range = { from: pos, to: pos + node.nodeSize };
      return false;
    }
  });
  if (!range) return false;
  const tr = closeHistory(editor.state.tr).deleteRange(range.from, range.to);
  tr.setSelection(
    Selection.near(tr.doc.resolve(Math.min(range.from, tr.doc.content.size))),
  );
  editor.view.dispatch(
    tr.setMeta(RITUAL_SETTINGS_CHANGE, true).setMeta(RITUAL_TASK_DELETED, true),
  );
  editor.view.dispatch(
    closeHistory(editor.state.tr).setMeta("addToHistory", false),
  );
  editor.commands.focus();
  return true;
}
