// @vitest-environment jsdom

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { EditorView } from "@uiw/react-codemirror";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RitualSourceEditor, {
  centredScrollTop,
  type RitualSourceCursor,
} from "./RitualSourceEditor";

Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(),
});
afterEach(cleanup);

/** A hall's source of `count` lines below its own, header-less. */
const hall = (count: number) =>
  `gdHall\n  floor\n${Array.from({ length: count }, (_, n) => `    marker(text="${n}")\n`).join("")}`;

function mount(value: string, cursor?: RitualSourceCursor | null) {
  const props = { value, dialect: "pug" as const, disabled: false };
  const rendered = render(
    <>
      <button type="button">elsewhere</button>
      <RitualSourceEditor
        {...props}
        headerless
        onChange={vi.fn()}
        cursor={cursor}
      />
    </>,
  );
  const view = () =>
    EditorView.findFromDOM(
      rendered.container.querySelector(".cm-editor") as HTMLElement,
    ) as EditorView;
  const rerender = (next?: RitualSourceCursor | null, text = value) =>
    rendered.rerender(
      <>
        <button type="button">elsewhere</button>
        <RitualSourceEditor
          {...props}
          value={text}
          headerless
          onChange={vi.fn()}
          cursor={next}
        />
      </>,
    );
  return { view, rerender, container: rendered.container };
}

/** The 1-based line and column of the caret. */
const caret = (view: EditorView) => {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  return { line: line.number, column: head - line.from + 1 };
};

describe("centredScrollTop", () => {
  it("leaves a line wholly in view where it is", () => {
    expect(
      centredScrollTop({ top: 10, bottom: 24 }, { top: 0, bottom: 100 }, 50),
    ).toBeNull();
    expect(
      centredScrollTop({ top: 0, bottom: 100 }, { top: 0, bottom: 100 }, 5),
    ).toBeNull();
  });

  it("centres a line below or above the box, never above its top", () => {
    // 400 px below a 100 px box: the line's middle at the box's.
    expect(
      centredScrollTop({ top: 400, bottom: 420 }, { top: 0, bottom: 100 }, 0),
    ).toBe(360);
    expect(
      centredScrollTop(
        { top: -200, bottom: -180 },
        { top: 0, bottom: 100 },
        300,
      ),
    ).toBe(60);
    expect(
      centredScrollTop(
        { top: -200, bottom: -180 },
        { top: 0, bottom: 100 },
        100,
      ),
    ).toBe(0);
  });
});

describe("the cursor a host gives", () => {
  it("puts the caret there without taking the focus", () => {
    const text = hall(3);
    const { view, rerender } = mount(text);
    const elsewhere = document.querySelector("button") as HTMLButtonElement;
    elsewhere.focus();
    rerender({ line: 4, column: 5, source: text });
    expect(caret(view())).toEqual({ line: 4, column: 5 });
    expect(document.activeElement).toBe(elsewhere);
    expect(view().hasFocus).toBe(false);
  });

  it("is applied once per object, and only to the text it was for", () => {
    const text = hall(3);
    const cursor = { line: 3, column: 5, source: text };
    const { view, rerender } = mount(text, cursor);
    expect(caret(view())).toEqual({ line: 3, column: 5 });
    act(() => view().dispatch({ selection: { anchor: 0 } }));
    // The same object again: the author's caret stays.
    rerender(cursor);
    expect(caret(view())).toEqual({ line: 1, column: 1 });
    // Another text, a line past the end: nothing.
    rerender({ line: 3, column: 5, source: `${text}  ` });
    rerender({ line: 30, column: 1, source: text });
    rerender({ line: 0, column: 1, source: text });
    expect(caret(view())).toEqual({ line: 1, column: 1 });
    // A column past the line's end stops at its end; null does nothing.
    rerender({ line: 2, column: 99, source: text });
    expect(caret(view())).toEqual({ line: 2, column: 8 });
    rerender(null);
    expect(caret(view())).toEqual({ line: 2, column: 8 });
  });

  it("finds a new value's line, given with the cursor for it", () => {
    const text = hall(2);
    const { view, rerender } = mount(text);
    const longer = hall(6);
    rerender({ line: 7, column: 5, source: longer }, longer);
    expect(caret(view())).toEqual({ line: 7, column: 5 });
  });

  it("is applied to each editor view, as Strict Mode makes two", () => {
    const text = hall(3);
    const cursor = { line: 5, column: 5, source: text };
    const { container } = render(
      <StrictMode>
        <RitualSourceEditor
          value={text}
          dialect="pug"
          disabled={false}
          onChange={vi.fn()}
          cursor={cursor}
        />
      </StrictMode>,
    );
    const view = EditorView.findFromDOM(
      container.querySelector(".cm-editor") as HTMLElement,
    ) as EditorView;
    expect(caret(view)).toEqual({ line: 5, column: 5 });
  });

  it("scrolls the editor's own box to a line out of view, once measured", async () => {
    const text = hall(80);
    const { view, rerender } = mount(text);
    const scroller = view().scrollDOM;
    let top = 0;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value;
      },
    });
    vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 300, 100),
    );
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    rerender({ line: 60, column: 5, source: text });
    await waitFor(() => expect(top).toBeGreaterThan(100));
    expect(scrollBy).not.toHaveBeenCalled();
    // The caret already there, the box scrolled away: scrolled back.
    top = 0;
    rerender({ line: 60, column: 5, source: text });
    await waitFor(() => expect(top).toBeGreaterThan(100));
  });
});
