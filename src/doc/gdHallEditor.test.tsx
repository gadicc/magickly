// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Editor, type JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { afterEach, expect, it } from "vitest";
import { ritualTiptapExtensions } from "./tiptapRitual";
import { ritualTiptapClientExtensions } from "./tiptapRitualClient";

Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(),
});
afterEach(cleanup);

/**
 * A hall atom as the editor holds it. Ritual source cannot contain a hall
 * until the compiler accepts one, so the atom is built directly.
 */
const content: JSONContent = {
  type: "doc",
  content: [
    {
      type: "ritualAtom",
      attrs: {
        id: "Ab3k9Qp7Zx2Mn5Rs",
        tag: "gdHall",
        attrs: {},
        children: [],
      },
    },
  ],
};

it("labels a hall atom Temple hall in its clipboard HTML", () => {
  const editor = new Editor({ extensions: ritualTiptapExtensions, content });
  try {
    expect(editor.getHTML()).toMatch(
      /data-ritual-atom="gdHall"[^>]*>Temple hall</,
    );
  } finally {
    editor.destroy();
  }
});

function Host() {
  const editor = useEditor({
    extensions: ritualTiptapClientExtensions,
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { role: "textbox", "aria-label": "Fixture visual editor" },
    },
  });
  return <EditorContent editor={editor} />;
}

it("labels the hall's node view Temple hall", async () => {
  render(<Host />);
  const dom = await screen.findByRole("textbox", {
    name: "Fixture visual editor",
  });
  await waitFor(() =>
    expect(
      dom.querySelector('[data-ritual-atom="gdHall"]')?.textContent,
    ).toContain("Temple hall"),
  );
});
