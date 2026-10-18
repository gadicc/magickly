"use client";

import { gdHallFontFaceCss } from "@magick-components/gd/hall";
import type { Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
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

/**
 * Writes a hall back into its atom as one undo step: one `setNodeMarkup`,
 * the atom's ID kept, history closed before and after, so neither typing
 * before it nor the next gesture joins it. Refuses (returns false) when
 * the atom has moved or changed identity, or the hall would not be valid
 * source.
 */
export function writeHallToAtom(
  editor: Editor,
  pos: number | undefined,
  id: string,
  next: HallElement,
): boolean {
  if (typeof pos !== "number") return false;
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
  editor.view.dispatch(
    closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, {
      ...current.attrs,
      attrs: next.attrs,
      children: next.children ?? null,
    }),
  );
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
}: GdHallAtomEditorProps) {
  const hall = useMemo(() => hallOfAtom(node.attrs), [node.attrs]);
  const editable = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current.isEditable && ritualEditorOwner(current).isEditable,
  });
  const onChange = useCallback(
    (next: HallElement) => writeHallToAtom(editor, getPos(), hall.id, next),
    [editor, getPos, hall.id],
  );
  return (
    <>
      <style href="gd-hall-fonts" precedence="default">
        {fontFaces}
      </style>
      <GdHallEditor
        hall={hall}
        art={gdHallArt}
        editable={editable}
        onChange={onChange}
        onDone={onDone}
        onUndo={() => editor.commands.undo()}
        onRedo={() => editor.commands.redo()}
      />
    </>
  );
}
