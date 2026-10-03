// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import { DOMParser, DOMSerializer } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor } from "@tiptap/react";
import { afterEach, expect, it } from "vitest";
import { formatRitualFileLocator } from "@/files/ritualFileLocator";
import { createUuidV7 } from "@/lib/ids";
import { semanticFromJrt } from "../semantic";
import {
  ritualTiptapExtensions,
  semanticFromTiptap,
  semanticToTiptap,
} from "../tiptapRitual";
import { ritualTiptapClientExtensions } from "../tiptapRitualClient";

Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(),
});
afterEach(cleanup);

const taskDocument = () =>
  semanticFromJrt({
    children: [
      {
        type: "task",
        role: "hiero",
        say: true,
        children: [
          { type: "text", value: "Welcome " },
          { type: "var", name: "candidate" },
          { type: "text", value: "." },
        ],
      },
    ],
  });
function Host({ document }: { document: ReturnType<typeof taskDocument> }) {
  const editor = useEditor({
    extensions: ritualTiptapClientExtensions,
    content: semanticToTiptap(document),
    immediatelyRender: false,
    editorProps: {
      attributes: { role: "textbox", "aria-label": "Fixture visual editor" },
    },
  });
  return <EditorContent editor={editor} />;
}
async function editorFromScreen() {
  const dom = await screen.findByRole("textbox", {
    name: "Fixture visual editor",
  });
  await waitFor(() =>
    expect(dom.querySelector("[data-ritual-frame]")).toBeTruthy(),
  );
  return { dom, editor: (dom as HTMLElement & { editor: Editor }).editor };
}

it("keeps editable child DOM and selection stable across task properties and selection", async () => {
  const original = taskDocument();
  render(<Host document={original} />);
  const { dom, editor } = await editorFromScreen();
  const content = dom.querySelector("[data-node-view-content-react]");
  const paragraph = content?.querySelector("p");
  const task = editor.state.doc.firstChild!;
  act(() => {
    editor.commands.setTextSelection(3);
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(0, undefined, {
        ...task.attrs,
        attrs: { do: true, role: "keryx" },
      }),
    );
  });
  await screen.findByText("Keryx");
  expect(dom.querySelector("[data-node-view-content-react]")).toBe(content);
  expect(content?.querySelector("p")).toBe(paragraph);
  expect(editor.state.selection.from).toBe(3);
  expect(semanticFromTiptap(editor.getJSON()).nodes[0]).toMatchObject({
    id: task.attrs.id,
    attrs: { do: true, role: "keryx" },
  });
  act(() => editor.commands.undo());
  expect(semanticFromTiptap(editor.getJSON())).toEqual(original);
});

it("keeps summary content exposed and author-only annotations outside the reader model", async () => {
  const document = semanticFromJrt({
    children: [
      {
        type: "summary",
        summary: "Pronunciation",
        children: [{ type: "text", value: "Speak clearly." }],
      },
    ],
  });
  document.nodes.unshift(
    { kind: "annotation", style: "comment", text: "Private author note" },
    { kind: "annotation", style: "blank", text: "" },
  );
  render(<Host document={document} />);
  const { dom, editor } = await editorFromScreen();
  expect(screen.getByText("Speak clearly.")).toBeTruthy();
  expect(dom.querySelector("details")).toBeNull();
  expect(screen.getByText(/Private author note/)).toBeTruthy();
  expect(semanticFromTiptap(editor.getJSON())).toEqual(document);
});

it("uses shared frames for titles, notes and grades while leaving variables as author tokens", async () => {
  const document = semanticFromJrt({
    children: [
      {
        type: "title",
        text: "Opening",
        children: [{ type: "text", value: "Opening" }],
      },
      {
        type: "note",
        children: [
          { type: "text", value: "At " },
          { type: "grade", grade: "0=0" },
          { type: "var", name: "candidate" },
        ],
      },
    ],
  });
  render(<Host document={document} />);
  const { dom, editor } = await editorFromScreen();
  for (const tag of ["title", "note", "grade"])
    expect(dom.querySelector(`[data-ritual-frame="${tag}"]`)).toBeTruthy();
  expect(
    dom.querySelector('[data-ritual-inline="var"]')?.textContent,
  ).toContain("candidate");
  expect(semanticFromTiptap(editor.getJSON())).toEqual(document);
});

