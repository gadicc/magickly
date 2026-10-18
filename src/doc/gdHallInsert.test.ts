// @vitest-environment jsdom
import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { Editor, type JSONContent } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import {
  gdHallInsertionRange,
  gdHallPresetAtom,
  gdHallPresetGrade,
} from "./gdHallInsert";
import { gdHallSource } from "./gdHallRows";
import { registerRitualEditorOwner } from "./ritualEditorOwner";
import { isRitualNodeId } from "./ritualNodeIds";
import { parseRitualPug, printRitualPug } from "./ritualPug";
import {
  RitualSlashCommands,
  ritualSlashCommandsKey,
} from "./ritualSlashCommands";
import {
  type RitualSemanticDocument,
  type RitualSemanticNode,
  semanticToJrt,
  validateRitualSemantic,
} from "./semantic";
import { ritualTiptapExtensions, semanticFromTiptap } from "./tiptapRitual";

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

type Element = Extract<RitualSemanticNode, { kind: "element" }>;
const p = (text = ""): JSONContent => ({
  type: "paragraph",
  ...(text ? { content: [{ type: "text", text }] } : {}),
});
let serial = 0;
const id = () => `Fixture${String(++serial).padStart(9, "0")}`;
const block = (tag: string, ...content: JSONContent[]): JSONContent => ({
  type: "ritualBlock",
  attrs: {
    id: id(),
    tag,
    attrs:
      tag === "title"
        ? { text: "Opening" }
        : tag === "summary"
          ? { summary: "The hall" }
          : {},
  },
  content,
});
const task = (...content: JSONContent[]): JSONContent => ({
  type: "ritualTask",
  attrs: { id: id(), tag: "task", attrs: { say: true, role: "hiereus" } },
  content,
});

/** An editor with the caret at the end of the paragraph `path` names. */
function setup(content: JSONContent[], path: number[]) {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [...ritualTiptapExtensions, RitualSlashCommands],
    content: { type: "doc", content },
  });
  editors.push(editor);
  let node = editor.state.doc;
  let pos = 0;
  for (const index of path) {
    for (let i = 0; i < index; i++) pos += node.child(i).nodeSize;
    node = node.child(index);
    pos += 1;
  }
  editor.commands.setTextSelection(pos + node.content.size);
  editor.view.focus();
  return editor;
}
function type(editor: Editor, text: string) {
  for (const char of text) {
    const { from, to } = editor.state.selection;
    editor.view.dispatch(editor.state.tr.insertText(char, from, to));
  }
}
function press(editor: Editor, key: string) {
  const plugin = ritualSlashCommandsKey.get(editor.state)!;
  return plugin.props.handleKeyDown?.call(
    plugin,
    editor.view,
    new KeyboardEvent("keydown", { key }),
  );
}
const options = () =>
  [...document.querySelectorAll('[role="option"]')].map((option) =>
    [...option.children].map((part) => part.textContent).join(" | "),
  );
/** Types `/hall `, picks the preset at `index` and returns the document. */
function insert(editor: Editor, index = 0) {
  type(editor, "/hall ");
  for (let i = 0; i < index; i++) press(editor, "ArrowDown");
  expect(press(editor, "Enter")).toBe(true);
  return semanticFromTiptap(editor.getJSON());
}
const halls = (doc: RitualSemanticDocument) => {
  const found: Element[] = [];
  const walk = (node: RitualSemanticNode) => {
    if (node.kind !== "element") return;
    if (node.tag === "gdHall") found.push(node);
    else node.children?.forEach(walk);
  };
  doc.nodes.forEach(walk);
  return found;
};
const ids = (node: RitualSemanticNode): string[] =>
  node.kind === "element"
    ? [node.id, ...(node.children ?? []).flatMap(ids)]
    : [];
const compiled = (hall: Element) =>
  semanticToJrt({ format: "magickli-ritual", version: 1, nodes: [hall] });

