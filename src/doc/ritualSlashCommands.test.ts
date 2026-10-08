// @vitest-environment jsdom
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, expect, it } from "vitest";
import { registerRitualEditorOwner } from "./ritualEditorOwner";
import {
  RITUAL_SLASH_HINT,
  RitualSlashCommands,
  ritualSlashCommandsKey,
} from "./ritualSlashCommands";
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
const p = (text = ""): JSONContent => ({
  type: "paragraph",
  ...(text ? { content: [{ type: "text", text }] } : {}),
});
const task = (...content: JSONContent[]): JSONContent => ({
  type: "ritualTask",
  attrs: {
    id: "Abcdefghijk12345",
    tag: "task",
    attrs: { say: true, role: "hiero" },
  },
  content,
});
function setup(content: JSONContent[] = [p()]) {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [...ritualTiptapExtensions, RitualSlashCommands],
    content: { type: "doc", content },
  });
  editors.push(editor);
  editor.commands.setTextSelection(
    editor.state.doc.content.size -
      (content.at(-1)?.type === "ritualTask" ? 2 : 1),
  );
  editor.view.focus();
  return editor;
}
function type(editor: Editor, text: string) {
  for (const char of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp("handleTextInput", (handler) =>
      handler(editor.view, from, to, char, () =>
        editor.state.tr.insertText(char, from, to),
      ),
    );
    if (!handled)
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

it.each([
  ["say", "hiero", "hierophant"],
  ["do", "KERYX", "keryx"],
  ["say", "all-officers", "all-officers"],
])(
  "converts /%s %s on space and lets body typing continue",
  (mode, role, expected) => {
    const editor = setup();
    type(editor, `/${mode} ${role} `);
    expect(editor.state.doc.firstChild?.type.name).toBe("ritualTask");
    expect(editor.state.doc.firstChild?.attrs.attrs).toEqual({
      [mode]: true,
      role: expected,
    });
    type(editor, "Hello");
    expect(editor.state.doc.firstChild?.textContent).toBe("Hello");
    expect(semanticFromTiptap(editor.getJSON()).nodes[0]).toMatchObject({
      tag: "task",
      children: [{ kind: "text", text: "Hello" }],
    });
  },
);
it.each(["undo", "Backspace"])(
  "%s restores the complete literal command",
  (operation) => {
    const editor = setup();
    type(editor, "/say hiero ");
    if (operation === "undo") editor.commands.undo();
    else expect(press(editor, operation)).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe("paragraph");
    expect(editor.state.doc.textContent).toBe("/say hiero ");
  },
);
it("keeps body typing separate from the conversion undo", () => {
  const editor = setup();
  type(editor, "/say hiero ");
  const converted = editor.getJSON();
  type(editor, "Body");
  editor.commands.undo();
  expect(editor.getJSON()).toEqual(converted);
  editor.commands.undo();
  expect(editor.state.doc.textContent).toBe("/say hiero ");
});
it("converts a final task paragraph to a sibling without moving its earlier content", () => {
  const editor = setup([task(p("Existing"), p())]);
  const original = editor.state.doc.firstChild!.attrs.id;
  type(editor, "/do keryx ");
  expect(editor.state.doc.childCount).toBe(2);
  expect(editor.state.doc.firstChild?.textContent).toBe("Existing");
  expect(editor.state.doc.firstChild?.attrs.id).toBe(original);
  expect(editor.state.doc.lastChild?.attrs.attrs).toEqual({
    do: true,
    role: "keryx",
  });
  type(editor, "New body");
  expect(editor.state.doc.lastChild?.textContent).toBe("New body");
});
it("keeps mid-task and list commands literal", () => {
  const editor = setup([task(p(), p("Later"))]);
  editor.commands.setTextSelection(2);
  type(editor, "/do keryx ");
  expect(editor.state.doc.childCount).toBe(1);
  expect(editor.state.doc.firstChild?.childCount).toBe(2);
  const list = setup([
    {
      type: "ritualBlock",
      attrs: { id: "Ulabcdef12345678", tag: "ul", attrs: {} },
      content: [
        {
          type: "ritualBlock",
          attrs: { id: "Liabcdef12345678", tag: "li", attrs: {} },
          content: [p()],
        },
      ],
    },
  ]);
  list.commands.setTextSelection(3);
  type(list, "/say hiero ");
  expect(list.state.doc.firstChild?.type.name).toBe("ritualBlock");
});
it("supports keyboard menu selection and Escape preserves literal typing", () => {
  const editor = setup();
  type(editor, "/");
  press(editor, "ArrowDown");
  press(editor, "Enter");
  expect(editor.state.doc.textContent).toBe("/do ");
  type(editor, "keryx");
  press(editor, "Enter");
  expect(editor.state.doc.firstChild?.attrs.attrs.do).toBe(true);
  const literal = setup();
  type(literal, "/say hiero");
  press(literal, "Escape");
  type(literal, " ");
  expect(literal.state.doc.firstChild?.type.name).toBe("paragraph");
});
it("preserves exact custom keys and leaves typos/prose/paste literal", () => {
  const editor = setup([task(p()), p()]);
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(0, undefined, {
      ...editor.state.doc.firstChild!.attrs,
      attrs: { say: true, role: "Scribe" },
    }),
  );
  type(editor, "/say Scribe ");
  expect(editor.state.doc.lastChild?.attrs.attrs.role).toBe("Scribe");
  for (const text of ["/say scribe ", "/say heiro ", "Prose /say hiero "]) {
    const literal = setup();
    type(literal, text);
    expect(literal.state.doc.firstChild?.type.name).toBe("paragraph");
  }
  const pasted = setup();
  pasted.commands.insertContent("/say hiero ");
  expect(pasted.state.doc.firstChild?.type.name).toBe("paragraph");
});
it("blocks commands while read-only or composing, including a locked canonical owner", () => {
  const editor = setup();
  type(editor, "/say hiero");
  editor.setEditable(false);
  expect(press(editor, "Enter")).toBeFalsy();
  editor.setEditable(true);
  const owner = setup();
  const unregister = registerRitualEditorOwner(editor, owner);
  owner.setEditable(false);
  expect(press(editor, "Enter")).toBeFalsy();
  unregister();
  editor.view.dom.dispatchEvent(
    new CompositionEvent("compositionstart", { bubbles: true }),
  );
  expect(press(editor, "Enter")).toBeFalsy();
  editor.view.dom.dispatchEvent(
    new CompositionEvent("compositionend", { bubbles: true }),
  );
  expect(press(editor, "Enter")).toBe(true);
});

it("keeps the role menu scroll position and reserved group labels", () => {
  const editor = setup([
    {
      type: "ritualAtom",
      attrs: {
        id: "Declare123456789",
        tag: "declareVar",
        attrs: { name: "myRole", varType: "select" },
        children: [
          {
            kind: "element",
            id: "Option1234567890",
            tag: "option",
            attrs: { value: "all", label: "Misleading custom label" },
          },
        ],
      },
    },
    p(),
  ]);
  type(editor, "/say ");
  const menu = document.querySelector('[role="listbox"]')!;
  expect(menu.textContent).toContain("Everyone");
  expect(menu.textContent).not.toContain("Misleading custom label");
  const option = menu.firstChild;
  menu.scrollTop = 80;
  menu.dispatchEvent(new Event("scroll"));
  expect(menu.scrollTop).toBe(80);
  expect(menu.firstChild).toBe(option);
});

it("keeps commands literal in an existing task nested through a note in another task", () => {
  const editor = setup([
    task({
      type: "ritualBlock",
      attrs: { id: "Note12345678901", tag: "note", attrs: {} },
      content: [
        { ...task(p()), attrs: { ...task().attrs, id: "Inner1234567890" } },
      ],
    }),
  ]);
  editor.commands.setTextSelection(4);
  type(editor, "/do keryx ");
  let tasks = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "ritualTask") tasks++;
  });
  expect(tasks).toBe(2);
  expect(editor.state.doc.textContent).toBe("/do keryx ");
});

