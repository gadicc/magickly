// @vitest-environment jsdom

import { Editor, getSchema } from "@tiptap/core";
import { DOMParser, DOMSerializer } from "@tiptap/pm/model";
import { expect, it } from "vitest";
import { createUuidV7 } from "../lib/ids";
import { semanticFromJrt, semanticToJrt } from "./semantic";
import {
  normalizeTiptapNodeIds,
  ritualTiptapExtensions,
  semanticFromTiptap,
  semanticToTiptap,
} from "./tiptapRitual";

it("preserves task identity, roles, and inline content through clipboard HTML", () => {
  const original = semanticFromJrt({
    children: [
      {
        type: "task",
        say: true,
        role: "hiero",
        children: [
          { type: "text", value: "Welcome " },
          { type: "var", name: "candidate" },
        ],
      },
      {
        type: "task",
        do: true,
        role: "keryx",
        children: [{ type: "text", value: "Open the door." }],
      },
    ],
  });
  const schema = getSchema(ritualTiptapExtensions);
  const source = schema.nodeFromJSON(semanticToTiptap(original));
  const container = document.createElement("div");
  container.append(
    DOMSerializer.fromSchema(schema).serializeFragment(source.content),
  );

  const pasted = DOMParser.fromSchema(schema).parse(container);
  pasted.check();
  const result = semanticFromTiptap(pasted.toJSON());
  expect(semanticToJrt(result)).toEqual(semanticToJrt(original));
  expect(result.nodes.map((node) => "id" in node && node.id)).toEqual(
    original.nodes.map((node) => "id" in node && node.id),
  );
});

it("keeps a large opaque legacy node intact when copied", () => {
  const original = semanticFromJrt({
    children: [{ type: "customLegacyNode", payload: "x".repeat(25_000) }],
  });
  const schema = getSchema(ritualTiptapExtensions);
  const source = schema.nodeFromJSON(semanticToTiptap(original));
  const container = document.createElement("div");
  container.append(
    DOMSerializer.fromSchema(schema).serializeFragment(source.content),
  );
  const pasted = DOMParser.fromSchema(schema).parse(container);
  expect(semanticToJrt(semanticFromTiptap(pasted.toJSON()))).toEqual(
    semanticToJrt(original),
  );
});

it("gives pasted blocks stable new IDs in the live editor document", () => {
  const original = semanticFromJrt({
    children: [
      {
        type: "task",
        say: true,
        role: "hiero",
        children: [{ type: "text", value: "Welcome." }],
      },
    ],
  });
  const content = semanticToTiptap(original).content![0];
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: ritualTiptapExtensions,
    content: { type: "doc", content: [content, structuredClone(content)] },
  });
  try {
    expect(normalizeTiptapNodeIds(editor)).toBe(true);
    expect(normalizeTiptapNodeIds(editor)).toBe(false);
    const first = semanticFromTiptap(editor.getJSON());
    const second = semanticFromTiptap(editor.getJSON());
    const originalTask = original.nodes[0];
    if (originalTask.kind !== "element") throw new Error("Expected task");
    expect(first).toEqual(second);
    expect(first.nodes[0]).toMatchObject(originalTask);
    expect(first.nodes[1]).not.toMatchObject({ id: originalTask.id });
  } finally {
    editor.destroy();
  }
});

it("keeps ID repair out of the paste undo step", () => {
  const original = semanticFromJrt({
    children: [
      {
        type: "task",
        say: true,
        role: "hiero",
        children: [{ type: "text", value: "Welcome." }],
      },
    ],
  });
  const content = semanticToTiptap(original).content![0];
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: ritualTiptapExtensions,
    content: { type: "doc", content: [content] },
  });
  try {
    editor.commands.insertContentAt(editor.state.doc.content.size, content);
    expect(normalizeTiptapNodeIds(editor)).toBe(true);
    expect(editor.getJSON().content).toHaveLength(2);
    editor.commands.undo();
    expect(editor.getJSON().content).toHaveLength(1);
    editor.commands.redo();
    normalizeTiptapNodeIds(editor);
    expect(semanticFromTiptap(editor.getJSON()).nodes).toHaveLength(2);
  } finally {
    editor.destroy();
  }
});

it("preserves mixed UUID and short IDs while repairing a pasted duplicate", () => {
  const uuid = createUuidV7();
  const ids = [uuid, "Ab3k9Qp7Zx2Mn5Rs", "ab3k9qp7zx2mn5rs"];
  const original = semanticFromJrt(
    {
      children: ids.map(() => ({ type: "note", children: [] })),
    },
    () => ids.shift()!,
  );
  const content = semanticToTiptap(original);
  content.content!.push(structuredClone(content.content![0]));
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: ritualTiptapExtensions,
    content,
  });
  try {
    expect(normalizeTiptapNodeIds(editor)).toBe(true);
    expect(normalizeTiptapNodeIds(editor)).toBe(false);
    const result = semanticFromTiptap(editor.getJSON());
    expect(result.nodes.slice(0, 3)).toEqual(original.nodes);
    expect(result.nodes[3]).toMatchObject({
      id: expect.stringMatching(/^[A-Za-z0-9]{16}$/),
    });
    expect(semanticFromTiptap(editor.getJSON())).toEqual(result);
  } finally {
    editor.destroy();
  }
});

it("rejects a task nested inside another task", () => {
  const schema = getSchema(ritualTiptapExtensions);
  const task = schema.nodes.ritualTask.createChecked(
    { id: "test", tag: "task", attrs: { say: true, role: "hiero" } },
    [schema.nodes.paragraph.create()],
  );
  expect(() =>
    schema.nodes.ritualTask.createChecked(
      { id: "test2", tag: "task", attrs: { say: true, role: "hiero" } },
      [task],
    ),
  ).toThrow();
});
