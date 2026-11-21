import { describe, expect, it } from "vitest";
import hebrewLetters from "../HebrewLetters.ts";
import {
  AIQ_BEKAR,
  aiqBekar,
  hebrewValue,
  letterValue,
  traceHebrew,
} from "./aiqBekar.ts";
import type { KameaPlanetId } from "./kameas.ts";
import planetaryNames, {
  type PlanetaryNameId,
  type PlanetaryNameWitness,
  tracedSpelling,
} from "./PlanetaryNames.ts";

describe("the nine chambers", () => {
  it("hold the 27 letters once each, at the hebrewLetter table's values", () => {
    const placed = AIQ_BEKAR.flatMap(({ letters }, index) =>
      letters.map((letter, rank) => [letter, (index + 1) * 10 ** rank]),
    );
    const table = Object.values(hebrewLetters).map((row) => [
      row.letter.he,
      row.value,
    ]);
    expect(placed).toHaveLength(27);
    expect(new Set(placed.map(([letter]) => letter)).size).toBe(27);
    const byValue = (a: (string | number)[], b: (string | number)[]) =>
      Number(a[1]) - Number(b[1]);
    expect([...placed].sort(byValue)).toEqual([...table].sort(byValue));
  });

  it("are named by their letters, from איק to טצץ", () => {
    expect(AIQ_BEKAR.map((chamber) => chamber.name)).toEqual([
      "איק",
      "בכר",
      "גלש",
      "דמת",
      "הנך",
      "וסם",
      "זען",
      "חפף",
      "טצץ",
    ]);
    expect(Object.isFrozen(AIQ_BEKAR)).toBe(true);
    expect(Object.isFrozen(AIQ_BEKAR[0].letters)).toBe(true);
  });
});

describe("a letter's value", () => {
  it("counts a final at its ordinary letter's unless finals are asked for", () => {
    expect(letterValue("א")).toBe(1);
    expect(letterValue("ת")).toBe(400);
    expect(letterValue("ם")).toBe(40);
    expect(letterValue("ם", { finals: true })).toBe(600);
    expect(letterValue("ן", { finals: true })).toBe(700);
    expect(letterValue("מ", { finals: true })).toBe(40);
  });

  it("refuses anything that is not a letter, a vowel point among them", () => {
    for (const text of ["x", "", "אב", "ַ", " "])
      expect(() => letterValue(text)).toThrow(RangeError);
  });

  it("sums a name over its words", () => {
    expect(hebrewValue("אגיאל")).toBe(45);
    expect(hebrewValue("אל אב")).toBe(34);
    expect(hebrewValue("בני שרפים")).toBe(692);
    expect(hebrewValue("בני שרפים", { finals: true })).toBe(1252);
  });
});

describe("aiqBekar", () => {
  it("keeps a value the square has, and divides the rest by ten until it fits", () => {
    expect(aiqBekar(7, 9)).toBe(7);
    expect(aiqBekar(30, 9)).toBe(3);
    expect(aiqBekar(10, 9)).toBe(1);
    expect(aiqBekar(900, 9)).toBe(9);
    expect(aiqBekar(400, 64)).toBe(40);
    expect(aiqBekar(400, 36)).toBe(4);
    expect(aiqBekar(100, 81)).toBe(10);
    expect(aiqBekar(80, 81)).toBe(80);
    expect(aiqBekar(600, 49)).toBe(6);
  });

  it("refuses a value that is not a letter's, or that no division fits", () => {
    for (const value of [0, 15, 1.5, -10, 110, Number.NaN])
      expect(() => aiqBekar(value, 81), String(value)).toThrow(RangeError);
    for (const cells of [0, -9, 2.5, Number.NaN])
      expect(() => aiqBekar(1, cells), String(cells)).toThrow(RangeError);
    expect(() => aiqBekar(5, 4)).toThrow(
      "5 reduces to no cell of a 4-cell square",
    );
  });
});

/**
 * Plan 093's appendix, "Aiq Bekar reductions": each name's cells on its
 * planet's square, computed by hand, word by word. The Hebrew is read from
 * the data, so that the spellings recorded there trace as the appendix
 * says. `finals` is the trace with the final letters at the table's
 * values, where the appendix gives one. Zazel and Taphthartharath are
 * vol. 4's own two worked examples (n73).
 */