it("offers a role typed first as speech and action", () => {
  const editor = setup();
  type(editor, "/ker");
  const options = [...document.querySelectorAll('[role="option"]')].map(
    (option) => option.firstChild?.textContent,
  );
  expect(options).toEqual(["Keryx · Speech", "Keryx · Action"]);
  press(editor, "ArrowDown");
  expect(press(editor, "Enter")).toBe(true);
  expect(editor.state.doc.firstChild?.attrs.attrs).toEqual({
    do: true,
    role: "keryx",
  });
});

it("keeps single letters that match a command to the commands", () => {
  const editor = setup();
  type(editor, "/s");
  expect(
    [...document.querySelectorAll('[role="option"]')].map(
      (option) => option.firstChild?.textContent,
    ),
  ).toEqual(["Say · Speech", "Section title"]);
  type(editor, "en");
  expect(
    [...document.querySelectorAll('[role="option"]')].map(
      (option) => option.firstChild?.textContent,
    ),
  ).toEqual(["Sentinel · Speech", "Sentinel · Action"]);
});

it("matches hyphenated roles typed first", () => {
  const editor = setup();
  type(editor, "/all-o");
  expect(
    [...document.querySelectorAll('[role="option"]')].map(
      (option) => option.firstChild?.textContent,
    ),
  ).toEqual(["All officers · Speech", "All officers · Action"]);
});

