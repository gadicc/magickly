import type {
  EnochianDictionary,
  EnochianEntry,
} from "magick-data/enochian/dictionary";

/**
 * Search for the Enochian dictionary, both ways at once: English words in
 * the meanings, and Enochian spellings (plan 074, decision 5).
 *
 * The meanings are free text from several hands, so the rules are about
 * the text as it is: The Whole Enochian Dictionary puts a headword first
 * and its context after ("kingdom, in thy kingdom"), inverts articles
 * ("GOVERNOR, THE"), and mixes in references that are not meanings ("PART
 * IN …", "var of …") and "meaning unknown". A meaning is cut into senses at
 * `;` and pieces at `,`, and a query is compared with pieces, word by word.
 *
 * The module is pure: the page builds the index once and searches it on
 * each keystroke. It returns groups rather than one list, so a translator
 * could later add a group of its own without touching the ranking.
 */

/** One word found, with the meaning that found it. */
export interface Hit {
  /** The dictionary key. */
  word: string;
  /** The meaning to show in the row, or `null` when none is known. */
  meaning: string | null;
  /** Which of the word's meanings that is, from 0; -1 for none. */
  meaningIndex: number;
  /** 0 is best. English: 0–4 ordinary, 5–9 references. Spellings: 0–2. */
  tier: number;
}

/** What a query finds, group by group, each ranked best first. */
export interface SearchResult {
  /** The query's words, as compared (lower case); empty for no English. */
  terms: string[];
  /** The headwords the query spells exactly, pinned above every group. */
  word: Hit[];
  /** Words a piece of whose meaning is the query, or begins with it. */
  means: Hit[];
  /** Words whose meanings contain the query, or a form of it. */
  mentions: Hit[];
  /** Words spelled with the query, apart from those in `word`. */
  spelled: Hit[];
  /** Which comes first: the English groups, or the spellings. */
  lead: "english" | "spelled";
}

/** One comma-separated piece of a meaning, as words. */
interface Piece {
  /** Every word of the piece. */
  all: string[];
  /** The piece without its leading articles, "to" and possessives. */
  bare: string[];
  allStems: string[];
  bareStems: string[];
  /** Which sense of the meaning (split at `;`), from 0. */
  sense: number;
  /** Which piece of the sense, from 0. */
  piece: number;
  /** "part in …", "var of …", "name from …": a reference, not a meaning. */
  reference: boolean;
}

interface IndexedWord {
  word: string;
  /** The key folded for spelling search (see `foldSpelling`). */
  folded: string;
  /** Pieces of each meaning, by meaning; `null` for an unknown meaning. */
  meanings: (Piece[] | null)[];
  entry: EnochianEntry;
  /** How often the Keys say the word, to break ties. */
  uses: number;
}

/** The index the page builds once. */
export interface DictionaryIndex {
  words: IndexedWord[];
}

/** Words set aside at the start of a piece, for comparison and length. */
const LEADING = new Set([
  "the",
  "a",
  "an",
  "to",
  "of",
  "in",
  "o",
  "ye",
  "thy",
  "thine",
  "your",
  "his",
  "her",
  "its",
  "my",
  "our",
  "their",
]);

/** A piece of only these words is an inverted article: "GOVERNOR, THE". */
const FOLDED = new Set([
  "the",
  "a",
  "an",
  "your",
  "his",
  "her",
  "its",
  "my",
  "our",
  "their",
  "thy",
  "of the",
  "in the",
  "to the",
  "i have",
]);

/** Words that are no English query on their own. */
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "and",
  "or",
  "is",
]);

/** "meaning unknown", "MEANING UNKNOWN, SEE …", or just "unknown". */
const UNKNOWN = /meaning unknown|^\s*unknown\s*$/i;
const REFERENCE = /^(?:part in|var of|variant of|name from)\b/;