it("does not fetch arbitrary image URLs and retains scoped attachment dimensions", async () => {
  const src = formatRitualFileLocator({
    ritualId: createUuidV7(),
    attachmentId: createUuidV7(),
    fileId: createUuidV7(),
  });
  const document = semanticFromJrt({
    children: [
      {
        type: "img",
        src: "https://example.invalid/private-image",
        alt: "External",
      },
      {
        type: "img",
        src,
        alt: "Attached",
        width: 16,
        height: 12,
        style: '{"width":"16px"}',
      },
    ],
  });
  render(<Host document={document} />);
  const dom = await screen.findByRole("textbox", {
    name: "Fixture visual editor",
  });
  const image = await screen.findByRole("img", { name: "Attached" });
  expect(dom.querySelectorAll("img")).toHaveLength(1);
  expect(image.getAttribute("src")).toBe(src);
  expect(image.getAttribute("width")).toBe("16");
  expect(image.getAttribute("height")).toBe("12");
  expect((image as HTMLImageElement).style.width).toBe("16px");
});

it("keeps client node views out of clipboard HTML and preserves schema round trips", () => {
  const original = taskDocument();
  const client = getSchema(ritualTiptapClientExtensions);
  const base = getSchema(ritualTiptapExtensions);
  const content = semanticToTiptap(original);
  const html = (schema: typeof client) => {
    const container = document.createElement("div");
    container.append(
      DOMSerializer.fromSchema(schema).serializeFragment(
        schema.nodeFromJSON(content).content,
      ),
    );
    return container;
  };
  const container = html(client);
  expect(container.innerHTML).toBe(html(base).innerHTML);
  expect(container.innerHTML).not.toContain("data-ritual-frame");
  expect(
    semanticFromTiptap(DOMParser.fromSchema(client).parse(container).toJSON()),
  ).toEqual(original);
});

it.each([
  "{",
  '{"width":"16px","backgroundImage":"url(https://example.invalid/track)","position":"fixed","zIndex":9999}',
  '{"width":"url(https://example.invalid/track)","height":-100}',
])(
  "contains unsafe or malformed clipboard image styling: %s",
  async (style) => {
    const src = formatRitualFileLocator({
      ritualId: createUuidV7(),
      attachmentId: createUuidV7(),
      fileId: createUuidV7(),
    });
    const document = semanticFromJrt({
      children: [{ type: "img", src, alt: "Safe preview" }],
    });
    render(<Host document={document} />);
    const { editor } = await editorFromScreen();
    const node = editor.state.doc.firstChild!;
    // A pasted node is rendered before the host's semantic onUpdate validation.
    act(() =>
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(0, undefined, {
          ...node.attrs,
          attrs: { ...node.attrs.attrs, style },
        }),
      ),
    );
    const image = (await screen.findByRole("img", {
      name: "Safe preview",
    })) as HTMLImageElement;
    expect(image.style.backgroundImage).toBe("");
    expect(image.style.position).toBe("");
    expect(image.style.zIndex).toBe("");
    expect(image.style.width).not.toContain("url");
    expect(image.style.height).not.toBe("-100px");
  },
);

it("contains malformed clipboard image dimensions before semantic validation", async () => {
  const src = formatRitualFileLocator({
    ritualId: createUuidV7(),
    attachmentId: createUuidV7(),
    fileId: createUuidV7(),
  });
  const document = semanticFromJrt({
    children: [{ type: "img", src, alt: "Dimension preview" }],
  });
  render(<Host document={document} />);
  const { editor } = await editorFromScreen();
  const node = editor.state.doc.firstChild!;
  act(() =>
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(0, undefined, {
        ...node.attrs,
        attrs: {
          ...node.attrs.attrs,
          width: { toString: null, valueOf: null },
          height: { toString: null, valueOf: null },
        },
      }),
    ),
  );
  const image = await screen.findByRole("img", { name: "Dimension preview" });
  expect(image.getAttribute("width")).toBeNull();
  expect(image.getAttribute("height")).toBeNull();
});