it("ranks roles whose names start with the query first", () => {
  const editor = setup();
  type(editor, "/hi");
  const labels = [...document.querySelectorAll('[role="option"]')]
    .map((option) => option.firstChild?.textContent)
    .filter((label) => label?.endsWith("Speech"));
  expect(labels.slice(0, 2)).toEqual([
    "Hierophant · Speech",
    "Hiereus · Speech",
  ]);
  expect(labels).toContain("Past Hierophant · Speech");
  expect(labels.indexOf("Past Hierophant · Speech")).toBeGreaterThan(1);
});

it("inserts a note with the caret inside it", () => {
  const editor = setup();
  type(editor, "/note");
  expect(press(editor, "Enter")).toBe(true);
  expect(editor.state.doc.firstChild?.attrs.tag).toBe("note");
  type(editor, "Mind the step");
  expect(semanticFromTiptap(editor.getJSON()).nodes[0]).toMatchObject({
    tag: "note",
    children: [{ kind: "text", text: "Mind the step" }],
  });
});

it("inserts a section title whose placeholder typing replaces", () => {
  const editor = setup();
  type(editor, "/title");
  expect(press(editor, "Enter")).toBe(true);
  expect(editor.state.doc.firstChild?.attrs.tag).toBe("title");
  type(editor, "Closing");
  expect(semanticFromTiptap(editor.getJSON()).nodes[0]).toMatchObject({
    tag: "title",
    attrs: { text: "Closing" },
  });
});

it("hints at slash commands in an empty line that accepts them", () => {
  const editor = setup([p("Existing"), p()]);
  const hinted = () =>
    [...editor.view.dom.querySelectorAll("[data-hint]")].map((node) =>
      node.getAttribute("data-hint"),
    );
  expect(RITUAL_SLASH_HINT).toBe(
    "Type / for speech, action, note or section title",
  );
  expect(hinted()).toEqual([RITUAL_SLASH_HINT]);
  type(editor, "x");
  expect(hinted()).toEqual([]);
  // An empty task body keeps its own speech/action hint instead.
  const empty = setup([task(p())]);
  expect([...empty.view.dom.querySelectorAll("[data-hint]")].length).toBe(0);
});

it("leaves a task on Enter in its empty last paragraph", () => {
  const editor = setup([task(p("Welcome."), p())]);
  expect(press(editor, "Enter")).toBe(true);
  expect(editor.state.doc.childCount).toBe(2);
  expect(editor.state.doc.firstChild?.childCount).toBe(1);
  expect(editor.state.doc.lastChild?.type.name).toBe("paragraph");
  expect(editor.state.selection.$from.parent).toBe(editor.state.doc.lastChild);
  // A task's only paragraph stays put.
  const single = setup([task(p())]);
  expect(press(single, "Enter")).toBe(false);
});

it("offers a section title only at the top level", () => {
  const note = (...content: JSONContent[]): JSONContent => ({
    type: "ritualBlock",
    attrs: { id: "Note000000000001", tag: "note", attrs: {} },
    content,
  });
  const editor = setup([note(p("Inside"), p())]);
  expect(
    editor.view.dom.querySelector("[data-hint]")?.getAttribute("data-hint"),
  ).toBe("Type / for speech, action or note");
  type(editor, "/tit");
  expect(document.querySelectorAll('[role="option"]')).toHaveLength(0);
});
