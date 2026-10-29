// @vitest-environment jsdom
import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gdHallSource } from "@/doc/gdHallRows";
import { entryOfHall } from "./hallHistory";
import { useHallSelectionLink } from "./hallSelectionLink";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The window as wide as `wide` says, for split view's media query. */
const width = (wide: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({ matches: wide && query === "(min-width: 900px)" }) as MediaQueryList,
  );

function link() {
  const present = entryOfHall(gdHallSource(HALL_PRESETS[0].hall));
  const hook = renderHook(() =>
    useHallSelectionLink({
      linked: true,
      present,
      typed: null,
      text: () => present.source,
    }),
  );
  /** The source caret on the first line holding `text`. */
  const caretOn = (text: string) => {
    const line =
      present.source.split("\n").findIndex((row) => row.includes(text)) + 1;
    act(() => {
      hook.result.current.onSourceFocus();
      hook.result.current.onCursor({ line, column: 7 });
    });
  };
  return { hook, caretOn };
}

describe("a selection from the source and the page (plan 063)", () => {
  it("lets the page scroll beside the sticky source, keeping the app bar clear", () => {
    width(true);
    const { hook, caretOn } = link();
    caretOn('role="sentinel"');
    expect(hook.result.current.selectPath).toMatchObject({ pageInset: 64 });
  });

  it("keeps the page still when the panels are stacked", () => {
    width(false);
    const { hook, caretOn } = link();
    caretOn('role="sentinel"');
    expect(hook.result.current.selectPath).not.toBeNull();
    expect(hook.result.current.selectPath).not.toHaveProperty("pageInset");
  });

  it("asks nothing of the drawing for its own selection", () => {
    width(true);
    const { hook } = link();
    act(() => {
      hook.result.current.onDrawingFocus();
      hook.result.current.onSelectionChange({ id: "x", path: [1, 0] });
    });
    expect(hook.result.current.selectPath).toBeNull();
  });
});