function footnoteDocument() {
  return semanticFromJrt({
    children: [
      {
        type: "task",
        role: "hiero",
        say: true,
        children: [
          { type: "text", value: "Before " },
          {
            type: "footnote",
            children: [{ type: "text", value: "First body" }],
          },
          { type: "text", value: " after." },
          {
            type: "footnote",
            children: [{ type: "text", value: "Second body" }],
          },
        ],
      },
    ],
  });
}

it("collects editable footnotes outside speech while keeping original children and identities", async () => {
  const original = footnoteDocument();
  render(<Host document={original} />);
  const { dom, editor } = await editorFromScreen();
  await waitFor(() =>
    expect(
      dom.querySelectorAll('[data-ritual-frame="footnotes"] li'),
    ).toHaveLength(2),
  );
  expect(
    [...dom.querySelectorAll("button[data-footnote-reference]")].map(
      (button) => button.textContent,
    ),
  ).toEqual(["1", "2"]);
  const canonical = dom.querySelector(
    '[data-ritual-block="footnote"] [data-node-view-content]',
  );
  expect(canonical?.getAttribute("style")).toContain("display: none");
  expect(
    dom.querySelector("[data-footnote-footer]")?.closest(".say"),
  ).toBeNull();
  expect(semanticFromTiptap(editor.getJSON())).toEqual(original);
  fireEvent.click(dom.querySelector("button[data-footnote-reference]")!);
  const footnote = await screen.findByRole("textbox", {
    name: "Footnote 1 editor",
  });
  const inner = (footnote as HTMLElement & { editor: Editor }).editor;
  act(() => inner.commands.setTextSelection(1));
  act(() => inner.commands.insertContent("Changed "));
  expect(editor.state.doc.textContent).toContain("Changed First body");
  expect(semanticFromTiptap(editor.getJSON()).nodes[0]).toMatchObject({
    id: original.nodes[0].kind === "element" ? original.nodes[0].id : "",
  });
  expect(
    dom.querySelector(
      '[data-ritual-block="footnote"] [data-node-view-content]',
    ),
  ).toBe(canonical);
  act(() => editor.commands.undo());
  expect(semanticFromTiptap(editor.getJSON())).toEqual(original);
  await waitFor(() => expect(footnote.textContent).toBe("First body"));
  act(() => editor.commands.redo());
  await waitFor(() => expect(footnote.textContent).toBe("Changed First body"));
});

it("routes footer selection and formatting through parent history and respects parent read-only state", async () => {
  const original = footnoteDocument();
  render(<Host document={original} />);
  const { dom, editor } = await editorFromScreen();
  fireEvent.click(dom.querySelector("button[data-footnote-reference]")!);
  const footnote = await screen.findByRole("textbox", {
    name: "Footnote 1 editor",
  });
  const inner = (footnote as HTMLElement & { editor: Editor }).editor;
  act(() => inner.commands.setTextSelection({ from: 1, to: 6 }));
  act(() => editor.chain().toggleBold().run());
  const changed = semanticFromTiptap(editor.getJSON()).nodes[0];
  expect(changed.kind === "element" && changed.children?.[1]).toMatchObject({
    children: [{ tag: "b", children: [{ text: "First" }] }, { text: " body" }],
  });
  act(() => editor.commands.undo());
  expect(semanticFromTiptap(editor.getJSON())).toEqual(original);
  act(() => editor.setEditable(false));
  expect(footnote.getAttribute("contenteditable")).toBe("false");
  act(() => inner.commands.insertContent("Rejected"));
  expect(semanticFromTiptap(editor.getJSON())).toEqual(original);
  expect(footnote.textContent).not.toContain("Rejected");
});

