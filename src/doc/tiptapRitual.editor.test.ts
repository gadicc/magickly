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
