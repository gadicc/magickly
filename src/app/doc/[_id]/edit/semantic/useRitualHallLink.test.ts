// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { describe, expect, it } from "vitest";
import { byAttr, neophyteHall } from "@/doc/gdHallEditor/hallTestFixtures";
import { printRitualPug } from "@/doc/ritualPug";
import { ritualPugNodeIdsAtLine } from "@/doc/ritualPugIds";
import type { RitualSemanticDocument } from "@/doc/semantic";
import type { RitualEditorLayout } from "@/doc/useRitualEditorLayout";
import { ritualTagCursor, useRitualHallLink } from "./useRitualHallLink";

const hall = neophyteHall();
const hegemon = byAttr(hall, "role", "hegemon").id;
const sentinel = byAttr(hall, "role", "sentinel").id;
/** A ritual whose hall stands in a note, as printed. */
const text = printRitualPug({
  format: "magickli-ritual",
  version: 1,
  nodes: [
    {
      kind: "element",
      id: "Note000000000001",
      tag: "note",
      attrs: {},
      children: [hall],
    },
  ],
} as RitualSemanticDocument);
const lines = text.split("\n");
const lineOf = (id: string) =>
  lines.findIndex((line) => line.includes(`#${id}`)) + 1;
/** The chain `onCaretNode` reports on the line declaring `id`. */
const chainAt = (id: string) =>
  ritualPugNodeIdsAtLine((line) => lines[line - 1] ?? "", lineOf(id));

type Source = Parameters<typeof useRitualHallLink>[0]["source"];

/** A focus event whose target stands in an element with these attributes. */
const focusIn = (attributes: Record<string, string>) => {
  const host = document.createElement("div");
  for (const [name, value] of Object.entries(attributes))
    host.setAttribute(name, value);
  const target = document.createElement("span");
  host.append(target);
  return { target } as unknown as React.FocusEvent;
};
/** The source's editor, an open hall's editor, a toolbar or the text. */
const inSourceEditor = () => focusIn({ class: "cm-editor" });
const inHall = (hallId = hall.id) =>
  focusIn({ "data-gd-hall-editing": hallId });
const elsewhere = () => focusIn({});
const read: Source = { text, dialect: "pug", dirty: false, conflict: false };

function setup(displayMode: RitualEditorLayout = "split", source = read) {
  const hook = renderHook((props) => useRitualHallLink(props), {
    initialProps: { displayMode, source },
  });
  const opened = (reveals = (_ids: readonly string[]) => true) => {
    let close = () => {};
    act(() => {
      close = hook.result.current.link.open(hall.id, { reveals });
    });
    return () => act(() => close());
  };
  const select = (id: string | null, hallId = hall.id) =>
    act(() => hook.result.current.link.selected(hallId, id));
  /** The source caret's chain at the line declaring `id`. */
  const move = (id: string) => {
    let answer = false;
    act(() => {
      answer = hook.result.current.caretMoved(chainAt(id));
    });
    return answer;
  };
  return { hook, opened, select, move };
}

describe("ritualTagCursor", () => {
  it("puts the caret at the tag of the line declaring the ID", () => {
    const line = lineOf(hegemon);
    expect(ritualTagCursor(text, hegemon)).toEqual({
      line,
      column: lines[line - 1].indexOf("officer") + 1,
      source: text,
    });
    expect(ritualTagCursor(text, hall.id)?.column).toBe(3);
  });

  it("finds nothing for an ID no header declares", () => {
    expect(ritualTagCursor(text, "Missing000000001")).toBeNull();
    expect(ritualTagCursor("//- just a comment\n", hegemon)).toBeNull();
  });
});