it("retires the footer editor when its canonical footnote is deleted", async () => {
  const original = footnoteDocument();
  render(<Host document={original} />);
  const { dom, editor } = await editorFromScreen();
  fireEvent.click(dom.querySelector("button[data-footnote-reference]")!);
  await screen.findByRole("textbox", { name: "Footnote 1 editor" });
  let pos = 0,
    size = 0;
  editor.state.doc.descendants((node, at) => {
    if (!size && node.attrs.tag === "footnote") {
      pos = at;
      size = node.nodeSize;
    }
  });
  act(() => editor.commands.deleteRange({ from: pos, to: pos + size }));
  await waitFor(() =>
    expect(
      screen.queryByRole("textbox", { name: "Footnote 1 editor" }),
    ).toBeNull(),
  );
  expect(
    dom.querySelector("button[data-footnote-reference]")?.textContent,
  ).toBe("1");
  const remaining = semanticFromTiptap(editor.getJSON()).nodes[0];
  expect(
    remaining.kind === "element" &&
      remaining.children?.filter(
        (node) => node.kind === "element" && node.tag === "footnote",
      ),
  ).toMatchObject([{ children: [{ text: "Second body" }] }]);
});

it("shares list markers, todo formatting and reader-like breaks", async () => {
  const document = semanticFromJrt({
    children: [
      {
        type: "ol",
        children: [
          { type: "li", children: [{ type: "text", value: "One" }] },
          {
            type: "li",
            children: [
              {
                type: "ul",
                children: [
                  { type: "li", children: [{ type: "text", value: "Nested" }] },
                ],
              },
            ],
          },
        ],
      },
      { type: "todo", children: [{ type: "text", value: "Check" }] },
      { type: "text", value: "Before" },
      { type: "br" },
      { type: "text", value: "After" },
    ],
  });
  render(<Host document={document} />);
  const { dom, editor } = await editorFromScreen();
  expect(dom.querySelectorAll('[data-ritual-frame="li"]')).toHaveLength(3);
  expect(
    dom.querySelectorAll('[data-ritual-frame="ol"], [data-ritual-frame="ul"]'),
  ).toHaveLength(2);
  expect(
    dom.querySelector('[data-ritual-frame="todo"]')?.textContent,
  ).toContain("TODO: Check");
  expect(dom.querySelector('[data-ritual-inline="br"] br')).toBeTruthy();
  expect(semanticFromTiptap(editor.getJSON())).toEqual(document);
});

it("inserts into an empty collected note, undoes to empty, and rejects read-only edits", async () => {
  const original = semanticFromJrt({
    children: [
      {
        type: "task",
        say: true,
        role: "hiero",
        children: [
          { type: "text", value: "Text" },
          { type: "footnote", children: [] },
        ],
      },
    ],
  });
  render(<Host document={original} />);
  const { dom, editor } = await editorFromScreen();
  fireEvent.click(dom.querySelector("button[data-footnote-reference]")!);
  const textbox = await screen.findByRole("textbox", {
    name: "Footnote 1 editor",
  });
  const inner = (textbox as HTMLElement & { editor: Editor }).editor;
  expect(semanticFromTiptap(editor.getJSON())).toEqual(original);
  act(() => inner.commands.insertContent("New note"));
  expect(editor.state.doc.textContent).toContain("New note");
  act(() => editor.commands.undo());
  expect(semanticFromTiptap(editor.getJSON())).toEqual(original);
  act(() => editor.setEditable(false));
  act(() => inner.commands.insertContent("Rejected"));
  expect(semanticFromTiptap(editor.getJSON())).toEqual(original);
  expect(textbox.textContent).not.toContain("Rejected");
});

it("mirrors inline atom selections in both directions", async () => {
  const original = semanticFromJrt({
    children: [
      {
        type: "task",
        say: true,
        role: "hiero",
        children: [
          { type: "text", value: "Text" },
          {
            type: "footnote",
            children: [
              { type: "text", value: "Before " },
              { type: "var", name: "candidate" },
              { type: "text", value: " after" },
            ],
          },
        ],
      },
    ],
  });
  render(<Host document={original} />);
  const { dom, editor } = await editorFromScreen();
  fireEvent.click(dom.querySelector("button[data-footnote-reference]")!);
  const textbox = await screen.findByRole("textbox", {
    name: "Footnote 1 editor",
  });
  const inner = (textbox as HTMLElement & { editor: Editor }).editor;
  let atom = 0;
  inner.state.doc.descendants((node, pos) => {
    if (node.attrs.tag === "var") atom = pos;
  });
  act(() => inner.commands.setTextSelection({ from: atom, to: atom + 1 }));
  act(() => inner.commands.setNodeSelection(atom));
  expect(editor.state.selection).toBeInstanceOf(NodeSelection);
  expect((editor.state.selection as NodeSelection).node.attrs.tag).toBe("var");
  const parentPos = editor.state.selection.from;
  act(() =>
    editor.commands.setTextSelection({ from: parentPos, to: parentPos + 1 }),
  );
  act(() => editor.commands.setNodeSelection(parentPos));
  expect(inner.state.selection).toBeInstanceOf(NodeSelection);
  expect((inner.state.selection as NodeSelection).node.attrs.tag).toBe("var");
  expect(semanticFromTiptap(editor.getJSON())).toEqual(original);
});

