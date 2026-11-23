// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  READER_TEXT_SIZE_KEY,
  READER_TEXT_SIZE_PROPERTY,
  readerTextSizeScript,
} from "./readerTextSize";
import { useReaderTextSize } from "./useReaderTextSize";

const applied = () =>
  document.documentElement.style.getPropertyValue(READER_TEXT_SIZE_PROPERTY);

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.style.removeProperty(READER_TEXT_SIZE_PROPERTY);
  vi.restoreAllMocks();
});

it("restores the size chosen before, and keeps a new one", () => {
  localStorage.setItem(READER_TEXT_SIZE_KEY, "130");
  const reader = renderHook(() => useReaderTextSize());
  expect(reader.result.current[0]).toBe(130);
  expect(applied()).toBe("130%");
  act(() => reader.result.current[1](135));
  expect(reader.result.current[0]).toBe(135);
  expect(applied()).toBe("135%");
  expect(localStorage.getItem(READER_TEXT_SIZE_KEY)).toBe("135");
  // Back at the default, nothing is kept.
  act(() => reader.result.current[1](100));
  expect(localStorage.getItem(READER_TEXT_SIZE_KEY)).toBeNull();
});

it("holds sizes to its range, and ignores a stored size it cannot read", () => {
  localStorage.setItem(READER_TEXT_SIZE_KEY, "big");
  const reader = renderHook(() => useReaderTextSize());
  expect(reader.result.current[0]).toBe(100);
  act(() => reader.result.current[1](45));
  expect(reader.result.current[0]).toBe(50);
  act(() => reader.result.current[1](305));
  expect(reader.result.current[0]).toBe(300);
  cleanup();
  localStorage.setItem(READER_TEXT_SIZE_KEY, "1000");
  expect(renderHook(() => useReaderTextSize()).result.current[0]).toBe(300);
});

it("starts at the default, and still changes, when storage throws", () => {
  for (const method of ["getItem", "setItem", "removeItem"] as const)
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new Error("blocked");
    });
  const reader = renderHook(() => useReaderTextSize());
  expect(reader.result.current[0]).toBe(100);
  act(() => reader.result.current[1](110));
  expect(reader.result.current[0]).toBe(110);
});

it("is set before paint by the head script, as the hook would set it", () => {
  const run = () => (0, eval)(readerTextSizeScript);
  run();
  expect(applied()).toBe("");
  for (const [stored, expected] of [
    ["130", "130%"],
    ["1000", "300%"],
    ["12.6", "50%"],
    ["big", "50%"],
  ]) {
    localStorage.setItem(READER_TEXT_SIZE_KEY, stored);
    run();
    // An unreadable value sets nothing: the last one stands.
    expect(applied()).toBe(expected);
  }
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(run).not.toThrow();
});
