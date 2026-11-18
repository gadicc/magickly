import { readFileSync } from "node:fs";
import JSON5 from "json5";
import { describe, expect, it } from "vitest";
import angels from "./SeventyTwoAngels.ts";
import {
  EXODUS_14_19_21,
  normaliseFinals,
  triadOf,
  verseLetters,
} from "./shemHaMephorash.ts";

/**
 * Every Hebrew name in the edition held to its triad from Exodus 14:19–21.
 *
 * This is how the reissue's misprints of the 37th, 68th and 69th were
 * confirmed. A name that does not begin with its triad is either a misprint
 * the 1823 printing settles, which the data then gives as 1823 has it, or
 * Lenain's own spelling, listed below with a note saying so. Anything else
 * fails here.
 */

/**
 * Lenain's own spellings: both printings agree, so the edition keeps them,
 * and each has a note saying what the verse gives instead. Most have he where
 * the verse has het; the 30th has the triad's letters in another order.
 */
const LENAIN_SPELLINGS = new Set([24, 30, 33, 34, 38, 51, 59, 64]);

/**
 * Names that do not end יה or אל. Manakel, the 66th, ends אה in both
 * printings, where the tradition has מנקאל; the edition keeps Lenain's
 * letters, and a note says so.
 */
const OTHER_ENDINGS = new Set([66]);

interface Note {
  no: number;
  field: string;
  why: string;
}

const read = (path: string) =>
  JSON5.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

const notes: Note[] = read("./lenain/apparatus.json5");
const witnessed: {
  readings: { no: number; field: string; verdict: string }[];
} = read("./lenain/witnesses.json5");

/**
 * A kept spelling stands on both printings: its name has a note, and the
 * 1823 printing was read for it and agrees.
 */
function expectNotedAndAgreed(no: number) {
  expect(
    notes.some((each) => each.no === no && each.field === "name.he"),
    `genius ${no}: a note`,
  ).toBe(true);
  expect(
    witnessed.readings.find(
      (each) => each.no === no && each.field === "name.he",
    )?.verdict,
    `genius ${no}: the 1823 printing`,
  ).toBe("agree");
}

describe("Exodus 14:19–21", () => {
  it("gives seventy-two letters in each verse", () => {
    expect(verseLetters().map((letters) => letters.length)).toEqual([
      72, 72, 72,
    ]);
  });

  it("holds consonants and spaces only", () => {
    for (const verse of EXODUS_14_19_21) expect(verse).toMatch(/^[א-ת ]+$/);
  });

  it("derives the first and last triads", () => {
    // The first two and the last of the seventy-two.
    expect(triadOf(1)).toBe("והו");
    expect(triadOf(2)).toBe("ילי");
    expect(triadOf(72)).toBe("מומ");
    expect(() => triadOf(0)).toThrow(RangeError);
    expect(() => triadOf(73)).toThrow(RangeError);
  });
});

describe("the edition's Hebrew names against their triads", () => {
  const named = angels.filter((angel) => angel.name.he);

  it("has all seventy-two names to check", () => {
    expect(named.map((angel) => angel.no)).toEqual(
      Array.from({ length: 72 }, (_, i) => i + 1),
    );
  });

  it("begins every name with its triad, except Lenain's own spellings", () => {
    const departures = named
      .filter(
        (angel) =>
          !normaliseFinals(angel.name.he ?? "").startsWith(triadOf(angel.no)),
      )
      .map((angel) => angel.no);
    expect(departures).toEqual([...LENAIN_SPELLINGS].sort((a, b) => a - b));
  });

  it("ends every name in יה or אל, except those listed", () => {
    const others = named
      .filter((angel) => !/(יה|אל)$/.test(angel.name.he ?? ""))
      .map((angel) => angel.no);
    expect(others).toEqual([...OTHER_ENDINGS].sort((a, b) => a - b));
    for (const no of OTHER_ENDINGS) expectNotedAndAgreed(no);
  });

  it("notes each of Lenain's spellings with the triad the verse gives", () => {
    for (const no of LENAIN_SPELLINGS) {
      expectNotedAndAgreed(no);
      const note = notes.find(
        (each) => each.no === no && each.field === "name.he",
      );
      expect(note?.why, `genius ${no}`).toContain(triadOf(no));
    }
  });
});
