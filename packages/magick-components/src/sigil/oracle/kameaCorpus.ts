/**
 * The oracle's corpus on the kameas (plan 093, "Oracle"), from letters,
 * as the pages trace them: every letter-reachable triple of cells on all
 * seven squares, every spelling of every name in magick-data's
 * `planetaryNames` that any witness gives (and decision 10's division of
 * the spirit of spirits), at ordinary values and with finals at 500–900,
 * and seeded random words of 4 to 12 letters per square. The grid's
 * templates are in `kameaTemplates.ts`, vol. 4's two worked examples in
 * `fixtures.ts`.
 */

import { letterValue } from "magick-data/astrology/aiqBekar";
import {
  KAMEA_PLANETS,
  type KameaPlanetId,
} from "magick-data/astrology/kameas";
import planetaryNames, {
  PLANETARY_NAME_WITNESSES,
  type PlanetaryName,
  readingOf,
} from "magick-data/astrology/planetaryNames";
import { kameaLayout } from "../kameaLayout.ts";
import type { PlaceId } from "../types.ts";
import { seededRandom } from "./corpus.ts";
import { FIGURE_GRAMMAR } from "./figure.ts";

/** The seven squares, Saturn's (order 3) to the Moon's (order 9). */
export const CORPUS_KAMEA_PLANETS: readonly KameaPlanetId[] = KAMEA_PLANETS;

/** The 22 letters, in order, final forms left out (they reach the same cells). */
const LETTERS = [..."אבגדהוזחטיכלמנסעפצקרשת"];

/**
 * One letter for each cell the letters reach on `planet`'s square, at
 * ordinary values, the first in the alphabet that reaches it: 9 cells on
 * Saturn's square up to 17 on the Moon's. A figure depends only on its
 * cells, so these letters stand for every letter that reaches the cell.
 */
export function kameaCellLetters(planet: KameaPlanetId): Map<PlaceId, string> {
  const layout = kameaLayout(planet);
  const cells = new Map<PlaceId, string>();
  for (const letter of LETTERS) {
    const place = layout.place(letter);
    if (place !== null && !cells.has(place)) cells.set(place, letter);
  }
  return cells;
}

/**
 * Every text of three letters that reaches a distinct triple of cells on
 * `planet`'s square, repeats included (n³ for the n cells the letters
 * reach): 15,273 on the seven squares.
 */
export function kameaTriples(planet: KameaPlanetId): string[] {
  const letters = [...kameaCellLetters(planet).values()];
  const texts: string[] = [];
  for (const a of letters)
    for (const b of letters) for (const c of letters) texts.push(a + b + c);
  return texts;
}

/** A name traced on its square, as the pages trace it. */
export interface KameaNameCase {
  /** The row's id, the witness and the finals mode: `zazel agrippa1533`, `… finals`. */
  id: string;
  /** The name's row in `planetaryNames`. */
  nameId: string;
  planet: KameaPlanetId;
  /** The Hebrew traced, its words spaced. */
  text: string;
  /** Finals at 500–900 (`kameaLayout`'s `finals`). */
  finals: boolean;
}

/** Whether every character of `hebrew` but spaces is one of the 27 letters. */
function allLetters(hebrew: string): boolean {
  for (const c of hebrew.replace(/\s/g, ""))
    try {
      letterValue(c);
    } catch {
      return false;
    }
  return true;
}

/**
 * Every name the pages trace (plan 093, the K2 gate): each spelling any
 * witness gives (each reading's `he`) and each row's `division` (decision
 * 10, the spirit of spirits word by word), on the row's square, with finals
 * at ordinary values and at 500–900, divine names among them. A spelling
 * two witnesses share, or one whose finals change no cell, is one case.
 */
