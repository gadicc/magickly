// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { expect, it } from "vitest";
import { parseRitualPug, printRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import { parseRitualText, printRitualText } from "./ritualText";
import { semanticFromJrt, semanticToJrt } from "./semantic";
import {
  ritualTiptapExtensions,
  semanticFromTiptap,
  semanticToTiptap,
  visualRitualState,
} from "./tiptapRitual";
import { RitualSoftBreaks } from "./tiptapRitualClient";

it("does not append an unsaved paragraph after a ritual task", () => {
  const original = semanticFromJrt({
    children: [
      {
        type: "task",
        say: true,
        role: "hiero",
        children: [{ type: "text", value: "Welcome" }],
      },
    ],
  });
  const content = semanticToTiptap(original);
  const editor = new Editor({
    extensions: ritualTiptapExtensions,
    content,
  });
  try {
    editor.commands.setContent(content);
    expect(editor.getJSON().content).toHaveLength(1);
    expect(editor.getJSON().content?.[0].type).toBe("ritualTask");
  } finally {
    editor.destroy();
  }
});

it("retains author comments and section separators through a real visual edit and clipboard HTML", () => {
  const document = parseRitualPug(
    `${RITUAL_PUG_HEADER}\n//- Opening notes\n\nhiero#Ab3k9Qp7Zx2Mn5Rs: Welcome.\n\nsummary(summary="Closing")\n  //- Quietly\n  * keryx#Other00000000001 Close the door.\n`,
  );
  expect(visualRitualState(document).issue).toBeNull();
  const editor = new Editor({
    extensions: ritualTiptapExtensions,
    content: semanticToTiptap(document),
  });
  const copy = new Editor({ extensions: ritualTiptapExtensions });
  try {
    let editAt = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === "Welcome.") editAt = pos + node.nodeSize;
    });
    editor.commands.insertContentAt(editAt, " Hello.");
    const changed = semanticFromTiptap(editor.getJSON());
    expect(changed.nodes.slice(0, 2)).toEqual(document.nodes.slice(0, 2));
    expect(printRitualPug(changed)).toContain(
      "Hiero#Ab3k9Qp7Zx2Mn5Rs: Welcome. Hello.",
    );
    expect(printRitualPug(changed)).toContain("//- Quietly");
    expect(parseRitualPug(printRitualPug(changed))).toEqual(changed);
    expect(parseRitualText(printRitualText(changed))).toEqual(changed);
    copy.commands.setContent(editor.getHTML());
    expect(semanticFromTiptap(copy.getJSON())).toEqual(changed);
    expect(JSON.stringify(semanticToJrt(changed))).not.toMatch(
      /Opening notes|Quietly|annotation/,
    );
  } finally {
    editor.destroy();
    copy.destroy();
  }
});

it("shows newlines inside text as collapsible spaces without changing the document", () => {
  const document = parseRitualPug(
    `${RITUAL_PUG_HEADER}\nHiero#Ab3k9Qp7Zx2Mn5Rs:\n  | first line\n  | second line\n`,
  );
  const element = window.document.createElement("div");
  const editor = new Editor({
    element,
    extensions: [...ritualTiptapExtensions, RitualSoftBreaks],
    content: visualRitualState(document).content,
  });
  try {
    const breaks = element.querySelectorAll(".ritual-soft-break");
    expect([...breaks].map((node) => node.textContent)).toEqual(["\n"]);
    expect(semanticFromTiptap(editor.getJSON())).toEqual(document);
    editor.commands.insertContentAt(1, "x");
    expect(element.querySelectorAll(".ritual-soft-break")).toHaveLength(1);
  } finally {
    editor.destroy();
  }
});

it("finds the block node around the visual selection for panel following", async () => {
  const { ritualNodeIdAtSelection, revealRitualNode } = await import(
    "./ritualPanelFollow"
  );
  const document = parseRitualPug(
    `${RITUAL_PUG_HEADER}\nnote#Note000000000001 Before\nHiero#Ab3k9Qp7Zx2Mn5Rs: Hello #[b#Bold000000000001 there]\n`,
  );
  const element = window.document.createElement("div");
  const editor = new Editor({
    element,
    extensions: ritualTiptapExtensions,
    content: visualRitualState(document).content,
  });
  try {
    editor.commands.setTextSelection(editor.state.doc.content.size - 3);
    // Inline spans have no header line; the task around them does.
    expect(ritualNodeIdAtSelection(editor)).toBe("Ab3k9Qp7Zx2Mn5Rs");
    editor.commands.setTextSelection(3);
    expect(ritualNodeIdAtSelection(editor)).toBe("Note000000000001");
    expect(revealRitualNode(editor, "missing")).toBe(false);
  } finally {
    editor.destroy();
  }
});

