"use client";

import { gdHallFontFaceCss } from "@magick-components/gd/hall";
import type { Editor } from "@tiptap/core";
import { closeHistory, redoNoScroll, undoNoScroll } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Command } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import { useCallback, useMemo } from "react";
import { gdHallArt } from "@/app/gd/hall/art";
import { GD_HALL_FONT_BASE } from "@/app/gd/hall/fontBase";
import { GdHallEditor } from "../gdHallEditor/GdHallEditor";
import type { HallElement } from "../gdHallEditor/hallModel";
import { ritualEditorOwner } from "../ritualEditorOwner";
import { validateRitualSemantic } from "../semantic";

const fontFaces = gdHallFontFaceCss(GD_HALL_FONT_BASE);

/** Props of the ritual editor's hall editor. */
export interface GdHallAtomEditorProps {
  editor: Editor;
  /** The atom's node view position. */
  getPos: () => number | undefined;
  node: ProseMirrorNode;
  onDone: () => void;
  /** Where the focus goes on arriving (the badge asks for the warnings). */
  initialFocus?: "drawing" | "warnings";
}

/**
 * The semantic hall an atom holds: its ID, attributes and children, as
 * `semanticFromTiptap` reads them back.
 */
export function hallOfAtom(attrs: Record<string, unknown>): HallElement {
  return {
    kind: "element",
    id: String(attrs.id),
    tag: "gdHall",
    attrs: (attrs.attrs ?? {}) as HallElement["attrs"],
    ...(attrs.children == null
      ? {}
      : { children: attrs.children as HallElement["children"] }),
  };
}

/** Whether the ritual editor takes changes: it, and the ritual it projects. */
const takesChanges = (editor: Editor) =>
  editor.isEditable && ritualEditorOwner(editor).isEditable;

/** The same JSON, as attributes compare after a write. */
const sameJson = (a: unknown, b: unknown) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Writes a hall back into its atom as one undo step: one `setNodeMarkup`,
 * the atom's ID kept, history closed before and after, so neither typing
 * before it nor the next gesture joins it. Refuses (returns false) when
 * the editor takes no changes, the atom has moved or changed identity, or
 * the hall would not be valid source; and returns false when the write
 * did not reach the document (a plugin's `filterTransaction` dropped it),
 * so the hall editor does not show a hall the ritual does not have.
 */
export function writeHallToAtom(
  editor: Editor,
  pos: number | undefined,
  id: string,
  next: HallElement,
): boolean {
  if (typeof pos !== "number" || !takesChanges(editor)) return false;
  const current = editor.state.doc.nodeAt(pos);
  if (
    !current ||
    current.type.name !== "ritualAtom" ||
    current.attrs.tag !== "gdHall" ||
    current.attrs.id !== id ||
    next.id !== id
  )
    return false;
  if (
    validateRitualSemantic({
      format: "magickli-ritual",
      version: 1,
      nodes: [next],
    }).length
  )
    return false;
  const children = next.children ?? null;
  editor.view.dispatch(
    closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, {
      ...current.attrs,
      attrs: next.attrs,
      children,
    }),
  );
  const written = editor.state.doc.nodeAt(pos);
  if (
    written?.attrs.id !== id ||
    !sameJson(written.attrs.attrs, next.attrs) ||
    !sameJson(written.attrs.children, children)
  )
    return false;
  editor.view.dispatch(
    closeHistory(editor.state.tr).setMeta("addToHistory", false),
  );
  return true;
}

/**
 * The visual hall editor in a ritual's hall atom (plan 061, decision 11):
 * the app's art, the ritual editor's history for undo and redo, and edits
 * paused while the editor takes no changes (the source is being synced,
 * a save is running). Loaded only when an author edits a hall.
 */
export default function GdHallAtomEditor({
  editor,
  getPos,
  node,
  onDone,
  initialFocus,
}: GdHallAtomEditorProps) {
  const hall = useMemo(() => hallOfAtom(node.attrs), [node.attrs]);
  // A footnote's editor projects the ritual's: both must take changes,
  // and either may stop.
  const ownEditable = useEditorState({
    editor,
    selector: ({ editor: current }) => current.isEditable,
  });
  const ritualEditable = useEditorState({
    editor: ritualEditorOwner(editor),
    selector: ({ editor: current }) => current.isEditable,
  });
  const onChange = useCallback(
    (next: HallElement) => writeHallToAtom(editor, getPos(), hall.id, next),
    [editor, getPos, hall.id],
  );
  /**
   * The ritual editor's undo or redo, while it takes changes, without
   * scrolling the ritual to its caret: the author is looking at the hall.
   */
  const history = (command: Command) => () => {
    if (takesChanges(editor)) command(editor.state, editor.view.dispatch);
  };
  return (
    <>
      <style href="gd-hall-fonts" precedence="default">
        {fontFaces}
      </style>
      <GdHallEditor
        hall={hall}
        art={gdHallArt}
        editable={ownEditable && ritualEditable}
        onChange={onChange}
        onDone={onDone}
        initialFocus={initialFocus}
        onUndo={history(undoNoScroll)}
        onRedo={history(redoNoScroll)}
      />
    </>
  );
}
