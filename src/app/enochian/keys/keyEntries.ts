import type {
  EnochianDictionary,
  EnochianEntry,
} from "magick-data/enochian/dictionary";
import dictionary from "magick-data/enochian/dictionary";
import keys, {
  type Aethyr,
  aethyrs,
  type EnochianKey,
  KEY_VERSIONS,
  keyVersion,
} from "magick-data/enochian/keys";

/**
 * The dictionary entries the Keys need, resolved on the server.
 *
 * The page used to import the whole dictionary into the browser — 243 KB of
 * client chunk on a page that reads a few hundred words of it — because the
 * lookup happened in the component. It happens here instead, and the page
 * hands the client a plain map of word to entries.
 *
 * The lookup is not exact-only. The Keys and the dictionary are
 * transcriptions of the same manuscripts by different hands, so a word can be
 * filed under a spelling the Keys do not use: `URBS` is `VRBS`, `GIUI` is
 * `GIVI`, `GRSAM` is `G-RSAM` (plan 032, data fixes). U and V are one letter
 * in the sources, and a hyphen in a dictionary key is a reading aid rather
 * than part of the word, so both are tried after the exact key fails.
 *
 * Dee's words are often two that the dictionary holds apart (`NORMOLAP` is
 * `NOR` and `MOLAP`), so a word found no other way is tried as two entries,
 * a first part and the rest, and both are given (plan 073, decision 9). A
 * word is always looked up by Dee's spelling, whatever the version shows.
 */

/** A word's spellings to try, in order, the word itself first. */
export function spellings(word: string): string[] {
  const tried = [word, word.replaceAll("U", "V"), word.replaceAll("V", "U")];
  return tried.filter((one, index) => tried.indexOf(one) === index);
}

/**
 * The dictionary's keys without their hyphens, each mapped to the key it came
 * from. A key that strips to one already there keeps the earlier one, which
 * is the order the file is written in.
 */
function unhyphenated(source: EnochianDictionary) {
  const index = new Map<string, string>();
  for (const key of Object.keys(source)) {
    // A trailing hyphen marks an affix, which no word should resolve to.
    if (key.endsWith("-")) continue;
    const stripped = key.replaceAll("-", "");
    if (stripped !== key && !index.has(stripped)) index.set(stripped, key);
  }
  return index;
}

/** The key a word is filed under, or `undefined` if it is not in the book. */
export function findWord(
  source: EnochianDictionary,
  word: string,
  stripped = unhyphenated(source),
): string | undefined {
  const tried = spellings(word);
  for (const one of tried) if (Object.hasOwn(source, one)) return one;
  for (const one of tried) {
    const found = stripped.get(one.replaceAll("-", ""));
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The shortest part a word is split into: one letter is too easily found. */
const SHORTEST_PART = 2;

/**
 * The keys a word is filed under: one, or two where it is found only as a
 * first part and the rest, both in the book; `undefined` otherwise. Of the
 * ways to split it, the longest first part that works is taken.
 */
export function findParts(
  source: EnochianDictionary,
  word: string,
  stripped = unhyphenated(source),
): string[] | undefined {
  const whole = findWord(source, word, stripped);
  if (whole !== undefined) return [whole];
  for (let at = word.length - SHORTEST_PART; at >= SHORTEST_PART; at--) {
    const first = findWord(source, word.slice(0, at), stripped);
    if (first === undefined) continue;
    const rest = findWord(source, word.slice(at), stripped);
    if (rest !== undefined) return [first, rest];
  }
  return undefined;
}

/**
 * Every word the Keys look up, in the order the Keys say them: Dee's, in
 * every version, and on Key 19 for every Aethyr in `table`.
 */
export function keyWords(
  from: readonly EnochianKey[] = keys,
  table: readonly Aethyr[] = aethyrs,
): string[] {
  const words = new Set<string>();
  for (const key of from) {
    const calls = key.key === 19 ? table.map((one) => one.n) : [];
    for (const version of KEY_VERSIONS)
      for (const n of calls.length ? calls : [1])
        for (const word of keyVersion(key, version, n, table) ?? [])
          if (word.lookup) words.add(word.lookup);
  }
  return [...words];
}

/** A word's entry: the key it is filed under, and what is filed there. */
export interface KeyEntry {
  key: string;
  entry: EnochianEntry;
}

/**
 * Those of the given words the dictionary has, by the word as asked for:
 * one entry, or two for a word found as two parts.
 */
export function entriesFor(
  words: Iterable<string>,
  source: EnochianDictionary = dictionary,
): Record<string, readonly KeyEntry[]> {
  const stripped = unhyphenated(source);
  const found: Record<string, readonly KeyEntry[]> = {};
  for (const word of words) {
    const parts = findParts(source, word, stripped);
    if (parts) found[word] = parts.map((key) => ({ key, entry: source[key] }));
  }
  return found;
}

/**
 * What the page ships: the entries of every word the Keys use. Resolved
 * once, at import, since the dictionary does not change while the process
 * runs.
 */
export const KEY_ENTRIES: Readonly<Record<string, readonly KeyEntry[]>> =
  entriesFor(keyWords());
