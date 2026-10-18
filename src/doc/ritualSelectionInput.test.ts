// @vitest-environment jsdom
import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { Editor, type JSONContent } from "@tiptap/core";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import { gdHallPresetAtom } from "./gdHallInsert";
import { RitualSelectionInput } from "./ritualSelectionInput";
import { ritualTiptapExtensions } from "./tiptapRitual";
import { ritualTiptapClientExtensions } from "./tiptapRitualClient";

Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(),
});
const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  document.body.replaceChildren();
});

let serial = 0;
const id = () => `Fixture${String(++serial).padStart(9, "0")}`;
const p = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const title = (): JSONContent => ({
  type: "ritualBlock",
  attrs: { id: id(), tag: "title", attrs: { text: "Opening" } },
  content: [p("Opening")],
});
const task = (text: string): JSONContent => ({
  type: "ritualTask",
  attrs: { id: id(), tag: "task", attrs: { say: true, role: "hiereus" } },
  content: [p(text)],
});
const hall = () => gdHallPresetAtom(HALL_PRESETS[0]);
const hr = (): JSONContent => ({
  type: "ritualAtom",
  attrs: { id: id(), tag: "hr", attrs: {} },
});

function setup(content: JSONContent[]) {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [...ritualTiptapExtensions, RitualSelectionInput],
    content: { type: "doc", content },
  });
  editors.push(editor);
  editor.view.focus();
  return editor;
}
/** Selects the top-level block at `index`. */
function selectBlock(editor: Editor, index: number) {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += editor.state.doc.child(i).nodeSize;
  editor.view.dispatch(
    editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)),
  );
  return pos;
}
const input = (editor: Editor, inputType: string, data: string | null) => {
  const event = new InputEvent("beforeinput", {
    inputType,
    data,
    bubbles: true,
    cancelable: true,
  });
  editor.view.dom.dispatchEvent(event);
  return event;
};
/** The document a keypress of `text` makes: ProseMirror's own path. */
const typed = (editor: Editor, text: string) =>
  editor.state.apply(editor.state.tr.insertText(text)).doc.toJSON();
const blocks = (editor: Editor) =>
  editor.getJSON().content?.map((node) => node.attrs?.tag ?? node.type);

describe("text without a keypress over a selected block", () => {
  it("is part of the visual editor", () => {
    expect(ritualTiptapClientExtensions).toContain(RitualSelectionInput);
  });

  it("replaces a hall with a paragraph, as a keypress would", () => {
    const editor = setup([title(), hall(), hall(), task("Next")]);
    const at = selectBlock(editor, 2);
    const expected = typed(editor, "Z");
    const event = input(editor, "insertText", "Z");
    expect(event.defaultPrevented).toBe(true);
    expect(editor.state.doc.toJSON()).toEqual(expected);
    expect(blocks(editor)).toEqual(["title", "gdHall", "paragraph", "task"]);
    expect(editor.state.doc.child(0).textContent).toBe("Opening");
    expect(editor.state.doc.child(2).textContent).toBe("Z");
    expect(editor.state.selection.from).toBe(at + 2);
  });

  it("does the same for a rule next to a rule and a hall after a task", () => {
    const rules = setup([title(), hr(), hr()]);
    selectBlock(rules, 2);
    const expected = typed(rules, "Z");
    expect(input(rules, "insertText", "Z").defaultPrevented).toBe(true);
    expect(rules.state.doc.toJSON()).toEqual(expected);
    expect(blocks(rules)).toEqual(["title", "hr", "paragraph"]);

    const afterTask = setup([title(), task("Before"), hall(), task("After")]);
    selectBlock(afterTask, 2);
    input(afterTask, "insertText", "Z");
    expect(blocks(afterTask)).toEqual(["title", "task", "paragraph", "task"]);
    expect(afterTask.state.doc.child(1).textContent).toBe("Before");
    expect(afterTask.state.doc.child(1).attrs.attrs).toEqual({
      say: true,
      role: "hiereus",
    });
    expect(afterTask.state.doc.child(2).textContent).toBe("Z");
  });

  it("takes a spelling or dictation replacement too", () => {
    const editor = setup([title(), hall()]);
    selectBlock(editor, 1);
    expect(
      input(editor, "insertReplacementText", "word").defaultPrevented,
    ).toBe(true);
    expect(editor.state.doc.lastChild?.textContent).toBe("word");
  });

  it("adds a paragraph at a gap cursor between halls", () => {
    const editor = setup([title(), hall(), hall()]);
    const between = editor.state.doc.child(0).nodeSize + 1;
    editor.view.dispatch(
      editor.state.tr.setSelection(
        new GapCursor(editor.state.doc.resolve(between)),
      ),
    );
    expect(input(editor, "insertText", "Z").defaultPrevented).toBe(true);
    expect(blocks(editor)).toEqual(["title", "gdHall", "paragraph", "gdHall"]);
  });

  it("is one undo step", () => {
    const editor = setup([title(), hall(), hall()]);
    selectBlock(editor, 2);
    const before = editor.state.doc.toJSON();
    input(editor, "insertText", "Z");
    expect(blocks(editor)).toEqual(["title", "gdHall", "paragraph"]);
    editor.commands.undo();
    expect(editor.state.doc.toJSON()).toEqual(before);
  });

  it("leaves text input in text, and a read-only editor, to the browser", () => {
    const editor = setup([title(), task("Words"), hall()]);
    editor.commands.setTextSelection(4);
    const before = editor.state.doc.toJSON();
    expect(input(editor, "insertText", "Z").defaultPrevented).toBe(false);
    expect(editor.state.doc.toJSON()).toEqual(before);

    selectBlock(editor, 2);
    editor.setEditable(false);
    expect(input(editor, "insertText", "Z").defaultPrevented).toBe(false);
    expect(editor.state.doc.toJSON()).toEqual(before);
  });

  it("ignores other input types", () => {
    const editor = setup([title(), hall()]);
    selectBlock(editor, 1);
    expect(input(editor, "insertFromPaste", null).defaultPrevented).toBe(false);
    expect(blocks(editor)).toEqual(["title", "gdHall"]);
  });
});

describe("a composition over a selected block", () => {
  const opened = (editor: Editor) => {
    expect(blocks(editor)).toEqual(["title", "gdHall", "paragraph"]);
    const { selection } = editor.state;
    expect(selection).toBeInstanceOf(TextSelection);
    expect(selection.empty).toBe(true);
    expect(selection.$from.parent.type.name).toBe("paragraph");
    expect(selection.$from.parent.content.size).toBe(0);
  };

  it("opens the paragraph at the IME's first keydown", () => {
    const editor = setup([title(), hall(), hall()]);
    selectBlock(editor, 2);
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { keyCode: 229, bubbles: true }),
    );
    opened(editor);
  });

  it("opens it at compositionstart without that keydown", () => {
    const editor = setup([title(), hall(), hall()]);
    selectBlock(editor, 2);
    editor.view.dom.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    opened(editor);
  });

  it("leaves other keys, shortcuts and text selections alone", () => {
    const editor = setup([title(), hall(), hall()]);
    selectBlock(editor, 2);
    const before = editor.state.doc.toJSON();
    for (const init of [
      { keyCode: 229, ctrlKey: true },
      { keyCode: 16, key: "Shift" },
    ])
      editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", { ...init, bubbles: true }),
      );
    expect(editor.state.doc.toJSON()).toEqual(before);
    editor.commands.setTextSelection(3);
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { keyCode: 229, bubbles: true }),
    );
    expect(editor.state.doc.toJSON()).toEqual(before);
  });
});
