import { Extension } from "@tiptap/core";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { Fragment, Slice } from "@tiptap/pm/model";
import {
  type EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
  type Selection,
  TextSelection,
} from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Whether typed text has no text position to go to: a selected block (a
 * hall, a rule, a task picked by its handle) or a gap cursor between
 * blocks. ProseMirror's keypress handler types over these itself; text
 * that arrives without a keypress does not reach it (below).
 */
export function typesOverBlock(selection: Selection): boolean {
  return (
    (selection instanceof NodeSelection && selection.node.isBlock) ||
    selection instanceof GapCursor
  );
}

/** The text an `insertText` or `insertReplacementText` event carries. */
function inputText(event: InputEvent): string {
  return event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
}

/**
 * Types `text` over the selection as ProseMirror's keypress handler does
 * (`editHandlers.keypress` in prosemirror-view): `handleTextInput` first,
 * so input rules still apply, otherwise `tr.insertText`. Over a selected
 * block that replaces the block with a paragraph holding the text; at a
 * gap cursor it adds that paragraph.
 */
function typeOver(view: EditorView, text: string): void {
  const { from, to } = view.state.selection;
  const typed = () => view.state.tr.insertText(text).scrollIntoView();
  if (!view.someProp("handleTextInput", (f) => f(view, from, to, text, typed)))
    view.dispatch(typed());
}

/**
 * The transaction that puts the empty textblock typing would make (the
 * wrapping text needs at that index, as `tr.insertText` and
 * prosemirror-gapcursor find it) in place of a selected block, or at a
 * gap cursor, with the caret inside, so a composition can start there.
 */
export function openTextblock(state: EditorState) {
  const { selection } = state;
  if (!typesOverBlock(selection)) return null;
  const { $from } = selection;
  const wrapping = $from.parent
    .contentMatchAt($from.index())
    .findWrapping(state.schema.nodes.text);
  if (!wrapping) return null;
  let content = Fragment.empty;
  for (let i = wrapping.length - 1; i >= 0; i--) {
    const node = wrapping[i].createAndFill(null, content);
    if (!node) return null;
    content = Fragment.from(node);
  }
  const tr = state.tr.replace(
    selection.from,
    selection.to,
    new Slice(content, 0, 0),
  );
  return tr
    .setSelection(TextSelection.near(tr.doc.resolve(selection.from + 1)))
    .scrollIntoView();
}

/**
 * Text that reaches the visual editor without a keypress (an IME, a
 * virtual keyboard, dictation, a spelling replacement, CDP's
 * `Input.insertText`) while a block is selected, or at a gap cursor, is
 * typed over the block as a keypress would be.
 *
 * ProseMirror handles a keypress before the browser edits anything.
 * Other input is left to the browser, and ProseMirror reads the DOM
 * change back. Over a selected block that goes wrong: the DOM selection
 * spans a `contenteditable="false"` element, which has no caret position
 * in it, and Chromium moves the input to an editable position it picks
 * itself, the end of the task before the block or, between two such
 * blocks, the start of the ritual's title. ProseMirror then reads an
 * edit there. So:
 *
 * - `beforeinput` for `insertText` and `insertReplacementText` is
 *   cancelled and typed over the block by ProseMirror (`typeOver`);
 * - an IME's first keydown (key code 229) replaces the block with the
 *   empty paragraph typing would put there, before the composition
 *   starts, so it writes into that paragraph (a composition's text
 *   cannot be cancelled);
 * - `compositionstart` without that keydown does the same. By then
 *   Chromium may already have placed the composition elsewhere: the text
 *   reaches the paragraph, but the composition may not end cleanly.
 */
export const RitualSelectionInput = Extension.create({
  name: "ritualSelectionInput",
  addProseMirrorPlugins() {
    const open = (view: EditorView) => {
      if (!view.editable || view.composing) return;
      const tr = openTextblock(view.state);
      if (tr) view.dispatch(tr);
    };
    return [
      new Plugin({
        key: new PluginKey("ritualSelectionInput"),
        props: {
          handleKeyDown(view, event) {
            if (
              event.keyCode === 229 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            )
              open(view);
            return false;
          },
          handleDOMEvents: {
            beforeinput(view, event) {
              if (
                !view.editable ||
                view.composing ||
                (event.inputType !== "insertText" &&
                  event.inputType !== "insertReplacementText") ||
                !typesOverBlock(view.state.selection)
              )
                return false;
              event.preventDefault();
              const text = inputText(event);
              if (text) typeOver(view, text);
              return true;
            },
            compositionstart(view) {
              open(view);
              // ProseMirror's own handler still starts the composition.
              return false;
            },
          },
        },
      }),
    ];
  },
});
