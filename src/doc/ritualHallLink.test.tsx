// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { gdHallArt } from "@/app/gd/halls/art";
import { indexHall } from "./gdHallEditor/hallModel";
import {
  byAttr,
  hallFromPug,
  neophyteHall,
} from "./gdHallEditor/hallTestFixtures";
import {
  hallCaretPath,
  type RitualHallCaret,
  type RitualHallLink,
  RitualHallLinkContext,
  useLinkedHall,
} from "./ritualHallLink";

const hall = neophyteHall();
const hegemon = byAttr(hall, "role", "hegemon");
const sentinel = byAttr(hall, "role", "sentinel");
const index = indexHall(hall);
const rowPath = (id: string) => index.byId.get(id)?.rowPath;
/** The chain of a caret on `id`'s line, outward to a note around the hall. */
const chain = (id: string) => {
  const ids: string[] = [];
  for (let at: string | undefined = id; at; at = index.byId.get(at)?.parentId)
    ids.push(at);
  return [...ids, "Note000000000001"];
};

function provided(link: Partial<RitualHallLink> = {}) {
  const close = vi.fn();
  const value: RitualHallLink = {
    linked: true,
    caret: null,
    open: vi.fn(() => close),
    selected: vi.fn(),
    ...link,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RitualHallLinkContext value={value}>{children}</RitualHallLinkContext>
  );
  return { value, close, wrapper };
}

describe("hallCaretPath", () => {
  it("gives the innermost node of the chain that the hall holds", () => {
    expect(hallCaretPath(chain(hegemon.id), index)).toEqual(
      rowPath(hegemon.id),
    );
    const floor = index.byId.get(hegemon.id)?.parentId as string;
    // A comment line in the floor: its chain starts at the floor.
    expect(hallCaretPath(chain(floor), index)).toEqual(rowPath(floor));
    // An ID the hall lacks (typed in, not yet read) gives its parent.
    expect(hallCaretPath(["Typed00000000001", ...chain(floor)], index)).toEqual(
      rowPath(floor),
    );
  });

  it("gives [] on the hall's own line, null outside the hall", () => {
    expect(hallCaretPath(chain(hall.id), index)).toEqual([]);
    expect(hallCaretPath(["Note000000000001"], index)).toBeNull();
    expect(hallCaretPath([], index)).toBeNull();
    const other = hallFromPug("gdHall", "  floor", "    marker(x=1, y=1)");
    expect(hallCaretPath(chain(hegemon.id), indexHall(other))).toBeNull();
  });
});

describe("useLinkedHall", () => {
  it("gives nothing without the ritual editor's link", () => {
    const { result } = renderHook(() =>
      useLinkedHall(hall, gdHallArt, () => true),
    );
    expect(result.current).toEqual({});
  });

  it("registers the open hall and reports its selection", () => {
    const { value, close, wrapper } = provided();
    let shown = true;
    let current = hall;
    const hook = renderHook(
      () => useLinkedHall(current, gdHallArt, () => shown),
      {
        wrapper,
      },
    );
    expect(value.open).toHaveBeenCalledWith(hall.id, {
      reveals: expect.any(Function),
    });
    const { reveals } = vi.mocked(value.open).mock.calls[0][1];
    // An item, and a line within it, reveal a drawn node.
    expect(reveals(chain(hegemon.id))).toBe(true);
    expect(reveals(["Typed00000000001", ...chain(hegemon.id)])).toBe(true);
    // The hall's structure, its own line, a line outside: nothing.
    const floor = index.byId.get(hegemon.id)?.parentId as string;
    expect(reveals(chain(floor))).toBe(false);
    expect(reveals(chain(hall.id))).toBe(false);
    expect(reveals(["Note000000000001"])).toBe(false);
    // Against the hall it holds now, laid out again for a new one.
    current = {
      ...hallFromPug("gdHall", "  floor", "    marker(x=1, y=1)"),
      id: hall.id,
    };
    hook.rerender();
    expect(reveals(chain(hegemon.id))).toBe(false);
    current = hall;
    hook.rerender();
    expect(reveals(chain(hegemon.id))).toBe(true);
    // A hall not drawn reveals nothing.
    shown = false;
    hook.rerender();
    expect(reveals(chain(hegemon.id))).toBe(false);
    expect(hook.result.current.selectPath).toBeNull();
    hook.result.current.onSelectionChange?.({
      id: hegemon.id,
      path: [1, 2],
    });
    expect(value.selected).toHaveBeenLastCalledWith(hall.id, hegemon.id);
    hook.result.current.onSelectionChange?.(null);
    expect(value.selected).toHaveBeenLastCalledWith(hall.id, null);
    expect(close).not.toHaveBeenCalled();
    hook.unmount();
    expect(close).toHaveBeenCalledOnce();
  });

  it("selects what the caret is in, revealing only for a caret that moved", () => {
    let caret: RitualHallCaret | null = { ids: chain(hegemon.id), key: 1 };
    let current = hall;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RitualHallLinkContext value={{ ...provided().value, caret }}>
        {children}
      </RitualHallLinkContext>
    );
    const hook = renderHook(
      () => useLinkedHall(current, gdHallArt, () => true),
      { wrapper },
    );
    expect(hook.result.current.selectPath).toEqual({
      path: rowPath(hegemon.id),
      hall,
      revealSelected: true,
    });
    // A read gives a new hall: asked again, without a reveal.
    current = structuredClone(hall);
    hook.rerender();
    expect(hook.result.current.selectPath).toEqual({
      path: rowPath(hegemon.id),
      hall: current,
      revealSelected: false,
    });
    // The caret moved: a reveal again.
    caret = { ids: chain(sentinel.id), key: 2 };
    hook.rerender();
    expect(hook.result.current.selectPath).toMatchObject({
      path: rowPath(sentinel.id),
      revealSelected: true,
    });
    // The hall's own line clears; outside, nothing is asked.
    caret = { ids: chain(hall.id), key: 3 };
    hook.rerender();
    expect(hook.result.current.selectPath?.path).toEqual([]);
    caret = { ids: ["Note000000000001"], key: 4 };
    hook.rerender();
    expect(hook.result.current.selectPath).toBeNull();
    caret = null;
    hook.rerender();
    expect(hook.result.current.selectPath).toBeNull();
  });
});
