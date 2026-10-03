import { describe, expect, it } from "vitest";
import data from "./data";
import { rowOf } from "./rowOf";

describe("rowOf", () => {
  it("returns the row an id names", () => {
    expect(rowOf(data.sephirah, "keter")).toBe(data.sephirah.keter);
    expect(rowOf(data.tolPath, "1_2")?.id).toBe("1_2");
  });

  it("returns undefined for an id the table does not have", () => {
    expect(rowOf(data.sephirah, "missing")).toBeUndefined();
    expect(rowOf(data.gdGrade, "")).toBeUndefined();
  });

  it("does not answer with an inherited property", () => {
    for (const id of ["constructor", "toString", "__proto__", "hasOwnProperty"])
      expect(rowOf(data.planet, id), id).toBeUndefined();
  });

  it("keeps the row's type, which indexing by a string loses", () => {
    const sephirah = rowOf(data.sephirah, "hod");
    // Without the helper this is `any` under `strict: false`, and every one of
    // these reads would compile whatever it said (plan 032, decision 9).
    expect(sephirah?.gdGrade?.planet?.hebrewLetter?.letter.he).toBe("ב");
    // @ts-expect-error: a row that may be missing is not a row
    const required: NonNullable<typeof sephirah> = sephirah;
    // @ts-expect-error: no such field, which `any` would have allowed
    expect(sephirah?.nosuchfield).toBeUndefined();
    expect(required).toBeDefined();
  });
});
