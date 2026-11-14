/**
 * Finding a Key word's dictionary entry, without the data: the dictionary
 * is passed in. `keyEntries.ts` uses it on the server for the Keys page,
 * and the translator (plan 081) in the browser, which must not import the
 * whole dictionary and Keys just to resolve a word. The rules are
 * `keyEntries.ts`'s: U and V tried both ways, a hyphen in a key ignored,
 * and a word found no other way taken as two entries. Only the keys are
 * read, so any record keyed by headword will do.
 */

/** A dictionary, as far as finding a key goes. */
export type Headwords = Readonly<Record<string, unknown>>;

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
export function unhyphenated(source: Headwords) {
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
  source: Headwords,
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
 * Words found as two parts only by accident, which are not split: the
 * parts the dictionary would give are not what the word is.
 */
export const DO_NOT_SPLIT: Readonly<Record<string, string>> = {
  RESTIL: "REST + IL would read the ending as a word; Dee's RESTEL is one",
  GMICALZOMA: "GMICALZO + MA leaves a fragment, not the word MA",
  OMAXA: "OMA + XA leaves a fragment, not a word",
};

/**
 * The keys a word is filed under: one, or two where it is found only as a
 * first part and the rest, both in the book; `undefined` otherwise. Of the
 * ways to split it, the longest first part that works is taken; a word in
 * `DO_NOT_SPLIT` is never split.
 */
export function findParts(
  source: Headwords,
  word: string,
  stripped = unhyphenated(source),
): string[] | undefined {
  const whole = findWord(source, word, stripped);
  if (whole !== undefined) return [whole];
  if (Object.hasOwn(DO_NOT_SPLIT, word)) return undefined;
  for (let at = word.length - SHORTEST_PART; at >= SHORTEST_PART; at--) {
    const first = findWord(source, word.slice(0, at), stripped);
    if (first === undefined) continue;
    const rest = findWord(source, word.slice(at), stripped);
    if (rest !== undefined) return [first, rest];
  }
  return undefined;
}
