import dictionary from "magick-data/enochian/dictionary";
import keys from "magick-data/enochian/keys";
import { describe, expect, it } from "vitest";
import { foldSpelling } from "../dictionary/search.ts";
import { LEITCH_SPELLINGS, type LeitchSpelling } from "./leitchSpellings.ts";

/** A row's words as our sources give them: Casaubon's, then Crowley's. */
function rowWords(key: number, row: number): string[] {
  const found = keys.find((one) => one.key === key)?.rows[row - 1];
  if (!found) return [];
  const { casaubon1659, equinox1912no8 } = found.readings;
  return [casaubon1659?.word, equinox1912no8?.word].filter(
    (word): word is string => Boolean(word),
  );
}

/** Edit distance, for "the same word, spelled otherwise". */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[b.length];
}

/**
 * Whether an entry reads its rows. A joined form must be the rows' words
 * run together, exactly. Every f is read as s, since Casaubon's print
 * gives a long s as f (his CHIF, which Leitch reads CHIS). A spelling
 * may differ by a letter or two. Where Casaubon's print is lost, only Crowley's form is
 * there, and the Golden Dawn adds vowels (G38): the consonants are
 * compared, and each row must have some, or a row of vowels alone (such
 * as Crowley's *aai*) could be added unseen.
 */
function readsRows({ word, kind, key, rows }: LeitchSpelling): boolean {
  const readings = rows.map((row) => rowWords(key, row));
  if (readings.some((words) => words.length === 0)) return false;
  const crowleyOnly = rows.some(
    (row) =>
      !keys.find((one) => one.key === key)?.rows[row - 1]?.readings
        .casaubon1659,
  );
  const form = (text: string) => {
    const folded = foldSpelling(text).replace(/F/g, "S");
    return crowleyOnly ? folded.replace(/[AEIOV]/g, "") : folded;
  };
  if (crowleyOnly && readings.some((words) => !form(words.join(""))))
    return false;
  const target = form(word);
  // Each source's run, falling back to the other where a row lacks it.
  const runs = [0, 1].map((source) =>
    form(readings.map((words) => words[source] ?? words[0]).join("")),
  );
  const allowed =
    kind === "joined" ? 0 : Math.max(1, Math.floor(target.length / 3));
  return runs.some((run) => distance(target, run) <= allowed);
}

const known = new Set([
  ...Object.keys(dictionary).map(foldSpelling),
  ...keys.flatMap((key) =>
    key.rows.flatMap((_, i) => rowWords(key.key, i + 1).map(foldSpelling)),
  ),
]);

describe("Leitch's spellings", () => {
  it("are each a form our Keys and dictionary don't already have", () => {
    for (const { word } of LEITCH_SPELLINGS)
      expect(known.has(foldSpelling(word)), word).toBe(false);
  });

  it("point at rows that exist, in order, and at a lexicon page", () => {
    for (const { word, kind, key, rows, page } of LEITCH_SPELLINGS) {
      expect(rows.length, word).toBeGreaterThan(0);
      // A spelling reads one row, a joined form several: the looser check
      // for spellings must not cover a joined form with a row missing.
      expect(rows.length > 1, word).toBe(kind === "joined");
      rows.forEach((row, i) => {
        expect(
          rowWords(key, row).length,
          `${word} ${key}.${row}`,
        ).toBeGreaterThan(0);
        if (i > 0) expect(row, word).toBe(rows[i - 1] + 1);
      });
      // The lexicon runs from p. 107 to p. 532.
      expect(page, word).toBeGreaterThanOrEqual(107);
      expect(page, word).toBeLessThanOrEqual(532);
    }
  });

  it("spell the words of those rows", () => {
    for (const entry of LEITCH_SPELLINGS)
      expect(
        readsRows(entry),
        `${entry.word} at ${entry.key}.${entry.rows.join("-")}`,
      ).toBe(true);
  });

  it("read nowhere else nearby", () => {
    // Moving an entry a row, or dropping or adding one, must break it:
    // otherwise the check above would pass a mistyped row.
    for (const entry of LEITCH_SPELLINGS) {
      const { rows } = entry;
      const first = rows[0];
      const last = rows[rows.length - 1];
      const variants = [
        rows.map((row) => row - 1),
        rows.map((row) => row + 1),
        [first - 1, ...rows],
        [...rows, last + 1],
        ...(rows.length > 1 ? [rows.slice(1), rows.slice(0, -1)] : []),
      ];
      for (const moved of variants)
        expect(
          readsRows({ ...entry, rows: moved }),
          `${entry.word} at ${entry.key}.${moved.join("-")}`,
        ).toBe(false);
    }
  });

  it("are in the lexicon's order, so their pages never go back", () => {
    for (let i = 1; i < LEITCH_SPELLINGS.length; i++) {
      const [before, after] = [LEITCH_SPELLINGS[i - 1], LEITCH_SPELLINGS[i]];
      expect(before.word <= after.word, after.word).toBe(true);
      expect(before.page, after.word).toBeLessThanOrEqual(after.page);
    }
  });

  it("list each place once", () => {
    const places = LEITCH_SPELLINGS.map(
      ({ word, key, rows }) => `${word} ${key}.${rows[0]}`,
    );
    expect(new Set(places).size).toBe(places.length);
  });
});
