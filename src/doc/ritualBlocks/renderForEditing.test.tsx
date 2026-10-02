// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import { DOMParser, DOMSerializer } from "@tiptap/pm/model";
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
