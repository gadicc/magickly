// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { afterEach, expect, it, vi } from "vitest";
import RitualVisualControls from "./RitualVisualControls";
import { printRitualSource } from "./ritualSource";
import { semanticFromJrt } from "./semantic";
import { semanticFromTiptap, semanticToTiptap } from "./tiptapRitual";
import { ritualTiptapClientExtensions } from "./tiptapRitualClient";

vi.mock("@/lib/upload", () => ({ default: () => null }));
Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(),
});
afterEach(cleanup);

const task = () => ({
  type: "task",
  role: "hiero",
  say: true,
  children: [{ type: "text", value: "Body" }],
});
const declaration = () => ({
  type: "declareVar",
  name: "myRole",
  varType: "select",
  children: [{ type: "option", value: "scribe", label: "Temple Scribe" }],
});
const fixture = () => semanticFromJrt({ children: [declaration(), task()] });
function Host({
  document = fixture(),
  syncingSource = false,
}: {
  document?: ReturnType<typeof fixture>;
  syncingSource?: boolean;
}) {
  const editor = useEditor({
    extensions: ritualTiptapClientExtensions,
    content: semanticToTiptap(document),
    immediatelyRender: false,
    editorProps: {
      attributes: { role: "textbox", "aria-label": "Settings fixture editor" },
    },
  });
  return (
    <>
      {editor && (
        <RitualVisualControls
          editor={editor}
          disabled={false}
          syncingSource={syncingSource}
        />
      )}
      <EditorContent editor={editor} />
    </>
  );
}
async function setup(document = fixture()) {
  const view = render(<Host document={document} />);
  const dom = await screen.findByRole("textbox", {
    name: "Settings fixture editor",
  });
  await waitFor(() =>
    expect(dom.querySelector("[data-ritual-frame]")).toBeTruthy(),
  );
  const editor = (dom as HTMLElement & { editor: Editor }).editor;
  return { editor, dom, view, document };
}
function locate(editor: Editor) {
  let result = { pos: 0, node: editor.state.doc.firstChild! };
  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.tag === "task") result = { node, pos };
  });
  return result;
}
async function openCog(scope: Pick<typeof screen, "getByRole"> = screen) {
  fireEvent.click(
    scope.getByRole("button", { name: "Task settings for Hierophant" }),
  );
  return await screen.findByRole("dialog", { name: "Task settings" });
}
function chooseBasis(name: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Assigned to" }));
  fireEvent.click(screen.getByRole("option", { name }));
}
function enterRole(value: string, label = "Roles") {
  const input = screen.getByRole("combobox", { name: label });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

it("applies role and type together, preserving identity, body, selection and a separate typing undo", async () => {
  const { editor } = await setup();
  const original = locate(editor);
  act(() => editor.commands.insertContentAt(original.pos + 2, "Typed "));
  const selection = editor.state.selection.toJSON();
  const before = semanticFromTiptap(editor.getJSON());
  await openCog();
  fireEvent.click(screen.getByRole("button", { name: "Do / Action" }));
  chooseBasis("All officers");
  enterRole("phylax", "Except (optional)");
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(locate(editor).node.attrs).toMatchObject({
    id: original.node.attrs.id,
    attrs: { role: "all-officers-except-sentinel", do: true },
  });
  expect(locate(editor).node.textContent).toBe("Typed Body");
  expect(editor.state.selection.toJSON()).toEqual(selection);
  expect(printRitualSource(semanticFromTiptap(editor.getJSON()))).toContain(
    "All-officers-except-sentinel",
  );
  act(() => editor.commands.undo());
  expect(semanticFromTiptap(editor.getJSON())).toEqual(before);
  act(() => editor.commands.redo());
  expect(locate(editor).node.attrs.attrs.do).toBe(true);
  act(() => editor.commands.undo());
  act(() => editor.commands.undo());
  expect(locate(editor).node.textContent).toBe("Body");
});

it("opens the same form from Edit properties and retains original alias spelling on a type-only change", async () => {
  const { editor } = await setup();
  act(() => editor.commands.setTextSelection(locate(editor).pos + 2));
  fireEvent.click(screen.getByRole("button", { name: "Edit properties" }));
  await screen.findByRole("dialog", { name: "Task settings" });
  fireEvent.click(screen.getByRole("button", { name: "Do / Action" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(locate(editor).node.attrs.attrs).toEqual({ role: "hiero", do: true });
});

it("searches declared labels and aliases and accepts custom role keys", async () => {
  const { editor } = await setup();
  await openCog();
  chooseBasis("Everyone");
  const input = screen.getByRole("combobox", { name: "Except (optional)" });
  fireEvent.change(input, { target: { value: "Temple" } });
  fireEvent.click(await screen.findByRole("option", { name: "Temple Scribe" }));
  enterRole("ritualHelper", "Except (optional)");
  fireEvent.change(input, { target: { value: "phylax" } });
  fireEvent.click(await screen.findByRole("option", { name: "Sentinel" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(locate(editor).node.attrs.attrs.role).toBe(
    "all-except-scribe,ritualHelper,sentinel",
  );
});

it("commits pending custom input on blur before Apply", async () => {
  const { editor } = await setup();
  await openCog();
  chooseBasis("Everyone");
  const input = screen.getByRole("combobox", { name: "Except (optional)" });
  fireEvent.change(input, { target: { value: "helper" } });
  fireEvent.blur(input);
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(locate(editor).node.attrs.attrs.role).toBe("all-except-helper");
});

it.each(["", "bad_role", "all"])(
  "rejects an empty, invalid or reserved selected role: %s",
  async (value) => {
    const { editor } = await setup();
    const before = editor.getJSON();
    await openCog();
    chooseBasis("Everyone");
    chooseBasis("Selected roles");
    if (value) enterRole(value);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(editor.getJSON()).toEqual(before);
  },
);

it("makes Cancel and unchanged Apply no-ops", async () => {
  const { editor } = await setup();
  const before = editor.getJSON();
  await openCog();
  fireEvent.click(screen.getByRole("button", { name: "Do / Action" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await openCog();
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(editor.getJSON()).toEqual(before);
  expect(editor.can().undo()).toBe(false);
});

it("rejects stale settings but follows a task whose position moved", async () => {
  const { editor } = await setup();
  await openCog();
  act(() => {
    const { pos, node } = locate(editor);
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        attrs: { say: true, role: "keryx" },
      }),
    );
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "This task changed. Close and reopen its settings.",
  );
  expect(locate(editor).node.attrs.attrs.role).toBe("keryx");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(
    screen.getByRole("button", { name: "Task settings for Keryx" }),
  );
  await screen.findByRole("dialog");
  act(() =>
    editor.commands.insertContentAt(0, {
      type: "paragraph",
      content: [{ type: "text", text: "Prefix" }],
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Do / Action" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(locate(editor).node.attrs.attrs).toEqual({ do: true, role: "keryx" });
});

it.each(["locked", "deleted"])(
  "closes a portal when its task is %s",
  async (change) => {
    const { editor } = await setup();
    await openCog();
    act(() => {
      if (change === "locked") editor.setEditable(false);
      else {
        const { pos, node } = locate(editor);
        editor.commands.deleteRange({ from: pos, to: pos + node.nodeSize });
      }
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    if (change === "locked") {
      act(() => editor.setEditable(true));
      expect(screen.queryByRole("dialog")).toBeNull();
    }
  },
);

it("uses canonical role declarations and isolates settings undo for a task inside a collected footnote", async () => {
  const document = semanticFromJrt({
    children: [
      declaration(),
      { type: "footnote", children: [task()] },
      { type: "footnotes" },
    ],
  });
  const { editor, dom } = await setup(document);
  fireEvent.click(dom.querySelector("button[data-footnote-reference]")!);
  const footnote = await screen.findByRole("textbox", {
    name: "Footnote 1 editor",
  });
  const inner = (footnote as HTMLElement & { editor: Editor }).editor;
  act(() => inner.commands.setTextSelection(locate(inner).pos + 2));
  act(() => inner.commands.insertContentAt(locate(inner).pos + 2, "Typed "));
  const before = semanticFromTiptap(editor.getJSON());
  await openCog(within(footnote));
  const input = screen.getByRole("combobox", { name: "Roles" });
  fireEvent.change(input, { target: { value: "Temple" } });
  fireEvent.click(await screen.findByRole("option", { name: "Temple Scribe" }));
  fireEvent.click(screen.getByRole("button", { name: "Do / Action" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(locate(editor).node.attrs.attrs).toEqual({
    do: true,
    role: "hiero,scribe",
  });
  act(() => editor.commands.undo());
  expect(semanticFromTiptap(editor.getJSON())).toEqual(before);
  expect(locate(inner).node.textContent).toBe("Typed Body");
  act(() => editor.commands.undo());
  expect(locate(editor).node.textContent).toBe("Body");
});

it("retains distinct case-sensitive custom role keys when another role is added", async () => {
  const document = semanticFromJrt({
    children: [
      {
        type: "declareVar",
        name: "myRole",
        varType: "select",
        children: [
          { type: "option", value: "scribe", label: "A lower" },
          { type: "option", value: "Scribe", label: "Z upper" },
        ],
      },
      { ...task(), role: "Scribe" },
    ],
  });
  const { editor } = await setup(document);
  fireEvent.click(
    screen.getByRole("button", { name: "Task settings for Scribe" }),
  );
  await screen.findByRole("dialog");
  enterRole("keryx");
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(locate(editor).node.attrs.attrs.role).toBe("Scribe,keryx");
});

it.each(["roles", "all"])(
  "rejects reserved all mixed into the %s picker",
  async (basis) => {
    const { editor } = await setup();
    const before = editor.getJSON();
    await openCog();
    if (basis === "all") chooseBasis("Everyone");
    enterRole("all", basis === "all" ? "Except (optional)" : "Roles");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(editor.getJSON()).toEqual(before);
  },
);

it("closes toolbar settings while source owns the document without resurrecting the draft", async () => {
  const { editor, view, document } = await setup();
  act(() => editor.commands.setTextSelection(locate(editor).pos + 2));
  fireEvent.click(screen.getByRole("button", { name: "Edit properties" }));
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "Do / Action" }));
  view.rerender(<Host document={document} syncingSource />);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  view.rerender(<Host document={document} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(locate(editor).node.attrs.attrs.say).toBe(true);
});

it("closes a nested task portal when its parent becomes read-only", async () => {
  const document = semanticFromJrt({
    children: [
      declaration(),
      { type: "footnote", children: [task()] },
      { type: "footnotes", children: [] },
    ],
  });
  const { editor, dom } = await setup(document);
  fireEvent.click(dom.querySelector("button[data-footnote-reference]")!);
  const footnote = await screen.findByRole("textbox", {
    name: "Footnote 1 editor",
  });
  await openCog(within(footnote));
  act(() => editor.setEditable(false));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  act(() => editor.setEditable(true));
  expect(screen.queryByRole("dialog")).toBeNull();
});
