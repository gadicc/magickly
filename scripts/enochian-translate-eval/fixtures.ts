import type {
  EnochianDictionary,
  EnochianEntry,
} from "magick-data/enochian/dictionary";
import type { KeyRowRecord, SourceData } from "./testset.ts";

/** Test fixtures: a few made-up rows and entries, not the real data. */

export function entry(...meanings: string[]): EnochianEntry {
  return {
    gematria: [],
    meanings: meanings.map((meaning) => ({ meaning, source: "WE" })),
    pronounciations: [],
  };
}

export function row(
  key: number,
  n: number,
  word: string | undefined,
  english: string,
  gd?: string,
): KeyRowRecord {
  const out: KeyRowRecord = { id: `${key}.${n}`, key, row: n, english };
  if (word) out.word = word;
  if (gd) out.gd = gd;
  return out;
}

/**
 * Key 1 holds ZORGE and CAOSGO (said nowhere else) and OL (also in Key 2);
 * Key 2 says OL and CAOSG. The dictionary has a same-spelled entry, a
 * hyphenated twin, a longer and a too-short neighbour of ZORGE, and CAOSG,
 * which CAOSGO contains but Key 2 says.
 */
export const dictionary: EnochianDictionary = {
  OL: entry("I, my"),
  ORG: entry("a short word"),
  ZORGE: entry("be friendly unto me"),
  "ZOR-GE": entry("friendly"),
  ZORGEX: entry("friendliness"),
  CAOSG: entry("earth"),
  CAOSGIN: entry("earth, var of caosg"),
  IAD: entry("meaning unknown", "God"),
};

export const rows: KeyRowRecord[] = [
  row(1, 1, "OL", "I"),
  row(1, 2, "ZORGE", "be friendly unto me", "zodoreje"),
  row(1, 3, "CAOSGO", "of the earth"),
  row(1, 4, "IAD", ""),
  row(2, 1, "OL", "I"),
  row(2, 2, "CAOSG", "the earth"),
  row(2, 3, "IAD", "God"),
  row(2, 4, undefined, "lost word", "paeb"),
];

export const data: SourceData = { dictionary, rows };