describe("the source caret follows the drawing (plan 064)", () => {
  it("puts the caret on the selected item, marked, again for new text", () => {
    const { hook, opened, select } = setup();
    opened();
    expect(hook.result.current.cursor).toBeNull();
    expect(hook.result.current.marked).toBe(false);
    select(hegemon);
    expect(hook.result.current.cursor).toMatchObject({
      line: lineOf(hegemon),
    });
    expect(hook.result.current.marked).toBe(true);
    // A visual edit reprints the source: a new caret for the new text.
    const before = hook.result.current.cursor;
    const edited = text.replace('role="hegemon"', 'role="hegemon", x=9');
    hook.rerender({
      displayMode: "split",
      source: { ...read, text: edited },
    });
    expect(hook.result.current.cursor).not.toBe(before);
    expect(hook.result.current.cursor?.source).toBe(edited);
    select(sentinel);
    expect(hook.result.current.cursor?.line).toBe(lineOf(sentinel));
    // A cleared selection leaves the caret, unmarked.
    select(null);
    expect(hook.result.current.cursor).toBeNull();
    expect(hook.result.current.marked).toBe(false);
  });

  it("places nothing in text that is not the document's, nor in one panel", () => {
    for (const source of [
      { ...read, dirty: true },
      { ...read, dirty: true, conflict: true },
      { ...read, dialect: "ritual-text" as const },
    ]) {
      const { hook, opened, select } = setup("split", source);
      opened();
      select(hegemon);
      expect(hook.result.current.cursor).toBeNull();
      expect(hook.result.current.marked).toBe(false);
    }
    const { hook, opened, select } = setup("visual");
    opened();
    select(hegemon);
    expect(hook.result.current.cursor).toBeNull();
    expect(hook.result.current.link.linked).toBe(false);
  });

  it("places nothing for an item the text does not name", () => {
    const { hook, opened, select } = setup();
    opened();
    select("Typed00000000001");
    expect(hook.result.current.cursor).toBeNull();
    expect(hook.result.current.marked).toBe(false);
  });

  it("stops once the source leads, until the drawing selects again", () => {
    const { hook, opened, select } = setup();
    opened();
    select(hegemon);
    act(() => hook.result.current.onSourceFocus(inSourceEditor()));
    expect(hook.result.current.cursor).toBeNull();
    // A selection the source made is not echoed into the caret.
    select(sentinel);
    expect(hook.result.current.cursor).toBeNull();
    // The hall's editor taking the focus leads with what it holds, as on
    // the hall editor page; another hall's does not.
    act(() => hook.result.current.onVisualFocus(inHall("Other00000000001")));
    expect(hook.result.current.cursor).toBeNull();
    act(() => hook.result.current.onVisualFocus(inHall()));
    expect(hook.result.current.cursor?.line).toBe(lineOf(sentinel));
    select(hegemon);
    expect(hook.result.current.cursor?.line).toBe(lineOf(hegemon));
  });

  it("forgets the selection of a hall that closes, once all its views go", () => {
    const { hook, opened, select } = setup();
    const first = opened();
    const second = opened();
    select(hegemon);
    // Another hall clearing its selection leaves this one's.
    select(null, "Other00000000001");
    expect(hook.result.current.cursor).not.toBeNull();
    first();
    expect(hook.result.current.cursor).not.toBeNull();
    second();
    expect(hook.result.current.cursor).toBeNull();
    // A hall that closes forgets only its own selection.
    const third = opened();
    act(() => {
      hook.result.current.link.open("Other00000000001", {
        reveals: () => true,
      })();
    });
    select(sentinel);
    expect(hook.result.current.cursor).not.toBeNull();
    third();
  });

  it("keeps a report the same when nothing changed", () => {
    const { hook, opened, select } = setup();
    opened();
    select(hegemon);
    const before = hook.result.current.cursor;
    select(hegemon);
    expect(hook.result.current.cursor).toBe(before);
  });

  it("leads with the drawing on entering split view from Visual", () => {
    const { hook, opened, select } = setup();
    opened();
    select(hegemon);
    hook.rerender({ displayMode: "visual", source: read });
    expect(hook.result.current.cursor).toBeNull();
    // Reports keep arriving while the source panel is away.
    select(sentinel);
    hook.rerender({ displayMode: "split", source: read });
    expect(hook.result.current.cursor?.line).toBe(lineOf(sentinel));
  });

  it("leads with the drawing into split view after the source led", () => {
    const { hook, opened, select } = setup();
    opened();
    act(() => hook.result.current.onSourceFocus(inSourceEditor()));
    select(hegemon);
    expect(hook.result.current.cursor).toBeNull();
    hook.rerender({ displayMode: "visual", source: read });
    hook.rerender({ displayMode: "split", source: read });
    expect(hook.result.current.cursor?.line).toBe(lineOf(hegemon));
    // From Source, nothing changes hands.
    act(() => hook.result.current.onSourceFocus(inSourceEditor()));
    hook.rerender({ displayMode: "source", source: read });
    hook.rerender({ displayMode: "split", source: read });
    expect(hook.result.current.cursor).toBeNull();
  });

  it("lets go when the focus goes elsewhere in either panel", () => {
    const { hook, opened, select } = setup();
    opened();
    act(() => hook.result.current.onVisualFocus(inHall()));
    select(hegemon);
    expect(hook.result.current.cursor).not.toBeNull();
    // The visual panel's text: typing there reprints the source, which
    // must not draw its caret back to the hall.
    act(() => hook.result.current.onVisualFocus(elsewhere()));
    expect(hook.result.current.cursor).toBeNull();
    expect(hook.result.current.marked).toBe(false);
    hook.rerender({
      displayMode: "split",
      source: { ...read, text: text.replace("hegemon", "hegemon ") },
    });
    expect(hook.result.current.cursor).toBeNull();
    // A selection reported now is not the drawing's either.
    select(sentinel);
    expect(hook.result.current.cursor).toBeNull();
    // Nor does a button in the source panel lead.
    act(() => hook.result.current.onVisualFocus(inHall()));
    expect(hook.result.current.cursor?.line).toBe(lineOf(sentinel));
    act(() => hook.result.current.onSourceFocus(elsewhere()));
    expect(hook.result.current.cursor).toBeNull();
    // From the visual panel's text, Split does not hand the lead over.
    act(() => hook.result.current.onVisualFocus(elsewhere()));
    hook.rerender({ displayMode: "visual", source: read });
    hook.rerender({ displayMode: "split", source: read });
    expect(hook.result.current.cursor).toBeNull();
  });
});