it("gives a pasted copy of a source-only block stable new IDs once", async () => {
  const { normalizeTiptapNodeIds } = await import("./tiptapRitual");
  const document = semanticFromJrt({
    children: [
      {
        type: "task",
        say: true,
        role: "hiero",
        children: [
          {
            type: "task",
            do: true,
            role: "all",
            children: [{ type: "text", value: "Nested" }],
          },
        ],
      },
    ],
  });
  const element = window.document.createElement("div");
  const editor = new Editor({
    element,
    extensions: ritualTiptapExtensions,
    content: visualRitualState(document).content,
  });
  try {
    const atom = editor.state.doc.firstChild!;
    expect(atom.attrs.tag).toBe("sourceOnly");
    // Duplicate the block in front of the original, as a paste would.
    editor.view.dispatch(editor.state.tr.insert(0, atom));
    while (normalizeTiptapNodeIds(editor));
    const first = semanticFromTiptap(editor.getJSON());
    const second = semanticFromTiptap(editor.getJSON());
    expect(second).toEqual(first);
    const ids = JSON.stringify(first).match(/"id":"[^"]+"/g)!;
    expect(new Set(ids).size).toBe(ids.length);
    // The document order keeps the first occurrence's IDs.
    expect(first.nodes[0]).toMatchObject({
      id: (document.nodes[0] as { id: string }).id,
    });
  } finally {
    editor.destroy();
  }
});

it("rejects pasted source-only blocks whose payload is not a valid node", () => {
  const element = window.document.createElement("div");
  const editor = new Editor({
    element,
    extensions: ritualTiptapExtensions,
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
  try {
    const meta = (raw: string) =>
      JSON.stringify({
        id: "Abcdefghijk12345",
        tag: "sourceOnly",
        attrs: {},
        raw,
      }).replace(/"/g, "&quot;");
    editor.commands.insertContent(
      `<div data-ritual-atom="sourceOnly" data-ritual-meta="${meta("{not json")}">x</div>`,
    );
    expect(JSON.stringify(editor.getJSON())).not.toContain("sourceOnly");
    expect(() => semanticFromTiptap(editor.getJSON())).not.toThrow();
  } finally {
    editor.destroy();
  }
});

it("refuses to put a source-only block holding a task inside a task", () => {
  const nested = semanticFromJrt({
    children: [
      {
        type: "task",
        say: true,
        role: "hiero",
        children: [
          {
            type: "task",
            do: true,
            role: "all",
            children: [{ type: "text", value: "Nested" }],
          },
        ],
      },
      {
        type: "task",
        say: true,
        role: "keryx",
        children: [{ type: "text", value: "Host" }],
      },
    ],
  });
  const element = window.document.createElement("div");
  const editor = new Editor({
    element,
    extensions: ritualTiptapExtensions,
    content: visualRitualState(nested).content,
  });
  try {
    const atom = editor.state.doc.firstChild!;
    expect(atom.attrs.tag).toBe("sourceOnly");
    const before = editor.getJSON();
    // Inside the host task's paragraph list, as a paste or drop would put it.
    const inside = atom.nodeSize + 1;
    editor.view.dispatch(editor.state.tr.insert(inside, atom.copy()));
    expect(editor.getJSON()).toEqual(before);
  } finally {
    editor.destroy();
  }
});

it("explains an emptied section title instead of a validator code", () => {
  const document = parseRitualPug(
    `${RITUAL_PUG_HEADER}\ntitle#Title00000000001(text="Opening") Opening\n`,
  );
  const element = window.document.createElement("div");
  const editor = new Editor({
    element,
    extensions: ritualTiptapExtensions,
    content: visualRitualState(document).content,
  });
  try {
    const title = editor.state.doc.firstChild!;
    editor.view.dispatch(
      editor.state.tr.delete(2, 2 + title.firstChild!.content.size),
    );
    expect(() => semanticFromTiptap(editor.getJSON())).toThrow(
      "A section title needs text",
    );
  } finally {
    editor.destroy();
  }
});
