/**
 * The gap hints' table (plan 081, S11): for an English word the lookup
 * has no form for, one of our glosses close to it in meaning, and the
 * Enochian forms that gloss leads to. Built once, offline, by
 * `scripts/enochian-hints` from SCOWL's word list and embeddings of the
 * bare word and each gloss (`README.md` beside this file); the page only
 * reads it, so a hint costs no model call.
 */

/** The table's format; a change to the layout below bumps it. */
export const HINT_TABLE_FORMAT = 2;

/**
 * The credit the served table carries: SCOWL's licence asks that its
 * notice go with every copy, and the table holds some of its words.
 */
export const HINT_TABLE_NOTICE =
  "English words from SCOWL (Spell Checking Oriented Word Lists) 2020.12.07, Copyright 2000-2018 by Kevin Atkinson and the others its notice names; the notice in full is at https://github.com/gadicc/magickly/blob/main/src/app/enochian/translate/hints/README.md";

/**
 * One gloss and the words it is the hint for: the gloss in the
 * dictionary's own wording (or Dee's), its forms as the lookup shows
 * them (`glossOptions`, best first), and the words, space-separated and
 * sorted.
 */
export type HintGroup = readonly [
  gloss: string,
  forms: readonly string[],
  words: string,
];

/** The committed table (`table.json`). */
export interface HintTable {
  format: number;
  /** SCOWL's credit (`HINT_TABLE_NOTICE`). */
  notice: string;
  /** The word list it was built from, its release and lists. */
  source: string;
  /** The embedding model and recipe, as the cache keys them. */
  recipe: string;
  /** The z-score cut-off asked for (S11 starts at 5.5). */
  asked: number;
  /**
   * The cut-off the table was built at: `asked`, or higher where the
   * budget made it rise; `null` before the first build.
   */
  cutoff: number | null;
  /**
   * SHA-256 of the gloss inputs (each gloss's text and forms, and the
   * recipe): a test fails when the dictionary or the Keys change them.
   */
  glossHash: string;
  /** How many words have a hint. */
  rows: number;
  hints: readonly HintGroup[];
}

/** A word's hint: the gloss, and the forms it leads to. */
export interface Hint {
  gloss: string;
  forms: readonly string[];
}

/** Each word of the table to its hint. */
export function hintIndex(table: Pick<HintTable, "hints">): Map<string, Hint> {
  const index = new Map<string, Hint>();
  for (const [gloss, forms, words] of table.hints) {
    const hint: Hint = { gloss, forms };
    for (const word of words.split(" ")) if (word) index.set(word, hint);
  }
  return index;
}

/**
 * The table as committed: JSON with one gloss per line, so a rebuild's
 * diff shows which hints changed (the file is outside Biome's formatter
 * for that reason). The route serves it compact.
 */
export function tableText(table: HintTable): string {
  const { hints, ...head } = table;
  const fields = Object.entries(head)
    .map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`)
    .join(",");
  if (!hints.length) return `{${fields},"hints":[]}\n`;
  return `{${fields},"hints":[\n${hints.map((one) => JSON.stringify(one)).join(",\n")}\n]}\n`;
}
