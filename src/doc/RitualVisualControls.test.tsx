// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, expect, it, vi } from "vitest";
import { createUuidV7 } from "@/lib/ids";
import RitualVisualControls from "./RitualVisualControls";
import { ritualTiptapExtensions, semanticFromTiptap } from "./tiptapRitual";

const mock = vi.hoisted(() => ({
  receipt: null as null | ((value: unknown) => void),
}));
vi.mock("@/lib/upload", () => ({
  default: ({ onResult }: { onResult(value: unknown): void }) => {
    mock.receipt = onResult;
    return <div>Upload fixture</div>;
  },
}));
Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(),
});
const editors: Editor[] = [];
afterEach(() => {
  cleanup();
  for (const editor of editors.splice(0)) editor.destroy();
  mock.receipt = null;
});
const setup = () => {
  const editor = new Editor({
    extensions: ritualTiptapExtensions,
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hello world" }] },
      ],
    },
  });
  editors.push(editor);
  const actorId = createUuidV7(),
    ritualId = createUuidV7();
  const props = { editor, disabled: false, actorId, ritualId };
  const rendered = render(<RitualVisualControls {...props} />);
  return {
    editor,
    props,
    rendered,
    receipt: {
      actorId,
      ritualId,
      operationId: createUuidV7(),
      attachmentId: createUuidV7(),
      fileId: createUuidV7(),
    },
  };
};
it("rejects malformed task roles before changing the document", () => {
  const { editor } = setup();
  const before = editor.getJSON();
  fireEvent.change(screen.getByLabelText("Role for new task"), {
    target: { value: "hiero," },
  });
  fireEvent.click(screen.getByRole("button", { name: "Speech" }));
  expect(editor.getJSON()).toEqual(before);
  expect(() => semanticFromTiptap(editor.getJSON())).not.toThrow();
});
it("retires uploads when their image dialog closes", async () => {
  const { editor, receipt } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Image" }));
  await screen.findByText("Upload fixture");
  const delayed = mock.receipt!;
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  act(() => {
    editor.commands.setTextSelection({ from: 7, to: 12 });
    delayed(receipt);
  });
  const doc = JSON.stringify(semanticFromTiptap(editor.getJSON()));
  expect(doc).toContain("hello world");
  expect(doc).not.toContain('"img"');
});
it.each(["disabled", "syncingSource"] as const)(
  "queues upload completion while %s and uses its captured position",
  async (blocked) => {
    const { editor, receipt, props, rendered } = setup();
    act(() => {
      editor.commands.setTextSelection(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "Image" }));
    await screen.findByText("Upload fixture");
    rendered.rerender(
      <RitualVisualControls {...props} {...{ [blocked]: true }} />,
    );
    act(() => {
      editor.commands.setTextSelection({ from: 7, to: 12 });
      mock.receipt!(receipt);
    });
    expect(JSON.stringify(semanticFromTiptap(editor.getJSON()))).not.toContain(
      '"img"',
    );
    rendered.rerender(<RitualVisualControls {...props} />);
    expect(JSON.stringify(semanticFromTiptap(editor.getJSON()))).toContain(
      "hello world",
    );
    expect(JSON.stringify(semanticFromTiptap(editor.getJSON()))).toContain(
      '"img"',
    );
  },
);
it("rejects a link range when the document changes while its dialog is open", () => {
  const { editor } = setup();
  act(() => {
    editor.commands.setTextSelection({ from: 1, to: 6 });
  });
  fireEvent.click(screen.getByRole("button", { name: "Link" }));
  fireEvent.change(screen.getByLabelText("Link address"), {
    target: { value: "https://example.com" },
  });
  act(() => {
    editor.commands.insertContentAt(1, "Changed ");
  });
  fireEvent.click(screen.getByRole("button", { name: "Insert" }));
  expect(
    screen.getByText(
      "The selected text changed. Close this dialog and select it again.",
    ),
  ).toBeDefined();
  expect(JSON.stringify(semanticFromTiptap(editor.getJSON()))).not.toContain(
    '"tag":"a"',
  );
});
it("does not install marks the semantic adapter cannot persist", () => {
  const { editor } = setup();
  expect(Object.keys(editor.schema.marks)).toEqual(
    expect.not.arrayContaining(["strike", "underline", "code", "link"]),
  );
});
