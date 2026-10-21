// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseRitualPug, RITUAL_PUG_HEADER } from "../ritualPug";
import { semanticToTiptap } from "../tiptapRitual";
import { ritualTiptapClientExtensions } from "../tiptapRitualClient";

// The hall editor's chunk cannot be fetched, as offline before it was
// cached, or after a deploy replaced it.
vi.mock("./GdHallAtomEditor", () => {
  throw new Error("Loading chunk 1966 failed.");
});

Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(),
});
afterEach(cleanup);

const source = `${RITUAL_PUG_HEADER}\n${readFileSync(
  "src/doc/fixtures/gdHallNeophyte.pug",
  "utf8",
)}`;

function Host() {
  const editor = useEditor({
    extensions: ritualTiptapClientExtensions,
    content: semanticToTiptap(parseRitualPug(source)),
    immediatelyRender: false,
    editorProps: {
      attributes: { role: "textbox", "aria-label": "Fixture visual editor" },
    },
  });
  return (
    <>
      <EditorContent editor={editor} />
      <p>Ritual text beyond the hall</p>
    </>
  );
}

describe("a hall editor that cannot load", () => {
  it("ends the editing, says so and offers Edit hall again", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { container } = render(<Host />);
      const button = await screen.findByRole("button", { name: "Edit hall" });
      fireEvent.click(button);
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe(
        "The hall editor failed; reload to try again.",
      );
      // The rest of the ritual editor is still there, the hall drawn again,
      // and nothing keeps the split widened for a hall.
      expect(screen.getByText("Ritual text beyond the hall")).toBeTruthy();
      expect(screen.getByRole("textbox")).toBeTruthy();
      expect(container.querySelector("[data-gd-hall-editing]")).toBeNull();
      expect(
        container.querySelector('[data-ritual-atom="gdHall"] svg'),
      ).not.toBeNull();
      const again = screen.getByRole("button", { name: "Edit hall" });
      await waitFor(() => expect(document.activeElement).toBe(again));
      // Trying again fails as before, and leaves one message.
      fireEvent.click(again);
      await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
      expect(screen.getByRole("button", { name: "Edit hall" })).toBeTruthy();
    } finally {
      quiet.mockRestore();
    }
  });
});
