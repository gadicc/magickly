import type { HallPreset } from "@magick-components/gd/hall/presets";
import type { JSONContent } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import {
  type EditorState,
  NodeSelection,
  TextSelection,
  type Transaction,
} from "@tiptap/pm/state";
import { gdHallSource } from "./gdHallRows";
import { createRitualNodeId } from "./ritualNodeIds";
import { HALL_PARENT_TAGS } from "./semantic";

/** A preset's grade as the pickers show it: "0=0", or "1=10, part 1". */
export function gdHallPresetGrade(preset: HallPreset): string {
  return preset.part === undefined
    ? preset.grade
    : `${preset.grade}, part ${preset.part}`;
}

/**
 * Whether a hall may stand directly in this visual editor node: the
 * document, or a note, summary, list item or todo (`HALL_PARENT_TAGS`,
 * the validator's rule, which `RitualHallPlacement` also enforces).
 */
export function holdsGdHall(node: Node): boolean {
  return (
    node.type.name === "doc" ||
    (node.type.name === "ritualBlock" && HALL_PARENT_TAGS.has(node.attrs.tag))
  );
}

/**
 * The visual editor's atom for a copy of a preset (plan 061, decisions 3
 * and 10: presets are copied, never referenced). Every node of the copy
 * gets a fresh ID, through the same preset → semantic conversion the
 * source uses (`gdHallSource`).
 */
export function gdHallPresetAtom(
  preset: HallPreset,
  createId: () => string = createRitualNodeId,
): JSONContent {
  const hall = gdHallSource(preset.hall, createId);
  return {
    type: "ritualAtom",
    attrs: {
      id: hall.id,
      tag: "gdHall",
      attrs: hall.attrs,
      children: hall.children ?? null,
    },
  };
}

/**
 * Where the toolbar puts a new hall: after the block that holds the
 * cursor, at the nearest level where a hall may stand. In a task, a title
 * or a list that is after the task, title or list; in a note, after the
 * paragraph in the note. An empty paragraph where a hall may stand is
 * replaced. A selected block counts as the block that holds the cursor.
 */
export function gdHallInsertionRange(state: EditorState): {
  from: number;
  to: number;
} {
  const { selection } = state;
  const $pos = selection.$from;
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (!holdsGdHall($pos.node(depth))) continue;
    return rangeIn(state, depth);
  }
  return rangeIn(state, 0);
}

function rangeIn(state: EditorState, depth: number) {
  const { selection } = state;
  const $pos = selection.$from;
  if (depth === $pos.depth) {
    // The cursor stands between blocks of the container, or one of them
    // is selected.
    const at = selection instanceof NodeSelection ? selection.to : $pos.pos;
    return { from: at, to: at };
  }
  const block = $pos.node(depth + 1);
  if (
    depth + 1 === $pos.depth &&
    block.type.name === "paragraph" &&
    !block.content.size
  )
    return { from: $pos.before(depth + 1), to: $pos.after(depth + 1) };
  const at = $pos.after(depth + 1);
  return { from: at, to: at };
}

/**
 * Puts the caret after a hall just inserted at `pos`: at the start of the
 * paragraph that follows it, or in a new empty paragraph there, so typing
 * goes on after the hall. An empty paragraph between blocks, or at the end
 * of its container, adds nothing to the semantic document.
 *
 * Not a node selection of the hall: typing would replace it, and in
 * Chromium a hall selected as its node view mounts right after another
 * atom loses the selection to the start of the document (stage C notes).
 */
export function caretAfterGdHall(tr: Transaction, pos: number): Transaction {
  const hall = tr.doc.nodeAt(pos);
  if (!hall) return tr;
  const after = pos + hall.nodeSize;
  if (tr.doc.resolve(after).nodeAfter?.type.name !== "paragraph")
    tr.insert(after, tr.doc.type.schema.nodes.paragraph.create());
  return tr.setSelection(TextSelection.create(tr.doc, after + 1));
}