it("updates inactive footer controls without opening another editor", async () => {
  render(<Host document={footnoteDocument()} />);
  const { dom, editor } = await editorFromScreen();
  const buttons = await screen.findAllByRole("button", {
    name: "Edit footnote 1",
  });
  act(() => editor.setEditable(false));
  await waitFor(() =>
    buttons.forEach((button) =>
      expect(button.getAttribute("aria-disabled")).toBe("true"),
    ),
  );
  buttons.forEach((button) => fireEvent.click(button));
  expect(
    screen.queryByRole("textbox", { name: "Footnote 1 editor" }),
  ).toBeNull();
  expect(dom.querySelectorAll("[data-footnote-footer]")).toHaveLength(1);
});

it("projects parent replacement into an active footer without restoring stale text", async () => {
  render(<Host document={footnoteDocument()} />);
  const { dom, editor } = await editorFromScreen();
  fireEvent.click(dom.querySelector("button[data-footnote-reference]")!);
  const textbox = await screen.findByRole("textbox", {
    name: "Footnote 1 editor",
  });
  const inner = (textbox as HTMLElement & { editor: Editor }).editor;
  act(() => inner.commands.setTextSelection(6));
  let pos = 0,
    size = 0;
  editor.state.doc.descendants((node, at) => {
    if (!size && node.attrs.tag === "footnote") {
      pos = at;
      size = node.content.size;
    }
  });
  act(() => {
    const tr = editor.state.tr.replaceWith(
      pos + 1,
      pos + 1 + size,
      editor.schema.nodes.paragraph.create(null, editor.schema.text("New")),
    );
    editor.view.dispatch(
      tr.setSelection(TextSelection.create(tr.doc, pos + 5)),
    );
  });
  await waitFor(() => expect(textbox.textContent).toBe("New"));
  act(() => inner.commands.insertContent("!"));
  expect(editor.state.doc.textContent).toContain("New!");
  expect(editor.state.doc.textContent).not.toContain("First body");
});

it("keeps uncollected notes visible and preserves explicit collection children", async () => {
  const original = semanticFromJrt({
    children: [
      {
        type: "footnotes",
        children: [{ type: "text", value: "Stored host child" }],
      },
      {
        type: "footnote",
        children: [{ type: "text", value: "Uncollected body" }],
      },
    ],
  });
  render(<Host document={original} />);
  const { dom, editor } = await editorFromScreen();
  expect(screen.getByText(/no active reader destination/)).toBeTruthy();
  expect(screen.getByText("Uncollected body")).toBeTruthy();
  expect(
    dom
      .querySelector('[data-ritual-block="footnotes"] [data-node-view-content]')
      ?.getAttribute("style"),
  ).toContain("display: none");
  expect(semanticFromTiptap(editor.getJSON())).toEqual(original);
});

