import { describe, expect, it } from "vitest";
import Data from "@/../data/data";
import { dumpValue } from "./dumpValue";

/**
 * The dump's one rule: a field's own value whole, a row it links to by id.
 * Pinned on the barrel's real rows, whose links form cycles, because that is
 * what `decycle` was there for and what this must survive without it.
 */
describe("dumpValue", () => {
  it("prints a linked row by its id, one hop down", () => {
    // Tiferet's grade is printed whole; the grade's own links are ids.
    const grade = JSON.parse(dumpValue(Data.sephirah.tiferet.gdGrade) ?? "");
    expect(grade).toMatchObject({ id: "5=6", name: "Adeptus Minor" });
    expect(grade.sephirah).toBe("tiferet");
    expect(grade.planet).toBe("sol");
    expect(grade.next).toBe("6=5");
  });

  it("prints a list of rows as their ids", () => {
    expect(dumpValue(Data.planet.sol.sephirot)).toBe('["tiferet"]');
  });

  it("walks every field of every row of the four pages' tables", () => {
    // Would throw on a cycle through a row with no id.
    for (const table of [
      Data.planet,
      Data.gdGrade,
      Data.sephirah,
      Data.tolPath,
    ])
      for (const row of Object.values(table))
        for (const value of Object.values(row))
          expect(() => dumpValue(value)).not.toThrow();
  });

  it("keeps a row's own blocks and plain values", () => {
    expect(dumpValue(Data.sephirah.keter.name)).toBe(
      '{"he":"כתר","roman":"Keter","en":"Crown"}',
    );
    expect(dumpValue("ambergris")).toBe('"ambergris"');
    expect(dumpValue(undefined)).toBeUndefined();
  });
});