const REDUCTIONS: {
  name: PlanetaryNameId;
  witness: PlanetaryNameWitness;
  planet: KameaPlanetId;
  cells: number[][];
  finals?: number[][];
}[] = [
  {
    name: "agiel",
    witness: "agrippa1533",
    planet: "saturn",
    cells: [[1, 3, 1, 1, 3]],
  },
  {
    name: "zazel",
    witness: "agrippa1533",
    planet: "saturn",
    cells: [[7, 1, 7, 3]],
  },
  {
    name: "iophiel",
    witness: "agrippa1533",
    planet: "jupiter",
    cells: [[10, 5, 8, 10, 1, 3]],
  },
  {
    name: "iophiel",
    witness: "crowley777",
    planet: "jupiter",
    cells: [[10, 6, 8, 10, 3]],
  },
  {
    name: "hismael",
    witness: "agrippa1533",
    planet: "jupiter",
    cells: [[5, 6, 4, 1, 3]],
  },
  {
    name: "graphiel",
    witness: "agrippa1533",
    planet: "mars",
    cells: [[3, 20, 1, 8, 10, 1, 3]],
  },
  {
    name: "bartzabel",
    witness: "agrippa1533",
    planet: "mars",
    cells: [[2, 20, 9, 1, 2, 1, 3]],
  },
  {
    name: "bartzabel",
    witness: "crowley777",
    planet: "mars",
    cells: [[2, 20, 9, 2, 1, 3]],
  },
  {
    name: "nakhiel",
    witness: "agrippa1533",
    planet: "sol",
    cells: [[5, 20, 10, 1, 30]],
  },
  {
    name: "sorath",
    witness: "agrippa1533",
    planet: "sol",
    cells: [[6, 6, 20, 4]],
  },
  {
    name: "hagiel",
    witness: "agrippa1533",
    planet: "venus",
    cells: [[5, 3, 10, 1, 30]],
  },
  {
    name: "kedemel",
    witness: "agrippa1533",
    planet: "venus",
    cells: [[10, 4, 40, 1, 30]],
  },
  {
    name: "bne-seraphim",
    witness: "agrippa1533",
    planet: "venus",
    cells: [
      [2, 5, 10],
      [30, 20, 8, 10, 40],
    ],
    finals: [
      [2, 5, 10],
      [30, 20, 8, 10, 6],
    ],
  },
  {
    name: "tiriel",
    witness: "agrippa1533",
    planet: "mercury",
    cells: [[9, 10, 20, 10, 1, 30]],
  },
  {
    name: "taphthartharath",
    witness: "agrippa1533",
    planet: "mercury",
    cells: [[40, 8, 40, 20, 40, 20, 40]],
  },
  {
    name: "chasmodai",
    witness: "agrippa1533",
    planet: "luna",
    cells: [[8, 30, 40, 6, 4, 1, 10]],
  },
  {
    name: "schedbarschemoth-schartathan",
    witness: "agrippa1533",
    planet: "luna",
    cells: [[30, 4, 2, 20, 30, 5, 40, 70, 40, 30, 20, 40, 40, 50]],
    finals: [[30, 4, 2, 20, 30, 5, 40, 70, 40, 30, 20, 40, 40, 70]],
  },
  {
    name: "malcha-betharsisim",
    witness: "agrippa1533",
    planet: "luna",
    cells: [
      [40, 30, 20, 1],
      [2, 40, 20, 30, 10, 40, 10, 40],
      [70, 4],
      [2, 20, 6, 8],
      [30, 8, 10, 10, 40],
    ],
    finals: [
      [40, 30, 20, 1],
      [2, 40, 20, 30, 10, 40, 10, 60],
      [70, 4],
      [2, 20, 6, 8],
      [30, 8, 10, 10, 60],
    ],
  },
  {
    name: "malcha-betharsisim",
    witness: "crowley777",
    planet: "luna",
    cells: [
      [40, 30, 20, 1],
      [2, 40, 20, 30, 10, 30, 10, 40],
      [6, 70, 4],
      [2, 20, 6, 8],
      [30, 8, 10, 10, 40],
    ],
    finals: [
      [40, 30, 20, 1],
      [2, 40, 20, 30, 10, 30, 10, 60],
      [6, 70, 4],
      [2, 20, 6, 8],
      [30, 8, 10, 10, 60],
    ],
  },
];

describe("a name traced on its square", () => {
  it.each(REDUCTIONS)("$name ($witness) on $planet", (row) => {
    const name = planetaryNames[row.name];
    const he = name.witnesses[row.witness]?.he;
    if (!he) throw new Error(`${row.name}: no Hebrew from ${row.witness}`);
    expect(name.planetId).toBe(row.planet);
    expect(traceHebrew(he, row.planet)).toEqual(row.cells);
    expect(traceHebrew(he, row.planet, { finals: true })).toEqual(
      row.finals ?? row.cells,
    );
  });

  it("follows our division of the spirit of spirits, the same cells in two words", () => {
    const name = planetaryNames["schedbarschemoth-schartathan"];
    const spelling = tracedSpelling(name) ?? "";
    const words = traceHebrew(spelling, "luna");
    expect(words.map((word) => word.length)).toEqual([9, 5]);
    expect(words.flat()).toEqual(
      REDUCTIONS.find(
        (row) => row.name === "schedbarschemoth-schartathan",
      )?.cells.flat(),
    );
  });

  it("refuses a planet with no kamea", () => {
    expect(() => traceHebrew("אב", "earth" as KameaPlanetId)).toThrow(
      "Not a planet with a kamea: earth",
    );
  });
});
