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
