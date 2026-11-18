/**
 * The oracle's corpus beyond the hand-written cases (plan 088, "The
 * corpus"): the 72 names as magick-data gives them, every two- and
 * three-letter text on each rose, and the kamea stubs. The hand fixtures
 * and templates are in `fixtures.ts` and `templates.ts`.
 */

import angels from "magick-data/kabbalah/seventyTwoAngels";
import {
  ROSE_VERSIONS,
  type RoseVersionId,
  roseRings,
} from "../../gd/roseSigilInternals.ts";
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
