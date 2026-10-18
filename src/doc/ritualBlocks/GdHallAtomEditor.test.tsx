// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor } from "@tiptap/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { HallElement } from "../gdHallEditor/hallModel";
import { parseRitualPug, RITUAL_PUG_HEADER } from "../ritualPug";
import { type RitualSemanticNode, validateRitualSemantic } from "../semantic";
import {
  ritualTiptapExtensions,
  semanticFromTiptap,
  semanticToTiptap,
} from "../tiptapRitual";
import {
  insideHallControls,
  ritualTiptapClientExtensions,
} from "../tiptapRitualClient";
import { hallOfAtom, writeHallToAtom } from "./GdHallAtomEditor";

Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(),
});
// The editor's chunk is a large module graph: load it once.
beforeAll(async () => {
  await import("./GdHallAtomEditor");
}, 60_000);
afterEach(cleanup);

const source = `${RITUAL_PUG_HEADER}\n${readFileSync(
  "src/doc/fixtures/gdHallNeophyte.pug",
  "utf8",
)}`;
type SemanticElement = Extract<RitualSemanticNode, { kind: "element" }>;
const hallIn = (editor: Editor) =>
  semanticFromTiptap(editor.getJSON()).nodes.find(
    (node): node is SemanticElement =>
      node.kind === "element" && node.tag === "gdHall",
  ) as SemanticElement;
const hallPos = (editor: Editor) => {
  let pos = -1;
  editor.state.doc.forEach((node, offset) => {
    if (node.attrs.tag === "gdHall") pos = offset;
  });
  return pos;
};

let current: Editor | null = null;
function Host() {
  const editor = useEditor({
    extensions: ritualTiptapClientExtensions,
    content: semanticToTiptap(parseRitualPug(source)),
    immediatelyRender: false,
    editorProps: {
      attributes: { role: "textbox", "aria-label": "Fixture visual editor" },
    },
  });
  current = editor;
  return <EditorContent editor={editor} />;
}

async function openEditor() {
  render(<Host />);
  const button = await screen.findByRole("button", { name: "Edit hall" });
  const editor = current as Editor;
  const before = editor.state.selection.toJSON();
  fireEvent.mouseDown(button);
  fireEvent.click(button);
  const surface = await screen.findByRole(
    "application",
    {},
    { timeout: 30_000 },
  );
  return { editor, surface, before };
}

describe("editing a hall in the ritual editor", () => {
  it("opens in place, focused, without selecting the atom", async () => {
    const { editor, surface, before } = await openEditor();
    await waitFor(() => expect(document.activeElement).toBe(surface));
    expect(editor.state.selection.toJSON()).toEqual(before);
    expect(editor.state.selection).not.toBeInstanceOf(NodeSelection);
    // Pointer presses in the editor are its own, not ProseMirror's.
    fireEvent.mouseDown(surface);
    expect(editor.state.selection).not.toBeInstanceOf(NodeSelection);
    const atom = surface.closest('[data-ritual-atom="gdHall"]');
    expect(atom?.contains(screen.getByRole("button", { name: "Done" }))).toBe(
      true,
    );
  }, 60_000);

  it("keeps cut, copy and paste away from the ritual's text", async () => {
    const { editor, surface } = await openEditor();
    await waitFor(() => expect(document.activeElement).toBe(surface));
    // The author had "Opening" selected in the title. Chromium leaves such
    // a selection in place when a non-editable element takes the focus
    // (jsdom moves it), and sends cut, copy and paste to its start.
    editor.commands.setTextSelection({ from: 1, to: 8 });
    const place = editor.state.selection.toJSON();
    const selection = document.getSelection() as Selection;
    const range = document.createRange();
    range.selectNodeContents(editor.view.domAtPos(1).node);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.toString()).toBe("Opening");
    fireEvent.focusIn(surface);
    // The page's text selection is gone; ProseMirror keeps its own.
    expect(selection.rangeCount).toBe(0);
    expect(editor.state.selection.toJSON()).toEqual(place);
    const doc = editor.state.doc;
    for (const key of ["x", "c", "v", "X"])
      expect(fireEvent.keyDown(surface, { key, ctrlKey: true })).toBe(false);
    const target =
      selection.rangeCount > 0 && !selection.isCollapsed
        ? (selection.anchorNode?.parentElement as Element)
        : (document.activeElement as Element);
    for (const type of ["cut", "copy", "paste"])
      target.dispatchEvent(
        new Event(type, { bubbles: true, cancelable: true }),
      );
    expect(editor.state.doc).toBe(doc);
    // A panel field keeps its own clipboard keys.
    fireEvent.keyDown(surface, { key: "Tab" });
    const field = screen.getByRole("textbox", { name: /^x/ });
    expect(fireEvent.keyDown(field, { key: "x", ctrlKey: true })).toBe(true);
  }, 60_000);

  it("writes each gesture as one undo step, keeping IDs", async () => {
    const { editor, surface } = await openEditor();
    const original = hallIn(editor);
    fireEvent.keyDown(surface, { key: "Tab" });
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    const moved = hallIn(editor);
    expect(moved.id).toBe(original.id);
    const imperator = (hall: SemanticElement) =>
      ((hall.children?.[0] as SemanticElement).children?.[0] as SemanticElement)
        .attrs;
    expect(imperator(moved)).toEqual({ role: "imperator", x: 2.6 });
    expect(
      validateRitualSemantic(semanticFromTiptap(editor.getJSON())),
    ).toEqual([]);
    // Delete removes the selected object, not the hall.
    fireEvent.keyDown(surface, { key: "Delete" });
    expect(hallPos(editor)).toBeGreaterThan(0);
    expect(
      (hallIn(editor).children?.[0] as SemanticElement).children,
    ).toHaveLength(4);
    // One undo per gesture, through the editor's own history.
    fireEvent.keyDown(surface, { key: "z", ctrlKey: true });
    expect(imperator(hallIn(editor))).toEqual({ role: "imperator", x: 2.6 });
    fireEvent.keyDown(surface, { key: "z", ctrlKey: true });
    expect(imperator(hallIn(editor)).x).toBe(2.1);
    fireEvent.keyDown(surface, { key: "z", ctrlKey: true });
    expect(imperator(hallIn(editor))).toEqual({ role: "imperator" });
    fireEvent.keyDown(surface, { key: "y", ctrlKey: true });
    expect(imperator(hallIn(editor)).x).toBe(2.1);
    expect(screen.getByRole("application")).toBe(surface);
  }, 60_000);

  it("goes back to the drawing with Done, the focus on Edit hall", async () => {
    const { surface } = await openEditor();
    fireEvent.keyDown(surface, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("application")).toBeNull());
    const button = screen.getByRole("button", { name: "Edit hall" });
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(screen.getByRole("img", { name: "Neophyte Temple" })).toBeTruthy();
  }, 60_000);

  it("pauses edits while the editor takes no changes", async () => {
    const { editor, surface } = await openEditor();
    editor.setEditable(false);
    await waitFor(() =>
      expect(surface.getAttribute("aria-disabled")).toBe("true"),
    );
    fireEvent.keyDown(surface, { key: "Tab" });
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    expect(editor.can().undo()).toBe(false);
  }, 60_000);
});