describe("the /hall slash command", () => {
  it("lists the five presets by title and grade", () => {
    const editor = setup([p()], [0]);
    type(editor, "/");
    expect(options()).toContain(
      "Temple hall | A Golden Dawn temple floor plan; pick the grade next",
    );
    type(editor, "hall");
    expect(options()).toEqual([
      "Temple hall | A Golden Dawn temple floor plan; pick the grade next",
    ]);
    // Choosing the command lists the presets next, as Speech lists roles.
    expect(press(editor, "Enter")).toBe(true);
    expect(editor.state.doc.textContent).toBe("/hall ");
    expect(options()).toEqual([
      "Neophyte Temple | 0=0",
      "Zelator Temple 1 | 1=10, part 1",
      "Zelator Temple 2 | 1=10, part 2",
      "Theoricus Temple 1 | 2=9, part 1",
      "Theoricus Temple 2 | 2=9, part 2",
    ]);
    type(editor, "theo");
    expect(options()).toEqual([
      "Theoricus Temple 1 | 2=9, part 1",
      "Theoricus Temple 2 | 2=9, part 2",
    ]);
    type(editor, "x");
    expect(options()).toEqual([]);
  });

  it("finds a preset typed first", () => {
    const editor = setup([p()], [0]);
    type(editor, "/zel");
    expect(options()).toEqual([
      "Zelator Temple 1 | Temple hall · 1=10, part 1",
      "Zelator Temple 2 | Temple hall · 1=10, part 2",
    ]);
    press(editor, "ArrowDown");
    expect(press(editor, "Enter")).toBe(true);
    const [hall] = halls(semanticFromTiptap(editor.getJSON()));
    expect(compiled(hall)).toEqual(
      compiled(gdHallSource(HALL_PRESETS[2].hall)),
    );
  });

  it.each(
    HALL_PRESETS.map((preset, index) => [preset.id, preset, index] as const),
  )(
    "inserts %s as a copy with fresh IDs, valid, through Pug, in one undo step",
    (_id, preset, index) => {
      const editor = setup([p("Before"), p()], [1]);
      const doc = insert(editor, index);
      expect(validateRitualSemantic(doc)).toEqual([]);
      const [hall] = halls(doc);
      expect(doc.nodes.at(-1)).toBe(hall);
      // The copy draws what the preset draws.
      expect(compiled(hall)).toEqual(compiled(gdHallSource(preset.hall)));
      // Every node has its own fresh ID.
      const first = ids(hall);
      expect(first.every(isRitualNodeId)).toBe(true);
      expect(new Set(first).size).toBe(first.length);
      // Pug prints and parses it back exactly; no -0 sneaks in.
      expect(parseRitualPug(printRitualPug(doc))).toEqual(doc);
      expect(
        JSON.stringify(hall, (_k, v) => (Object.is(v, -0) ? "-0" : v)),
      ).not.toContain('"-0"');
      // The caret waits in an empty paragraph after the hall, which the
      // document does not keep.
      const { $from } = editor.state.selection;
      expect($from.parent.type.name).toBe("paragraph");
      expect($from.parent.content.size).toBe(0);
      expect(editor.state.doc.child($from.index(0) - 1).attrs.tag).toBe(
        "gdHall",
      );
      // One undo step brings the literal command back.
      editor.commands.undo();
      expect(editor.state.doc.lastChild?.textContent).toBe("/hall ");
      expect(halls(semanticFromTiptap(editor.getJSON()))).toEqual([]);
    },
  );

  it("gives each copy of a preset its own IDs", () => {
    const editor = setup([p(), p()], [0]);
    insert(editor);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const doc = insert(editor);
    const [a, b] = halls(doc);
    expect(compiled(a)).toEqual(compiled(b));
    const seen = new Set(ids(a));
    expect(ids(b).some((value) => seen.has(value))).toBe(false);
  });

  it("puts the caret at the start of a paragraph that follows", () => {
    const editor = setup([p(), p("After")], [0]);
    const doc = insert(editor);
    expect(doc.nodes.map((node) => node.kind)).toEqual(["element", "text"]);
    expect(editor.state.selection.$from.parent.textContent).toBe("After");
    expect(editor.state.selection.$from.parentOffset).toBe(0);
    type(editor, "Then ");
    expect(semanticFromTiptap(editor.getJSON()).nodes[1]).toEqual({
      kind: "text",
      text: "Then After",
    });
  });

  it("is undone by an immediate Backspace, as Speech and Action are", () => {
    const editor = setup([p()], [0]);
    insert(editor, 1);
    expect(press(editor, "Backspace")).toBe(true);
    expect(editor.state.doc.textContent).toBe("/hall ");
  });
});

