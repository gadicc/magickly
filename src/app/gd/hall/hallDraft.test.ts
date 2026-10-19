import { describe, expect, it } from "vitest";
import {
  HALL_DRAFT_KEY,
  MAX_HALL_DRAFT,
  readHallDraft,
  writeHallDraft,
} from "./hallDraft";

/** A storage holding one value, or throwing. */
function storage(value: string | null, throws = false) {
  const set: [string, string][] = [];
  return {
    set,
    getItem: (key: string) => {
      if (throws) throw new Error("SecurityError");
      return key === HALL_DRAFT_KEY ? value : null;
    },
    setItem: (key: string, next: string) => {
      if (throws) throw new Error("QuotaExceededError");
      set.push([key, next]);
    },
  };
}

describe("the hall draft", () => {
  it("round-trips a source under its versioned key", () => {
    const store = storage(null);
    expect(writeHallDraft(store, "gdHall\n")).toBe("saved");
    expect(store.set).toEqual([
      [HALL_DRAFT_KEY, JSON.stringify({ v: 1, source: "gdHall\n" })],
    ]);
    expect(readHallDraft(storage(store.set[0][1]))).toEqual({
      status: "found",
      draft: { source: "gdHall\n" },
    });
    expect(HALL_DRAFT_KEY).toMatch(/:v1$/);
  });

  it("finds nothing, or says why a stored value is unusable", () => {
    expect(readHallDraft(storage(null))).toEqual({ status: "none" });
    for (const value of [
      "not json",
      "null",
      "[]",
      '"gdHall"',
      JSON.stringify({ v: 2, source: "gdHall" }),
      JSON.stringify({ v: 1, source: 5 }),
      JSON.stringify({ v: 1 }),
    ])
      expect(readHallDraft(storage(value)), value).toEqual({
        status: "corrupt",
      });
    expect(readHallDraft(storage("x".repeat(MAX_HALL_DRAFT + 100)))).toEqual({
      status: "oversized",
    });
    expect(
      readHallDraft(
        storage(
          JSON.stringify({ v: 1, source: "y".repeat(MAX_HALL_DRAFT + 1) }),
        ),
      ),
    ).toEqual({ status: "oversized" });
  });

  it("works without storage, or with storage that throws", () => {
    expect(readHallDraft(null)).toEqual({ status: "unavailable" });
    expect(readHallDraft(storage(null, true))).toEqual({
      status: "unavailable",
    });
    expect(writeHallDraft(null, "gdHall")).toBe("failed");
    expect(writeHallDraft(storage(null, true), "gdHall")).toBe("failed");
    expect(writeHallDraft(storage(null), "z".repeat(MAX_HALL_DRAFT + 1))).toBe(
      "too-large",
    );
  });
});
