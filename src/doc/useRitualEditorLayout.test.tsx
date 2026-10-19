// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  RITUAL_EDITOR_LAYOUT_KEY,
  useRitualEditorLayout,
} from "./useRitualEditorLayout";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

it("keeps another editor's preference under its own key", () => {
  localStorage.setItem(RITUAL_EDITOR_LAYOUT_KEY, "visual");
  localStorage.setItem("test:hall-layout", "source");
  const ritual = renderHook(() => useRitualEditorLayout());
  const hall = renderHook(() =>
    useRitualEditorLayout("split", "test:hall-layout"),
  );
  expect(ritual.result.current[0]).toBe("visual");
  expect(hall.result.current[0]).toBe("source");
  act(() => hall.result.current[1]("split"));
  expect(localStorage.getItem("test:hall-layout")).toBe("split");
  expect(localStorage.getItem(RITUAL_EDITOR_LAYOUT_KEY)).toBe("visual");
});

it("falls back, and still switches, when storage throws", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const hall = renderHook(() =>
    useRitualEditorLayout("split", "test:hall-layout"),
  );
  expect(hall.result.current[0]).toBe("split");
  act(() => hall.result.current[1]("visual"));
  expect(hall.result.current[0]).toBe("visual");
});
