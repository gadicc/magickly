// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Editor, type JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { parseRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import {
  type RitualSemanticDocument,
  type RitualSemanticNode,
  validateRitualSemantic,
} from "./semantic";
import {
  normalizeTiptapNodeIds,
  ritualTiptapExtensions,
  semanticFromTiptap,
  semanticToTiptap,
  visualRitualState,
} from "./tiptapRitual";
import { ritualTiptapClientExtensions } from "./tiptapRitualClient";

Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(),
});
// The hall chunk is a large module graph; load it once, so the tests time
// the drawing rather than its first transform on a busy machine.
beforeAll(async () => {
  await import("./ritualBlocks/GdHallDrawing");
}, 60_000);
afterEach(cleanup);

const source = `${RITUAL_PUG_HEADER}\n${readFileSync(
  "src/doc/fixtures/gdHallNeophyte.pug",
  "utf8",
)}`;
const halls = (doc: RitualSemanticDocument) =>
  doc.nodes.filter(
    (node): node is Extract<RitualSemanticNode, { kind: "element" }> =>
      node.kind === "element" && node.tag === "gdHall",
  );
const ids = (node: RitualSemanticNode) => {
  const found: string[] = [];
  const walk = (current: RitualSemanticNode) => {
    if ("id" in current) found.push(current.id);
    if (current.kind === "element") current.children?.forEach(walk);
  };
  walk(node);
  return found;
};

describe("a hall in the visual editor", () => {
  it("is one editable atom that round-trips exactly", () => {
    const doc = parseRitualPug(source);
    const state = visualRitualState(doc);
    expect(state.issue).toBeNull();
    const block = state.content.content?.find(
      (node) => node.attrs?.tag === "gdHall",
    );
    expect(block?.type).toBe("ritualAtom");
    const editor = new Editor({
      extensions: ritualTiptapExtensions,
      content: semanticToTiptap(doc),
    });
    const copy = new Editor({ extensions: ritualTiptapExtensions });
    try {
      expect(semanticFromTiptap(editor.getJSON())).toEqual(doc);
      // The clipboard's HTML carries the whole hall and labels it.
      const html = editor.getHTML();
      expect(html).toMatch(/data-ritual-atom="gdHall"[^>]*>Temple hall</);
      copy.commands.setContent(html);
      expect(semanticFromTiptap(copy.getJSON())).toEqual(doc);
    } finally {
      editor.destroy();
      copy.destroy();
    }
  });

  it("gives a duplicated or pasted hall fresh IDs throughout", () => {
    const doc = parseRitualPug(source);
    const editor = new Editor({
      extensions: ritualTiptapExtensions,
      content: semanticToTiptap(doc),
    });
    try {
      const hall = editor
        .getJSON()
        .content?.find((node) => node.attrs?.tag === "gdHall") as JSONContent;
      editor.commands.insertContentAt(
        editor.state.doc.content.size,
        structuredClone(hall),
      );
      // Inserted as clipboard HTML, which goes through the parse rules a
      // paste from another ritual does.
      const copied = new Editor({
        extensions: ritualTiptapExtensions,
        content: { type: "doc", content: [structuredClone(hall)] },
      });
      editor.commands.insertContentAt(
        editor.state.doc.content.size,
        copied.getHTML(),
      );
      copied.destroy();
      expect(normalizeTiptapNodeIds(editor)).toBe(true);
      const after = semanticFromTiptap(editor.getJSON());
      expect(validateRitualSemantic(after)).toEqual([]);
      const [first, ...copies] = halls(after);
      expect(copies).toHaveLength(2);
      expect(first).toEqual(halls(doc)[0]);
      const seen = new Set(ids(first));
      for (const copy of copies) {
        expect(ids(copy)).toHaveLength(ids(first).length);
        for (const id of ids(copy)) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
      }
      // Repaired once; the IDs then stay put.
      expect(normalizeTiptapNodeIds(editor)).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});

describe("a hall where it may stand", () => {
  const hall = ["gdHall", "  floor", "    altar"];
  it.each([
    ["a note", ["note"]],
    ["a summary", ['summary(summary="The hall")']],
    ["a list item", ["ul", "  li"]],
    ["a todo", ["todo"]],
  ] as const)("is a visually editable atom in %s", (_name, parents) => {
    const indent = "  ".repeat(parents.length);
    const doc = parseRitualPug(
      `${RITUAL_PUG_HEADER}\n${[...parents, ...hall.map((line) => indent + line)].join("\n")}\n`,
    );
    const state = visualRitualState(doc);
    expect(state.issue).toBeNull();
    const atoms: JSONContent[] = [];
    const walk = (node: JSONContent) => {
      if (node.type === "ritualAtom") atoms.push(node);
      node.content?.forEach(walk);
    };
    walk(state.content);
    expect(atoms.map((atom) => atom.attrs?.tag)).toEqual(["gdHall"]);
    const editor = new Editor({
      extensions: ritualTiptapExtensions,
      content: state.content,
    });
    try {
      expect(semanticFromTiptap(editor.getJSON())).toEqual(doc);
    } finally {
      editor.destroy();
    }
  });
});

function Host({ doc }: { doc: RitualSemanticDocument }) {
  const editor = useEditor({
    extensions: ritualTiptapClientExtensions,
    content: semanticToTiptap(doc),
    immediatelyRender: false,
    editorProps: {
      attributes: { role: "textbox", "aria-label": "Fixture visual editor" },
    },
  });
  return <EditorContent editor={editor} />;
}

it("draws the hall in its node view, labelled Temple hall", async () => {
  render(<Host doc={parseRitualPug(source)} />);
  const dom = await screen.findByRole("textbox", {
    name: "Fixture visual editor",
  });
  const svg = await screen.findByRole("img", { name: "Neophyte Temple" });
  const atom = dom.querySelector('[data-ritual-atom="gdHall"]');
  expect(atom?.contains(svg)).toBe(true);
  expect(atom?.getAttribute("contenteditable")).toBe("false");
  await waitFor(() => expect(atom?.textContent).toContain("Temple hall"));
  expect(atom?.querySelector('[data-ritual-frame="gdHall"]')).toBeTruthy();
});
