import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import dictionary from "magick-data/enochian/dictionary";
import keys, {
  type Aethyr,
  aethyrs,
  type EnochianKey,
  type KeyWord,
  keyVersion,
} from "magick-data/enochian/keys";
import { findParts } from "../keys/keyEntries";

/**
 * Where the Keys say each dictionary word (plan 074, decision 9), for the
 * entry's "In the Keys" and for search's tie-break.
 *
 * Words are looked up by Dee's spelling, as `/enochian/keys` looks them up
 * (`keyEntries.ts`): a word the dictionary holds as two parts (NORMOLAP as
 * NOR and MOLAP) gives each part the compound's row, marked with the
 * compound. Key 19 is read once for its own words, and its Aethyr slot once
 * per Aethyr, each use naming the Aethyr: reading the whole Key thirty
 * times would count every word thirty times.
 */

/** One place a word is said. */
export interface KeyUse {
  /** The Key, 1 to 19. */
  key: number;
  /** The row in that Key, from 1. */
  row: number;
  /** On Key 19's Aethyr slot: which Aethyr (1 LIL to 30 TEX). */
  aethyr?: number;
  /** The row's English. */
  english: string;
  /** Up to `CONTEXT` rows of English before the row, joined. */
  before: string;
  /** Up to `CONTEXT` rows of English after it, joined. */
  after: string;
  /** Dee's word, when the dictionary holds it as two parts and this is one. */
  part?: string;
}

/** Rows of English given on either side of a use. */
export const CONTEXT = 3;

/** The English of the rows around `at`, skipping rows with none. */
function around(words: readonly KeyWord[], at: number) {
  const english = (from: number, to: number) =>
    words
      .slice(Math.max(0, from), Math.max(0, to))
      .map((one) => one.english.trim())
      .filter(Boolean)
      .join(" ");
  return {
    before: english(at - CONTEXT, at),
    after: english(at + 1, at + 1 + CONTEXT),
  };
}

/**
 * Every use of every dictionary word in the Keys, by dictionary key, in the
 * order the Keys say them.
 */
export function buildKeyUses(
  source: EnochianDictionary = dictionary,
  from: readonly EnochianKey[] = keys,
  table: readonly Aethyr[] = aethyrs,
): Record<string, KeyUse[]> {
  const uses: Record<string, KeyUse[]> = {};
  const add = (
    word: KeyWord,
    all: readonly KeyWord[],
    use: { key: number; aethyr?: number },
  ) => {
    if (!word.lookup || word.unspoken || !word.english.trim()) return;
    const parts = findParts(source, word.lookup);
    if (!parts) return;
    const at = word.row - 1;
    for (const part of parts) {
      const one: KeyUse = {
        key: use.key,
        row: word.row,
        english: word.english.trim(),
        ...around(all, at),
      };
      if (use.aethyr !== undefined) one.aethyr = use.aethyr;
      if (parts.length > 1) one.part = word.lookup;
      (uses[part] ??= []).push(one);
    }
  };
  for (const key of from) {
    const words = keyVersion(key, "dee", 1, table);
    if (!words) continue;
    for (const word of words) {
      // Key 19's Aethyr slot is read per Aethyr below.
      if (word.slot === "aethyr") continue;
      add(word, words, { key: key.key });
    }
    if (key.key !== 19) continue;
    for (const aethyr of table) {
      const call = keyVersion(key, "dee", aethyr.n, table);
      for (const word of call ?? [])
        if (word.slot === "aethyr")
          add(word, call ?? [], { key: key.key, aethyr: aethyr.n });
    }
  }
  return uses;
}

/** How many uses each word has, for search's tie-break. */
export function countUses(
  uses: Readonly<Record<string, readonly KeyUse[]>>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(uses).map(([word, list]) => [word, list.length]),
  );
}
