/**
 * The oracle's corpus beyond the hand-written cases (plan 088, "The
 * corpus"): the 72 names as magick-data gives them, every two- and
 * three-letter text on each rose, a seeded random corpus of longer words,
 * and the kamea stubs. The hand fixtures and templates are in
 * `fixtures.ts` and `templates.ts`.
 */

import angels from "magick-data/kabbalah/seventyTwoAngels";
import {
  ROSE_VERSIONS,
  type RoseVersionId,
  roseRings,
} from "../../gd/roseSigilInternals.ts";
import { FIGURE_GRAMMAR } from "./figure.ts";
import { KAMEA_FIXTURES } from "./fixtures.ts";

/** One of the 72 names, by its number in Lenain's order. */
export interface NameCase {
  id: string;
  number: number;
  text: string;
}

/**
 * The 72 names: the triads of Exodus 14:19–21 with Lenain's יה/אל
 * suffixes, from magick-data's `seventyTwoAngels` (plan 033).
 */
export const SEVENTY_TWO_NAMES: readonly NameCase[] = angels.map((angel) => ({
  id: `72-${angel.no}`,
  number: angel.no,
  text: angel.name.he,
}));

/** The roses the exhaustive corpus runs on: every version. */
export const CORPUS_ROSE_VERSIONS: readonly RoseVersionId[] = ROSE_VERSIONS;

/**
 * Every text of `length` letters drawn from the rose's 22, repeats
 * included (22² pairs, 22³ triples), in the order of `version`'s rings.
 */
export function* roseTexts(
  length: number,
  version: RoseVersionId,
): Generator<string> {
  const letters = roseRings(version).flat();
  const indices: number[] = Array(length).fill(0);
  if (length < 1) return;
  for (;;) {
    yield indices.map((i) => letters[i]).join("");
    let k = length - 1;
    while (k >= 0 && indices[k] === letters.length - 1) indices[k--] = 0;
    if (k < 0) return;
    indices[k] += 1;
  }
}

/** The kamea stubs: Zazel on Saturn's square, Taphthartharath on Mercury's. */
export const KAMEA_STUBS = KAMEA_FIXTURES.map(({ id, planet, numbers }) => ({
  id,
  planet,
  numbers,
}));

/**
 * A small seeded generator (xorshift32), so the random corpus is the same
 * on every run and engine: never `Math.random`.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 2 ** 32;
  };
}

/**
 * Whether a word of rose letters is within the figure grammar's domain:
 * no run longer than `maxCrooks + 1` letters, and no place visited more
 * than `maxVisits` times (a run is one visit).
 */
export function inGrammarDomain(word: string): boolean {
  const runs: { letter: string; length: number }[] = [];
  for (const letter of word) {
    const last = runs[runs.length - 1];
    if (last && last.letter === letter) last.length++;
    else runs.push({ letter, length: 1 });
  }
  if (runs.some((r) => r.length > FIGURE_GRAMMAR.crook.maxCrooks + 1))
    return false;
  const visits = new Map<string, number>();
  for (const r of runs) visits.set(r.letter, (visits.get(r.letter) ?? 0) + 1);
  return [...visits.values()].every((n) => n <= FIGURE_GRAMMAR.maxVisits);
}

/** The random corpus's settings: what CI runs. */
export const RANDOM_CORPUS = {
  seed: 88,
  /** Words of each length from `minLength` to `maxLength`, per rose. */
  perLength: 40,
  minLength: 4,
  maxLength: 12,
} as const;

/**
 * Random one-word texts beyond the triples (plan 088 allows 32 letters):
 * `perLength` words of each length. Each letter repeats the last with
 * chance 0.15, returns to an earlier one with chance 0.15, and is
 * otherwise drawn uniformly from the rose's 22; a letter that would take
 * the word outside the grammar's domain is drawn again.
 * Deterministic for a seed; the same words on every rose version.
 */
export function randomRoseTexts({
  seed,
  perLength,
  minLength,
  maxLength,
}: {
  seed: number;
  perLength: number;
  minLength: number;
  maxLength: number;
} = RANDOM_CORPUS): string[] {
  const letters = roseRings("gd").flat();
  const next = seededRandom(seed);
  const texts: string[] = [];
  for (let length = minLength; length <= maxLength; length++)
    for (let n = 0; n < perLength; n++) {
      let word = "";
      while (word.length < length) {
        // Uniform letters seldom repeat or return; weight both, so crooks
        // (R3) and returns (F1) are exercised.
        const roll = next();
        const pool = word ? [...word] : letters;
        const letter =
          roll < 0.15 && word
            ? pool[pool.length - 1]
            : roll < 0.3 && word
              ? pool[Math.floor(next() * pool.length)]
              : letters[Math.floor(next() * letters.length)];
        if (inGrammarDomain(word + letter)) word += letter;
      }
      texts.push(word);
    }
  return texts;
}

/**
 * Longer words, beyond the tested domain: the contract and the page take
 * 32 letters, but CI's corpus stops at 12, and longer words are drawn
 * best effort, the page saying when a figure fails its own checks. The
 * report (`pnpm sigils:oracle`) runs these, apart from the rest; CI does
 * not. The same generator as `RANDOM_CORPUS`, so only the length is
 * beyond it: runs and visits stay within the grammar's domain.
 */
export const BEYOND_DOMAIN_CORPUS = {
  seed: 1332,
  perLength: 10,
  minLength: 13,
  maxLength: 32,
} as const;

/**
 * Words at the edge of the domain the random corpus seldom reaches: four
 * visits to one place, with and without crooks.
 */
export const DOMAIN_EDGE_TEXTS = ["אבאגאדא", "ללהללהללהל"] as const;

/**
 * Every A-B-A-B-A word on the rose, A and B any two letters (462): two
 * returns to each place, the case where the earlier visits crowd a slack
 * disc most within the domain's short words.
 */
export function ababaTexts(version: RoseVersionId): string[] {
  const letters = roseRings(version).flat();
  const texts: string[] = [];
  for (const a of letters)
    for (const b of letters) if (a !== b) texts.push(`${a}${b}${a}${b}${a}`);
  return texts;
}
