import keys, {
  type Aethyr,
  aethyrs,
  checkedText,
  type EnochianKey,
  type GdMarker,
  hasVersion,
  type KeyWord,
  type KeyWorkId,
  keyTitle,
  keyVersion,
} from "magick-data/enochian/keys";

/**
 * What the page sends the browser: each Key's words in Dee's version, and
 * the Golden Dawn's forms where there are any, cut down to what the page
 * shows. Built on the server, so that the browser is not sent the readings,
 * pages and leaves of every word, nor the rules that make the versions
 * (`magick-data/enochian/keys`).
 */

/** A word in Dee's version. */
export interface PageWord {
  word: string | null;
  /** Dee's word, which the dictionary is searched by. */
  lookup: string | null;
  english: string;
  uncertain?: true;
  /** Given but not spoken, so no word is printed. */
  unspoken?: true;
  note?: string;
  /** Where `word` is not from the version's own work (an Aethyr's name). */
  from?: KeyWorkId;
}

/** A word in the Golden Dawn's version: its form, or why there is none. */
export interface PageGdWord {
  word: string | null;
  marker?: GdMarker;
  note?: string;
}

/**
 * Key 19's words that change with the Aethyr, by row index from 0, each
 * whole, to replace the first Aethyr's.
 */
export interface AethyrChanges {
  dee: Record<number, PageWord>;
  gd?: Record<number, PageGdWord>;
}

/** One Key, ready to show. */
export interface PageKey {
  key: number;
  title: string;
  /** What was checked, from the Key's own record. */
  checked: string;
  words: PageWord[];
  gd?: PageGdWord[];
  /** Key 19: for each Aethyr but the first, the words that differ. */
  aethyrs?: Record<number, AethyrChanges>;
}

/** An Aethyr for the picker. */
export interface PageAethyr {
  n: number;
  name: string;
}

function deeWord(word: KeyWord): PageWord {
  const out: PageWord = {
    word: word.word,
    lookup: word.lookup,
    english: word.english,
  };
  if (word.uncertain) out.uncertain = true;
  if (word.unspoken) out.unspoken = true;
  if (word.note) out.note = word.note;
  if (word.from) out.from = word.from;
  return out;
}

function gdWord(word: KeyWord): PageGdWord {
  const out: PageGdWord = { word: word.word };
  if (word.marker) out.marker = word.marker;
  if (word.note) out.note = word.note;
  return out;
}

/**
 * The entries of `next` that differ from `base`, by index, each whole: the
 * page replaces a word rather than merging into it, so that a field the
 * Aethyr's word lacks (`from`, `marker`) cannot be left from the first's.
 */
function changes<T>(base: readonly T[], next: readonly T[]) {
  const out: Record<number, T> = {};
  next.forEach((each, index) => {
    if (JSON.stringify(each) !== JSON.stringify(base[index])) out[index] = each;
  });
  return out;
}

/** A Key as the page shows it. */
export function pageKey(
  key: EnochianKey,
  table: readonly Aethyr[] = aethyrs,
): PageKey {
  // Every Key has Dee's version; the Golden Dawn's is asked for only
  // when the Key has it.
  const words = (n = 1) => keyVersion(key, "dee", n, table)!.map(deeWord);
  const gd = (n = 1) => keyVersion(key, "gd", n, table)!.map(gdWord);
  const out: PageKey = {
    key: key.key,
    title: keyTitle(key),
    checked: checkedText(key.checked),
    words: words(),
  };
  // A Golden Dawn word carries a note only where it is not Dee's word's.
  if (hasVersion(key, "gd"))
    out.gd = gd().map((word, index) => {
      if (word.note !== out.words[index].note) return word;
      const { note: _, ...rest } = word;
      return rest;
    });
  if (key.key === 19 && table.length) {
    out.aethyrs = {};
    for (const { n } of table) {
      if (n === 1) continue;
      const each: AethyrChanges = { dee: changes(out.words, words(n)) };
      if (out.gd) each.gd = changes(gd(), gd(n));
      out.aethyrs[n] = each;
    }
  }
  return out;
}

/** The Aethyrs for the picker, by the Equinox's names. */
export function pageAethyrs(table: readonly Aethyr[] = aethyrs): PageAethyr[] {
  return table.map((aethyr) => ({
    n: aethyr.n,
    name: aethyr.readings.equinox1912no8,
  }));
}

/** Every Key as the page shows it. */
export function pageKeys(from: readonly EnochianKey[] = keys): PageKey[] {
  return from.map((key) => pageKey(key));
}
