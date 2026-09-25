import { readFileSync } from "node:fs";
import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { prepare } from "./prepare";
import { semanticFromJrt, semanticToJrt } from "./semantic";
import {
  ritualTiptapExtensions,
  semanticFromTiptap,
  semanticToTiptap,
} from "./tiptapRitual";

describe("Tiptap semantic adapter", () => {
  for (const name of ["0=0", "1=10", "2=9"]) {
    it(`preserves reader output for ${name}`, () => {
      const source = readFileSync(
        new URL(`./${name}.jade`, import.meta.url),
        "utf8",
      );
      const jrt = prepare(source);
      const semantic = semanticFromJrt(jrt);
      const editor = semanticToTiptap(semantic);
      const parsed = getSchema(ritualTiptapExtensions).nodeFromJSON(editor);
      parsed.check();
      const roundtrip = semanticFromTiptap(parsed.toJSON());
      expect(semanticToJrt(roundtrip)).toEqual(jrt);
    });
  }

  it("assigns fresh IDs when editor paste duplicates a block", () => {
    const original = semanticFromJrt({
      children: [
        {
          type: "task",
          say: true,
          role: "hiero",
          children: [{ type: "text", value: "Hello" }],
        },
      ],
    });
    const editor = semanticToTiptap(original);
    editor.content!.push(structuredClone(editor.content![0]));
    const copied = semanticFromTiptap(editor);
    expect(copied.nodes).toHaveLength(2);
    expect(original.nodes[0].kind).toBe("element");
    if (original.nodes[0].kind === "text") throw new Error("Expected task");
    expect(copied.nodes[0]).toMatchObject({ id: original.nodes[0].id });
    expect(copied.nodes[1]).not.toMatchObject({ id: original.nodes[0].id });
  });

  it("keeps a plain title anchor in sync with its edited visible text", () => {
    const original = semanticFromJrt({
      children: [
        {
          type: "title",
          text: "Old",
          children: [{ type: "text", value: "Old" }],
        },
      ],
    });
    const editor = semanticToTiptap(original);
    editor.content![0].content![0].content![0].text = "New";
    const changed = semanticFromTiptap(editor);
    expect(changed.nodes[0]).toMatchObject({
      tag: "title",
      attrs: { text: "New" },
      children: [{ text: "New" }],
    });
  });

  it("joins newly typed plain text while retaining imported text boundaries", () => {
    const original = semanticFromJrt({
      children: [
        {
          type: "task",
          do: true,
          role: "keryx",
          children: [
            { type: "text", value: "Open" },
            { type: "text", value: " the door" },
          ],
        },
      ],
    });
    const editor = semanticToTiptap(original);
    expect(semanticToJrt(semanticFromTiptap(editor))).toEqual(
      semanticToJrt(original),
    );
    editor.content![0].content![0].content!.push({
      type: "text",
      text: ".",
    });
    const changed = semanticFromTiptap(editor);
    expect(changed.nodes[0]).toMatchObject({
      tag: "task",
      children: [
        { kind: "text", text: "Open" },
        { kind: "text", text: " the door." },
      ],
    });
  });
});