/** Lower-cased words, without punctuation; "god's" is "god". */
export function words(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replaceAll("’", "'")
      .match(/[a-z0-9']+/g)
      ?.map((one) => one.replace(/'s$/, "").replaceAll("'", ""))
      .filter(Boolean) ?? []
  );
}

/**
 * A word's stem, so "angels" meets "angel" and "loving" meets "love". Both
 * the query and the meanings go through it. It leaves words under four
 * letters alone and never strips -er, -ly, -est or a bare -d, so "go" is
 * not "god" and "he" is not "her".
 */
export function stem(word: string): string {
  if (word.length < 4) return word;
  let out = word;
  if (out.endsWith("ies") && out.length > 4) out = `${out.slice(0, -3)}y`;
  else if (/(?:ss|x|z|ch|sh)es$/.test(out)) out = out.slice(0, -2);
  else if (out.endsWith("eth") && out.length > 5) out = out.slice(0, -3);
  else if (out.endsWith("ing") && out.length > 5) out = out.slice(0, -3);
  else if (out.endsWith("ed") && out.length > 4) out = out.slice(0, -2);
  else if (/[^su]s$/.test(out)) out = out.slice(0, -1);
  // "spirited" and "spirite" meet "spirit"; but a final e is dropped only
  // where four letters stay, so "note" is not "not", "made" not "mad".
  if (out.length > 4 && out.endsWith("e")) out = out.slice(0, -1);
  return out;
}

/** The pieces of a meaning (see the module's comment). */
function pieces(meaning: string): Piece[] {
  const out: Piece[] = [];
  const text = meaning.toLowerCase().replace(/[^a-z0-9'’;,\s-]/g, " ");
  text.split(";").forEach((sense, senseIndex) => {
    let pieceIndex = 0;
    for (const part of sense.split(",")) {
      const all = words(part);
      if (!all.length) continue;
      if (out.length && FOLDED.has(all.join(" "))) continue;
      let start = 0;
      while (start < all.length - 1 && LEADING.has(all[start])) start++;
      const bare = all.slice(start);
      out.push({
        all,
        bare,
        allStems: all.map(stem),
        bareStems: bare.map(stem),
        sense: senseIndex,
        piece: pieceIndex++,
        reference: REFERENCE.test(all.join(" ")),
      });
    }
  });
  return out;
}

/**
 * A key folded for spelling search: upper case, letters only, and the
 * letters Enochian writes as one taken as one (C/K, I/Y/J, U/V/W), so a
 * keypad of 21 letters can type every word.
 */
export function foldSpelling(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/K/g, "C")
    .replace(/[YJ]/g, "I")
    .replace(/[UW]/g, "V");
}

/** The first meaning that is not "meaning unknown", with its index. */
export function firstKnownMeaning(entry: EnochianEntry): {
  meaning: string | null;
  meaningIndex: number;
} {
  const meaningIndex = entry.meanings.findIndex(
    (one) => !UNKNOWN.test(one.meaning),
  );
  return meaningIndex < 0
    ? { meaning: null, meaningIndex: -1 }
    : { meaning: entry.meanings[meaningIndex].meaning, meaningIndex };
}

/**
 * Builds the index once. `uses` counts how often the Keys say each word
 * (decision 9), which breaks ties: the forms the Keys use come first.
 */
export function buildIndex(
  dictionary: EnochianDictionary,
  uses: Readonly<Record<string, number>> = {},
): DictionaryIndex {
  return {
    words: Object.entries(dictionary).map(([word, entry]) => ({
      word,
      folded: foldSpelling(word),
      meanings: entry.meanings.map((one) =>
        UNKNOWN.test(one.meaning) ? null : pieces(one.meaning),
      ),
      entry,
      uses: uses[word] ?? 0,
    })),
  };
}

/** Where `needle` occurs in `haystack` as consecutive words. */
function contains(haystack: string[], needle: string[]): boolean {
  outer: for (let at = 0; at + needle.length <= haystack.length; at++) {
    for (let i = 0; i < needle.length; i++)
      if (haystack[at + i] !== needle[i]) continue outer;
    return true;
  }
  return false;
}

const startsWith = (haystack: string[], needle: string[]) =>
  needle.length <= haystack.length &&
  needle.every((one, i) => haystack[i] === one);

const equals = (a: string[], b: string[]) =>
  a.length === b.length && startsWith(a, b);

/**
 * A piece's tier for the query, or `undefined` if it does not match. 0: the
 * piece is the query; 1: it is a form of it ("angel" for "angels"); 2: it
 * begins with the query or a form of it; 3: the query is inside it; 4: a
 * form of the query is inside it, or a longer query's words all are.
 * References ("part in …") rank five tiers lower.
 */
function tierOf(piece: Piece, terms: string[], stems: string[]) {
  let tier: number | undefined;
  if (equals(piece.bare, terms)) tier = 0;
  else if (equals(piece.bareStems, stems)) tier = 1;
  else if (startsWith(piece.bare, terms) || startsWith(piece.bareStems, stems))
    tier = 2;
  else if (contains(piece.all, terms)) tier = 3;
  else if (
    contains(piece.allStems, stems) ||
    (stems.length > 1 && stems.every((one) => piece.allStems.includes(one)))
  )
    tier = 4;
  if (tier === undefined) return undefined;
  return piece.reference ? tier + REFERENCE_TIERS : tier;
}

/** How far a reference drops: below every ordinary tier. */
const REFERENCE_TIERS = 5;

/** The last tier of `means`. */
const LAST_MEANS_TIER = 2;

/** Compares two sort keys, element by element. */
function compare(a: (number | string)[], b: (number | string)[]) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (typeof a[i] === "string")
      return String(a[i]).localeCompare(String(b[i]));
    return (a[i] as number) - (b[i] as number);
  }
  return 0;
}

/** The English groups: each word once, at its best piece. */
function english(index: DictionaryIndex, terms: string[]) {
  const stems = terms.map(stem);
  const found: { hit: Hit; key: (number | string)[] }[] = [];
  for (const one of index.words) {
    let best: { hit: Hit; key: (number | string)[] } | undefined;
    one.meanings.forEach((meaning, meaningIndex) => {
      for (const piece of meaning ?? []) {
        const tier = tierOf(piece, terms, stems);
        if (tier === undefined) continue;
        const key = [
          tier,
          meaningIndex,
          piece.sense,
          piece.piece,
          piece.bare.length,
          -one.uses,
          one.word,
        ];
        if (!best || compare(key, best.key) < 0)
          best = {
            hit: {
              word: one.word,
              meaning: one.entry.meanings[meaningIndex].meaning,
              meaningIndex,
              tier,
            },
            key,
          };
      }
    });
    if (best) found.push(best);
  }
  found.sort((a, b) => compare(a.key, b.key));
  const hits = found.map((one) => one.hit);
  return {
    means: hits.filter((hit) => hit.tier <= LAST_MEANS_TIER),
    mentions: hits.filter((hit) => hit.tier > LAST_MEANS_TIER),
  };
}

/** A row for a word found by its spelling: its first known meaning. */
function spellingHit(one: IndexedWord, tier: number): Hit {
  return { word: one.word, ...firstKnownMeaning(one.entry), tier };
}

/** The spelling groups: exact headwords, then the rest. */
function spellings(index: DictionaryIndex, query: string) {
  const folded = foldSpelling(query);
  if (!folded) return { word: [], spelled: [] };
  const found: { one: IndexedWord; tier: number }[] = [];
  for (const one of index.words) {
    const at = one.folded.indexOf(folded);
    if (at < 0) continue;
    found.push({
      one,
      tier: one.folded === folded ? 0 : at === 0 ? 1 : 2,
    });
  }
  found.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.one.folded.length - b.one.folded.length ||
      a.one.word.localeCompare(b.one.word),
  );
  const hits = found.map(({ one, tier }) => spellingHit(one, tier));
  return {
    word: hits.filter((hit) => hit.tier === 0),
    spelled: hits.filter((hit) => hit.tier > 0),
  };
}

/** Searches both ways; an empty query finds nothing (the page lists all). */
export function searchDictionary(
  index: DictionaryIndex,
  query: string,
): SearchResult {
  // A word typed twice counts once.
  const all = [...new Set(words(query))];
  const terms = all.every((one) => STOPWORDS.has(one)) ? [] : all;
  const { means, mentions } = terms.length
    ? english(index, terms)
    : { means: [], mentions: [] };
  const { word, spelled } = spellings(index, query);
  return {
    terms,
    word,
    means,
    mentions,
    spelled,
    lead: means.length || mentions.length ? "english" : "spelled",
  };
}

/** A run of a meaning's text, marked if it matched. */
export interface Segment {
  text: string;
  match: boolean;
}

/**
 * A meaning cut into runs, the query's words (or their forms) marked, for
 * the row's bold.
 */
export function highlight(meaning: string, terms: string[]): Segment[] {
  // In "son of light", "son" and "light" are bold, not every "of".
  const marked = terms.filter((one) => !STOPWORDS.has(one));
  if (!marked.length) return [{ text: meaning, match: false }];
  const exact = new Set(marked);
  const stems = new Set(marked.map(stem));
  const out: Segment[] = [];
  let last = 0;
  for (const found of meaning.matchAll(/[A-Za-z0-9'’]+/g)) {
    const [one] = words(found[0]);
    if (one === undefined || !(exact.has(one) || stems.has(stem(one))))
      continue;
    if (found.index > last)
      out.push({ text: meaning.slice(last, found.index), match: false });
    out.push({ text: found[0], match: true });
    last = found.index + found[0].length;
  }
  if (last < meaning.length)
    out.push({ text: meaning.slice(last), match: false });
  return out;
}
