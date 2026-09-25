// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { expect, it } from "vitest";
import { semanticFromJrt } from "./semantic";
import { ritualTiptapExtensions, semanticToTiptap } from "./tiptapRitual";

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
    expect(editor.getJSON().content?.[0].type).toBe("ritualBlock");
  } finally {
    editor.destroy();
  }
});