describe("where /hall puts a hall", () => {
  const where = (content: JSONContent[], path: number[]) => {
    const editor = setup(content, path);
    type(editor, "/hall ");
    if (!options().length) return null;
    expect(press(editor, "Enter")).toBe(true);
    const doc = semanticFromTiptap(editor.getJSON());
    expect(validateRitualSemantic(doc)).toEqual([]);
    // The path of tags down to the hall.
    const trail = (nodes: RitualSemanticNode[]): string[] | null => {
      for (const node of nodes) {
        if (node.kind !== "element") continue;
        if (node.tag === "gdHall") return ["gdHall"];
        const below = trail(node.children ?? []);
        if (below) return [node.tag, ...below];
      }
      return null;
    };
    return trail(doc.nodes);
  };

  it.each([
    ["the top level", [p()], [0], ["gdHall"]],
    ["a note", [block("note", p("Read"), p())], [0, 1], ["note", "gdHall"]],
    ["a summary", [block("summary", p())], [0, 0], ["summary", "gdHall"]],
    ["a todo", [block("todo", p())], [0, 0], ["todo", "gdHall"]],
    [
      "a list item",
      [block("ul", block("li", p()))],
      [0, 0, 0],
      ["ul", "li", "gdHall"],
    ],
    // As Speech does: the task's last paragraph becomes a sibling.
    ["the end of a task", [task(p("Said."), p())], [0, 1], ["gdHall"]],
    [
      "the end of a task in a note",
      [block("note", task(p("Said."), p()))],
      [0, 0, 1],
      ["note", "gdHall"],
    ],
  ] as const)("stands in %s", (_name, content, path, expected) => {
    expect(where([...content], [...path])).toEqual(expected);
  });

  it.each([
    ["the middle of a task", [task(p(), p("Later"))], [0, 0]],
    ["a title", [block("title", p("Opening"), p())], [0, 1]],
    ["a list itself", [block("ul", p())], [0, 0]],
  ] as const)("is not offered in %s", (_name, content, path) => {
    expect(where([...content], [...path])).toBeNull();
  });

  it("is the only command in a list item", () => {
    const editor = setup([block("ul", block("li", p()))], [0, 0, 0]);
    type(editor, "/");
    expect(options()).toEqual([
      "Temple hall | A Golden Dawn temple floor plan; pick the grade next",
    ]);
  });

  it("is not offered after text in a paragraph", () => {
    const editor = setup([p("Prose ")], [0]);
    type(editor, "/hall ");
    expect(options()).toEqual([]);
    expect(halls(semanticFromTiptap(editor.getJSON()))).toEqual([]);
  });

  it("is not offered in collected footnotes", () => {
    const editor = setup([p()], [0]);
    const owner = setup([p()], [0]);
    const unregister = registerRitualEditorOwner(editor, owner);
    editor.view.focus();
    type(editor, "/");
    expect(options().some((option) => option.startsWith("Temple hall"))).toBe(
      false,
    );
    type(editor, "hall ");
    expect(options()).toEqual([]);
    unregister();
  });
});

describe("where the toolbar puts a hall", () => {
  const range = (content: JSONContent[], at: (editor: Editor) => void) => {
    const editor = new Editor({
      extensions: ritualTiptapExtensions,
      content: { type: "doc", content },
    });
    editors.push(editor);
    at(editor);
    const { from, to } = gdHallInsertionRange(editor.state);
    const tr = editor.state.tr.replaceWith(
      from,
      to,
      editor.schema.nodeFromJSON(gdHallPresetAtom(HALL_PRESETS[0])),
    );
    editor.view.dispatch(tr);
    const doc = semanticFromTiptap(editor.getJSON());
    expect(validateRitualSemantic(doc)).toEqual([]);
    // Each top-level node with its children's tags; a hall by its tag.
    const tag = (node: RitualSemanticNode) =>
      node.kind === "element" ? node.tag : node.kind;
    return doc.nodes.map((node) =>
      node.kind === "element" && node.tag !== "gdHall"
        ? [node.tag, ...(node.children ?? []).map(tag)].join(" ")
        : tag(node),
    );
  };

  it("replaces an empty paragraph where a hall may stand", () => {
    expect(
      range([p("One"), p()], (e) => e.commands.setTextSelection(6)),
    ).toEqual(["text", "gdHall"]);
  });
  it("goes after the paragraph holding the cursor", () => {
    expect(
      range([p("One two"), p("Three")], (e) => e.commands.setTextSelection(3)),
    ).toEqual(["text", "gdHall", "text"]);
  });
  it.each([
    ["task", task(p("Said."))],
    ["title", block("title", p("Opening"))],
  ])("goes after a %s, where a hall may not stand", (tag, host) => {
    expect(
      range([host, p("After")], (e) => e.commands.setTextSelection(3)),
    ).toEqual([tag === "task" ? "task text" : "title text", "gdHall", "text"]);
  });
  it("stays in a note", () => {
    expect(
      range([block("note", p("Read"))], (e) => e.commands.setTextSelection(3)),
    ).toEqual(["note text gdHall"]);
  });
  it("goes after a selected block", () => {
    expect(
      range(
        [{ type: "ritualAtom", attrs: { id: id(), tag: "hr", attrs: {} } }],
        (e) =>
          e.view.dispatch(
            e.state.tr.setSelection(NodeSelection.create(e.state.doc, 0)),
          ),
      ),
    ).toEqual(["hr", "gdHall"]);
  });
});

it("labels presets with their grade and part", () => {
  expect(HALL_PRESETS.map(gdHallPresetGrade)).toEqual([
    "0=0",
    "1=10, part 1",
    "1=10, part 2",
    "2=9, part 1",
    "2=9, part 2",
  ]);
});