describe("the source caret selects in the drawing (plan 064)", () => {
  it("gives the halls the caret while the source leads, on read text", () => {
    const { hook, opened, move } = setup();
    opened();
    expect(hook.result.current.link.caret).toBeNull();
    expect(move(hegemon)).toBe(true);
    const caret = hook.result.current.link.caret;
    expect(caret?.ids).toEqual(chainAt(hegemon));
    // The same object while nothing changes; a new key for each move.
    hook.rerender({ displayMode: "split", source: read });
    expect(hook.result.current.link.caret).toBe(caret);
    move(hegemon);
    expect(hook.result.current.link.caret?.key).toBe((caret?.key ?? 0) + 1);
    // Typing not yet read holds it back; the read gives it again.
    hook.rerender({ displayMode: "split", source: { ...read, dirty: true } });
    expect(hook.result.current.link.caret).toBeNull();
    hook.rerender({ displayMode: "split", source: read });
    expect(hook.result.current.link.caret?.ids).toEqual(chainAt(hegemon));
    // The source's editor taking the focus after its caret reported
    // keeps it; the hall's editor taking it ends it.
    act(() => hook.result.current.onSourceFocus(inSourceEditor()));
    expect(hook.result.current.link.caret?.ids).toEqual(chainAt(hegemon));
    act(() => hook.result.current.onVisualFocus(inHall()));
    expect(hook.result.current.link.caret).toBeNull();
    // As does the focus anywhere else in either panel.
    for (const leave of [
      () => hook.result.current.onVisualFocus(elsewhere()),
      () => hook.result.current.onSourceFocus(elsewhere()),
    ]) {
      move(hegemon);
      expect(hook.result.current.link.caret).not.toBeNull();
      act(leave);
      expect(hook.result.current.link.caret).toBeNull();
    }
    move(hegemon);
    hook.rerender({ displayMode: "visual", source: read });
    expect(hook.result.current.link.caret).toBeNull();
  });

  it("leaves the block follow alone outside an item of a drawn open hall", () => {
    const { hook, opened, move } = setup();
    // No hall open: the follow, as before.
    expect(move(hegemon)).toBe(false);
    // Open, but the hall would reveal nothing: a container's line, or a
    // hall that is not drawn (a footnote's hidden canonical body).
    const close = opened((ids) => ids[0] !== hegemon);
    expect(move(hegemon)).toBe(false);
    expect(move(sentinel)).toBe(true);
    close();
    opened();
    expect(move(hegemon)).toBe(true);
    // The hall's own line, and a line outside it.
    expect(move(hall.id)).toBe(false);
    expect(move("Note000000000001")).toBe(false);
    expect(hook.result.current.link.caret?.ids).toEqual(["Note000000000001"]);
    // Text not yet read, or in error: nothing will select, so the follow.
    hook.rerender({ displayMode: "split", source: { ...read, dirty: true } });
    expect(move(hegemon)).toBe(false);
    hook.rerender({ displayMode: "split", source: read });
    expect(move(hegemon)).toBe(true);
  });

  it("marks the line of the selection the source caret chose", () => {
    const { hook, opened, select, move } = setup();
    opened();
    move(hegemon);
    // The hall answers with the selection the caret asked for.
    select(hegemon);
    expect(hook.result.current.cursor).toBeNull();
    expect(hook.result.current.marked).toBe(true);
    // A caret outside the hall keeps the selection, unmarked.
    move("Note000000000001");
    expect(hook.result.current.marked).toBe(false);
    move(sentinel);
    select(sentinel);
    expect(hook.result.current.marked).toBe(true);
    hook.rerender({ displayMode: "split", source: { ...read, dirty: true } });
    expect(hook.result.current.marked).toBe(false);
  });

  it("ends the drawing's lead when the source caret moves", () => {
    const { hook, opened, select, move } = setup();
    opened();
    select(hegemon);
    expect(hook.result.current.cursor).not.toBeNull();
    move(sentinel);
    expect(hook.result.current.cursor).toBeNull();
  });
});
