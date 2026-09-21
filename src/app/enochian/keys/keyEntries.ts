import type {
  EnochianDictionary,
  EnochianEntry,
} from "@/../data/enochian/Dictionary";
import dictionary from "@/../data/enochian/Dictionary";
import keys from "@/../data/enochian/Keys";

/**
 * The dictionary entries the nineteen Keys need, resolved on the server.
 *
 * The page used to import the whole dictionary into the browser — 243 KB of
 * client chunk on a page that reads 181 words of it — because the lookup
 * happened in the component. It happens here instead, and the page hands the
 * client a plain map of word to entry.
 *
 * The lookup is not exact-only. The Keys and the dictionary are
 * transcriptions of the same manuscripts by different hands, so a word can be
 * filed under a spelling the Keys do not use: `URBS` is `VRBS`, `GIUI` is
 * `GIVI`, `GRSAM` is `G-RSAM` (plan 032, data fixes). U and V are one letter
 * in the sources, and a hyphen in a dictionary key is a reading aid rather
 * than part of the word, so both are tried after the exact key fails.
 * `CASARMA` wanted neither in the end. No spelling of it found an entry,
 * because `CASARM`'s second meaning carried it run into the text —
 * "whom, unto whomCASARMA whom" — the transcription fault `BIA` and `BIAB`
 * had before step 3a parted them. Parted in its turn, it is a word of its
 * own and is found exactly, and every word of the Keys is in the book.
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

/** Every word of the Keys, in the order the Keys say them. */
export function keyWords(): string[] {
  const words = new Set<string>();
  for (const key of keys)
    for (const subkey of key.subkeys)
      if (subkey.enochianLatin) words.add(subkey.enochianLatin);
  return [...words];
}

/** Those of the given words the dictionary has, by the word as asked for. */
export function entriesFor(
  words: Iterable<string>,
  source: EnochianDictionary = dictionary,
): Record<string, EnochianEntry> {
  const stripped = unhyphenated(source);
  const found: Record<string, EnochianEntry> = {};
  for (const word of words) {
    const key = findWord(source, word, stripped);
    if (key !== undefined) found[word] = source[key];
  }
  return found;
}

/**
 * What the page ships: every one of the 181 words the Keys use. Resolved
 * once, at import, since the dictionary does not change while the process
 * runs.
 */
export const KEY_ENTRIES: Readonly<Record<string, EnochianEntry>> = entriesFor(
  keyWords(),
);