export function kameaNameCases(): KameaNameCase[] {
  const cases: KameaNameCase[] = [];
  const seen = new Set<string>();
  const rows: [string, PlanetaryName][] = Object.entries(planetaryNames);
  for (const [nameId, row] of rows) {
    const planet = row.planetId as KameaPlanetId;
    const spellings: [string, string][] = [];
    for (const witness of PLANETARY_NAME_WITNESSES) {
      const he = readingOf(row, witness)?.he;
      if (he) spellings.push([witness, he]);
    }
    if (row.division) spellings.push(["division", row.division]);
    for (const [source, text] of spellings) {
      if (!allLetters(text))
        throw new Error(`kameaNameCases: ${nameId} ${source}: ${text}`);
      for (const finals of [false, true]) {
        const layout = kameaLayout(planet, { finals });
        // The cells the text traces: what makes two cases one figure.
        const cells = text
          .trim()
          .split(/\s+/)
          .map((word) => [...word].map((c) => layout.place(c)).join(" "))
          .join(" | ");
        const key = `${planet} ${cells}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cases.push({
          id: `${nameId} ${source}${finals ? " finals" : ""}`,
          nameId,
          planet,
          text,
          finals,
        });
      }
    }
  }
  return cases;
}

/** The random corpus on each square: what CI runs. */
export const KAMEA_RANDOM_CORPUS = {
  /** Plan 093's number; each square's seed is this plus its index. */
  seed: 93,
  /** Words of each length from `minLength` to `maxLength`, per square. */
  perLength: 20,
  minLength: 4,
  maxLength: 12,
} as const;

/**
 * Random one-word texts on `planet`'s square, `perLength` of each length,
 * drawn as the rose's random corpus is (`randomRoseTexts`): each letter
 * repeats the last cell with chance 0.15, returns to an earlier one with
 * chance 0.15, and is otherwise any letter-reachable cell, uniformly; a
 * letter that would take the word outside the grammar's domain (runs of
 * at most three, four visits to a cell) is drawn again. Letters are
 * `kameaCellLetters`'. Deterministic for a seed and square.
 */
export function randomKameaTexts(
  planet: KameaPlanetId,
  {
    seed,
    perLength,
    minLength,
    maxLength,
  }: {
    seed: number;
    perLength: number;
    minLength: number;
    maxLength: number;
  } = KAMEA_RANDOM_CORPUS,
): string[] {
  const letters = [...kameaCellLetters(planet).values()];
  const next = seededRandom(seed + CORPUS_KAMEA_PLANETS.indexOf(planet));
  const texts: string[] = [];
  for (let length = minLength; length <= maxLength; length++)
    for (let n = 0; n < perLength; n++) {
      let word = "";
      while (word.length < length) {
        const roll = next();
        const pool = [...word];
        const letter =
          roll < 0.15 && word
            ? pool[pool.length - 1]
            : roll < 0.3 && word
              ? pool[Math.floor(next() * pool.length)]
              : letters[Math.floor(next() * letters.length)];
        if (inKameaDomain(word + letter, planet)) word += letter;
      }
      texts.push(word);
    }
  return texts;
}

/**
 * Whether a word is within the figure grammar's domain on `planet`'s
 * square: no run of one cell longer than `maxCrooks + 1` letters, and no
 * cell visited more than `maxVisits` times (a run is one visit).
 */
export function inKameaDomain(word: string, planet: KameaPlanetId): boolean {
  const layout = kameaLayout(planet);
  const runs: { cell: PlaceId | null; length: number }[] = [];
  for (const letter of word) {
    const cell = layout.place(letter);
    const last = runs[runs.length - 1];
    if (last && last.cell === cell) last.length++;
    else runs.push({ cell, length: 1 });
  }
  if (runs.some((r) => r.length > FIGURE_GRAMMAR.crook.maxCrooks + 1))
    return false;
  const visits = new Map<PlaceId | null, number>();
  for (const r of runs) visits.set(r.cell, (visits.get(r.cell) ?? 0) + 1);
  return [...visits.values()].every((n) => n <= FIGURE_GRAMMAR.maxVisits);
}