describe("writeHallToAtom", () => {
  const setup = () =>
    new Editor({
      extensions: ritualTiptapExtensions,
      content: semanticToTiptap(parseRitualPug(source)),
    });

  it("refuses a moved atom, another hall or invalid source", () => {
    const editor = setup();
    try {
      const pos = hallPos(editor);
      const hall = hallOfAtom(editor.state.doc.nodeAt(pos)?.attrs ?? {});
      const before = editor.state.doc;
      expect(writeHallToAtom(editor, undefined, hall.id, hall)).toBe(false);
      expect(writeHallToAtom(editor, 0, hall.id, hall)).toBe(false);
      expect(writeHallToAtom(editor, pos, "other", hall)).toBe(false);
      const text: HallElement = {
        ...hall,
        children: [{ kind: "text", text: "no" } as never],
      };
      expect(writeHallToAtom(editor, pos, hall.id, text)).toBe(false);
      expect(
        writeHallToAtom(editor, pos, hall.id, { ...hall, id: "different" }),
      ).toBe(false);
      expect(editor.state.doc).toBe(before);
      expect(
        writeHallToAtom(editor, pos, hall.id, {
          ...hall,
          attrs: { ...hall.attrs, dais: 5 },
        }),
      ).toBe(true);
      expect(hallIn(editor).attrs.dais).toBe(5);
    } finally {
      editor.destroy();
    }
  });

  it("reads an atom without children as a hall without them", () => {
    expect(hallOfAtom({ id: "A", attrs: null, children: null })).toEqual({
      kind: "element",
      id: "A",
      tag: "gdHall",
      attrs: {},
    });
  });
});

describe("insideHallControls", () => {
  it("is true only within a hall's controls in that node view", () => {
    const dom = document.createElement("div");
    dom.innerHTML =
      '<div data-gd-hall-controls><span id="in"></span></div><span id="out"></span>';
    document.body.append(dom);
    const event = (target: Element | null) => {
      const result = new Event("mousedown");
      Object.defineProperty(result, "target", { value: target });
      return result;
    };
    expect(insideHallControls(event(dom.querySelector("#in")), dom)).toBe(true);
    expect(insideHallControls(event(dom.querySelector("#out")), dom)).toBe(
      false,
    );
    expect(insideHallControls(event(null), dom)).toBe(false);
    expect(insideHallControls(event(dom.querySelector("#in")), undefined)).toBe(
      false,
    );
    const other = document.createElement("div");
    expect(insideHallControls(event(dom.querySelector("#in")), other)).toBe(
      false,
    );
    dom.remove();
    vi.restoreAllMocks();
  });
});