it.each(["toggleBold", "toggleItalic"] as const)(
  "carries caret %s from the main toolbar into typed footer text",
  async (command) => {
    render(<Host document={footnoteDocument()} />);
    const { dom, editor } = await editorFromScreen();
    fireEvent.click(dom.querySelector("button[data-footnote-reference]")!);
    const textbox = await screen.findByRole("textbox", {
      name: "Footnote 1 editor",
    });
    const inner = (textbox as HTMLElement & { editor: Editor }).editor;
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    act(() => inner.commands.setTextSelection(3));
    act(() => editor.chain().focus()[command]().run());
    expect(
      inner.state.storedMarks?.some(
        (mark) =>
          mark.type.name === (command === "toggleBold" ? "bold" : "italic"),
      ),
    ).toBe(true);
    act(() => inner.commands.insertContent("NEW"));
    const task = semanticFromTiptap(editor.getJSON()).nodes[0];
    expect(task.kind === "element" && task.children?.[1]).toMatchObject({
      children: [
        { text: "Fi" },
        {
          tag: command === "toggleBold" ? "b" : "i",
          children: [{ text: "NEW" }],
        },
        { text: "rst body" },
      ],
    });
  },
);

it("retains backward selection direction in both footer and parent", async () => {
  render(<Host document={footnoteDocument()} />);
  const { dom, editor } = await editorFromScreen();
  fireEvent.click(dom.querySelector("button[data-footnote-reference]")!);
  const textbox = await screen.findByRole("textbox", {
    name: "Footnote 1 editor",
  });
  const inner = (textbox as HTMLElement & { editor: Editor }).editor;
  act(() =>
    inner.view.dispatch(
      inner.state.tr.setSelection(TextSelection.create(inner.state.doc, 6, 2)),
    ),
  );
  expect(editor.state.selection.anchor - editor.state.selection.head).toBe(4);
  expect(inner.state.selection.anchor).toBe(6);
  expect(inner.state.selection.head).toBe(2);
});

it("places a task's explicit collection outside its speech without moving stored children", async () => {
  const original = footnoteDocument();
  const task = original.nodes[0];
  if (task.kind !== "element") throw new Error("Fixture task");
  const host = semanticFromJrt({
    children: [
      {
        type: "footnotes",
        children: [{ type: "text", value: "Ignored but preserved" }],
      },
    ],
  }).nodes[0];
  task.children!.unshift(host);
  render(<Host document={original} />);
  const { dom, editor } = await editorFromScreen();
  const footer = dom.querySelector("[data-footnote-footer]")!;
  expect(footer.closest(".say")).toBeNull();
  expect(dom.querySelectorAll("[data-footnote-footer]")).toHaveLength(1);
  expect(
    dom
      .querySelector("[data-task-collection] [data-node-view-content]")
      ?.getAttribute("style"),
  ).toContain("display: none");
  expect(semanticFromTiptap(editor.getJSON())).toEqual(original);
  fireEvent.click(footer.querySelector("button")!);
  const textbox = await screen.findByRole("textbox", {
    name: "Footnote 1 editor",
  });
  const inner = (textbox as HTMLElement & { editor: Editor }).editor;
  act(() => inner.commands.insertContent("Explicit "));
  expect(editor.state.doc.textContent).toContain("Explicit First body");
});

it("remounts an inactive reader preview when its hookful task shape changes", async () => {
  const original = semanticFromJrt({
    children: [
      { type: "text", value: "Intro" },
      {
        type: "footnote",
        children: [
          {
            type: "task",
            say: true,
            role: "hiero",
            children: [{ type: "text", value: "First task" }],
          },
        ],
      },
      { type: "footnotes" },
    ],
  });
  render(<Host document={original} />);
  const { dom, editor } = await editorFromScreen();
  let pos = 0,
    size = 0;
  editor.state.doc.descendants((node, at) => {
    if (node.attrs.tag === "footnote") {
      pos = at;
      size = node.content.size;
      return false;
    }
  });
  const content = semanticToTiptap(
    semanticFromJrt({
      children: [
        {
          type: "task",
          say: true,
          role: "keryx",
          children: [{ type: "text", value: "Second task" }],
        },
      ],
    }),
  );
  const task = editor.schema.nodeFromJSON(content.content![0]);
  act(() => editor.view.dispatch(editor.state.tr.insert(pos + 1 + size, task)));
  await waitFor(() =>
    expect(dom.querySelector("[data-footnote-footer]")?.textContent).toContain(
      "Second task",
    ),
  );
  expect(dom.querySelector("[data-footnote-footer]")?.textContent).toContain(
    "First task",
  );
});
