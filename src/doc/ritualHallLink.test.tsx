// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { byAttr, neophyteHall } from "./gdHallEditor/hallTestFixtures";
import {
  type RitualHallLink,
  RitualHallLinkContext,
  useLinkedHall,
} from "./ritualHallLink";

const hall = neophyteHall();
const hegemon = byAttr(hall, "role", "hegemon");

function provided(link: Partial<RitualHallLink> = {}) {
  const close = vi.fn();
  const value: RitualHallLink = {
    linked: true,
    open: vi.fn(() => close),
    selected: vi.fn(),
    ...link,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RitualHallLinkContext value={value}>{children}</RitualHallLinkContext>
  );
  return { value, close, wrapper };
}

describe("useLinkedHall", () => {
  it("gives nothing without the ritual editor's link", () => {
    const { result } = renderHook(() => useLinkedHall(hall));
    expect(result.current).toEqual({});
  });

  it("registers the open hall and reports its selection", () => {
    const { value, close, wrapper } = provided();
    const hook = renderHook(() => useLinkedHall(hall), { wrapper });
    expect(value.open).toHaveBeenCalledWith(hall.id);
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
});
