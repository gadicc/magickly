import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import {
  buildIndex,
  type DictionaryIndex,
  foldSpelling,
} from "../dictionary/search.ts";
import { unhyphenated } from "../keys/dictionaryKeys.ts";
import {
  ARTICLES,
  AUXILIARIES,
  BE,
  coreKeys,
  coreWords,
  deaccent,
  englishWords,
  IRREGULAR,
  NEGATION,
  PREPOSITIONS,
  PRONOUNS,
  sameWord,
  withoutLeadingOfTo,
  wordKey,
} from "./english.ts";
import { lookupGlosses } from "./glosses.ts";
import type { KeysTable } from "./keysTable.ts";
import { LEITCH_SPELLINGS, type LeitchSpelling } from "./leitchSpellings.ts";
import { enochianWords } from "./tokens.ts";

export { enochianWords } from "./tokens.ts";

/**
 * The translator's index, built once from the slim Keys table and the
 * dictionary (plan 081). Both directions read it; nothing here knows
 * which way a text is going.
 */

/** Crowley's marker on a row (see `KeysTableRow`). */
export type GdMarker = "joined" | "overlap" | "absent" | "split";

/** One of Dee's words in the Keys. */
export interface Row {
  /** "1.13": Key and row, 1-based. */
  id: string;
  key: number;
  /** The row in its Key, from 1. */
  row: number;
  /** Casaubon's word as printed; "" where his print lost it. */
  word: string;
  /** `word` folded (`foldSpelling`); "" for none. */
  folded: string;
  /** Crowley's form as printed; "" for none. */
  gd: string;
  /** Crowley's form folded whole ("das iod" is DASIOD). */
  gdFolded: string;
  /** Crowley's form as he spaces it, each part folded. */
  gdParts: readonly string[];
  /** Dee's English; Key 19's `{ordinal}` is the first Aethyr's. */
  english: string;
  /** Our split of Dee's running English (`englishSplit`). */
  split: boolean;
  marker?: GdMarker;
  /** Key 19's Aethyr slot (LIL on its row). */
  aethyrSlot: boolean;
  /**
   * The closing formula (G40): `first` on Key 1, `repeat` on Keys 11–18,
   * which a count of Dee's uses skips, so the formula counts once.
   */
  formula?: "first" | "repeat";
  /** The English as compared (`coreKeys`). */
  core: readonly string[];
  /** The words `core` keys, articles out (`coreWords`). */
  words: readonly string[];
}

/** Where a gloss came from: one of Dee's rows, or a dictionary meaning. */
export type Origin =
  | { kind: "key"; row: Row }
  | {
      kind: "dictionary";
      headword: string;
      /** The work cited (EMPM, WE). */
      source: string;
      /** The meaning as the dictionary has it. */
      meaning: string;
      /** The gloss taken from it. */
      gloss: string;
    };

/** A form an English core matches. */
export interface IndexHit {
  /** The form, folded. */
  form: string;
  origin: Origin;
  /** Tier 3: the preposition the gloss carries beyond the English. */
  preposition?: string;
  /**
   * The gloss's words its key was made from, in order: what each typed
   * word must be the same word as (`sameWord`), since a key only finds
   * candidates ("stare" and "stars" share one).
   */
  words: readonly string[];
}

/** One headword (or several that fold the same), with its meanings. */
export interface DictionaryWord {
  /** The dictionary's keys, in the file's order. */
  headwords: readonly string[];
  meanings: readonly { meaning: string; source: string; headword: string }[];
}

/**
 * The dictionary as far as lookup reads it: each headword's meanings and
 * the work each is cited from. The full `EnochianDictionary` is one; a
 * slim table of the same shape will do.
 */
export type LookupDictionary = Readonly<
  Record<
    string,
    { readonly meanings: readonly { meaning: string; source: string }[] }
  >
>;

/** Tiers 1 to 3 (decision 7): a core, joined by spaces, to its hits. */
export type Tiers = readonly [
  ReadonlyMap<string, readonly IndexHit[]>,
  ReadonlyMap<string, readonly IndexHit[]>,
  ReadonlyMap<string, readonly IndexHit[]>,
];

/** One of the thirty Aethyrs' names, for Key 19's slot. */
export interface AethyrName {
  n: number;
  dee: string;
  gd: string;
  folded: readonly string[];
  /** "first" to "thirtieth". */
  ordinal: string;
}

/** The index (see the module's comment). */
export interface Lookup {
  rows: readonly Row[];
  /** Each Key's rows, by Key number, row 1 at index 0. */
  keyRows: ReadonlyMap<number, readonly Row[]>;
  /** Casaubon's words, folded, to their rows. */
  keyForms: ReadonlyMap<string, readonly Row[]>;
  /** Crowley's forms folded whole, to their rows. */
  gdForms: ReadonlyMap<string, readonly Row[]>;
  /** Dictionary words, folded. */
  dictionary: ReadonlyMap<string, DictionaryWord>;
  /**
   * The tiers by each word as written (`literal`), and with irregular
   * verbs read plain (`plain`), which a lookup tries second.
   */
  tiers: { literal: Tiers; plain: Tiers };
  /** A folded form as shown: Casaubon's commonest spelling, or the headword. */
  display: ReadonlyMap<string, string>;
  /** Leitch's spellings, folded, to their entries. */
  leitch: ReadonlyMap<string, readonly LeitchSpelling[]>;
  aethyrs: readonly AethyrName[];
  /**
   * Words that count as English for the direction guess, by their key
   * (`wordKey`); see `isEnglishWord`.
   */
  englishVocabulary: ReadonlyMap<string, readonly string[]>;
  /**
   * Words our English writes as an infinitive ("to reign"): verbs, for an
   * "-est" read as a verb's second person (G16).
   */
  infinitives: ReadonlySet<string>;
  /** Folded words that count as Enochian for it. */
  enochianWords: ReadonlySet<string>;
  /** `search.ts`'s index, for a gap's nearest forms (decision 12). */
  search: DictionaryIndex;
  source: LookupDictionary;
  /** `unhyphenated(source)`, for `findParts`. */
  stripped: Map<string, string>;
}

const MARKERS: Readonly<Record<string, GdMarker>> = {
  j: "joined",
  o: "overlap",
  a: "absent",
  s: "split",
};

/**
 * A word folded for lookup: accents off, then `foldSpelling`; "" for a
 * word with letters outside the Latin alphabet ("שלום", "straße"), which
 * no source spells.
 */
export function fold(word: string): string {
  const plain = deaccent(word);
  return /[^\P{L}A-Za-z]/u.test(plain) ? "" : foldSpelling(plain);
}

const ORDINAL_UNITS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
];

/** "first" to "thirtieth", as `magick-data`'s `AETHYR_ORDINALS`. */
const ORDINALS = [
  ...ORDINAL_UNITS,
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
  "seventeenth",
  "eighteenth",
  "nineteenth",
  "twentieth",
  ...ORDINAL_UNITS.map((unit) => `twenty-${unit}`),
  "thirtieth",
];

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** The rows of the table, with Key 1 and 11–18's formula marked (G40). */
function readRows(table: KeysTable): Row[] {
  const rows: Row[] = [];
  for (const { key, rows: cells } of table.keys) {
    const folded = cells.map(([word]) => foldSpelling(word));
    // The formula runs from ZACAR "move" to the end: row 75 on Key 1, the
    // last ZACAR on Keys 11 to 18.
    let formulaFrom = Number.POSITIVE_INFINITY;
    const zacar = folded.lastIndexOf("ZACAR");
    if (key === 1) formulaFrom = 75;
    // A Key without its ZACAR (a damaged print) has no formula to mark.
    else if (key >= 11 && key <= 18 && zacar >= 0) formulaFrom = zacar + 1;
    cells.forEach(([word, gd, english, flags = ""], index) => {
      const row = index + 1;
      const marker = [...flags].map((one) => MARKERS[one]).find(Boolean);
      const text = english.replaceAll("{ordinal}", ORDINALS[0]);
      rows.push({
        id: `${key}.${row}`,
        key,
        row,
        word,
        folded: folded[index],
        gd,
        gdFolded: fold(gd),
        gdParts: enochianWords(gd).map(fold).filter(Boolean),
        english: text,
        split: flags.includes("e"),
        ...(marker ? { marker } : {}),
        aethyrSlot: flags.includes("A"),
        ...(row >= formulaFrom
          ? { formula: key === 1 ? "first" : "repeat" }
          : {}),
        core: coreKeys(englishWords(text)),
        words: coreWords(englishWords(text)),
      } as Row);
    });
  }
  return rows;
}

/** Adds a gloss to one set of tiers (decision 7). */
function addGloss(
  tiers: Map<string, IndexHit[]>[],
  gloss: string,
  form: string,
  origin: Origin,
  literal: boolean,
) {
  const words = coreWords(englishWords(gloss));
  if (!words.length) return;
  const core = coreKeys(words, literal);
  push(tiers[0], core.join(" "), { form, origin, words });
  const bare = withoutLeadingOfTo(words);
  if (bare.length && bare.length !== words.length)
    push(tiers[1], coreKeys(bare, literal).join(" "), {
      form,
      origin,
      words: bare,
    });
  if (words.length < 2) return;
  words.forEach((word, at) => {
    if (!PREPOSITIONS.has(word)) return;
    const rest = [...words.slice(0, at), ...words.slice(at + 1)];
    push(tiers[2], coreKeys(rest, literal).join(" "), {
      form,
      origin,
      preposition: word,
      words: rest,
    });
  });
}

/**
 * Whether a word counts as English for the direction guess: the same
 * word as one in Dee's English, a gloss, or the grammar tables
 * (`sameWord`), so "mad" is not English through "made".
 */
export function isEnglishWord(lookup: Lookup, word: string): boolean {
  return (lookup.englishVocabulary.get(wordKey(word)) ?? []).some((one) =>
    sameWord(word, one),
  );
}

/** The dictionary as `search.ts` takes it, from meanings alone. */
function asEntries(source: LookupDictionary): EnochianDictionary {
  return Object.fromEntries(
    Object.entries(source).map(([headword, entry]) => [
      headword,
      {
        gematria: [],
        pronounciations: [],
        meanings: entry.meanings.map(({ meaning, source: work }) => ({
          meaning,
          source: work,
        })),
      },
    ]),
  );
}

/** Builds the index (see the module's comment). */
export function buildLookup(
  table: KeysTable,
  source: LookupDictionary,
): Lookup {
  const rows = readRows(table);
  const keyRows = new Map<number, Row[]>();
  const keyForms = new Map<string, Row[]>();
  const gdForms = new Map<string, Row[]>();
  for (const row of rows) {
    push(keyRows, row.key, row);
    if (row.folded) push(keyForms, row.folded, row);
    if (row.gdFolded) push(gdForms, row.gdFolded, row);
  }

  const dictionary = new Map<
    string,
    { headwords: string[]; meanings: DictionaryWord["meanings"][number][] }
  >();
  for (const [headword, entry] of Object.entries(source)) {
    // A trailing hyphen marks an affix, which no word should resolve to.
    if (headword.endsWith("-")) continue;
    const folded = foldSpelling(headword);
    if (!folded) continue;
    let word = dictionary.get(folded);
    if (!word) {
      word = { headwords: [], meanings: [] };
      dictionary.set(folded, word);
    }
    word.headwords.push(headword);
    for (const { meaning, source: work } of entry.meanings)
      word.meanings.push({ meaning, source: work, headword });
  }

  const literal = [0, 1, 2].map(() => new Map<string, IndexHit[]>());
  const plain = [0, 1, 2].map(() => new Map<string, IndexHit[]>());
  const add = (gloss: string, form: string, origin: Origin) => {
    addGloss(literal, gloss, form, origin, true);
    addGloss(plain, gloss, form, origin, false);
  };
  for (const row of rows)
    if (row.folded && row.english)
      add(row.english, row.folded, { kind: "key", row });
  for (const [folded, word] of dictionary)
    for (const { meaning, source: work, headword } of word.meanings)
      for (const gloss of lookupGlosses(meaning))
        add(gloss, folded, {
          kind: "dictionary",
          headword,
          source: work,
          meaning,
          gloss,
        });

  const display = new Map<string, string>();
  for (const [folded, its] of keyForms) {
    const counts = new Map<string, number>();
    for (const { word } of its) counts.set(word, (counts.get(word) ?? 0) + 1);
    // The commonest spelling; the first written on a tie.
    let best = its[0].word;
    for (const [word, count] of counts)
      if (count > (counts.get(best) ?? 0)) best = word;
    display.set(folded, best);
  }
  for (const [folded, word] of dictionary)
    if (!display.has(folded)) display.set(folded, word.headwords[0]);

  const leitch = new Map<string, LeitchSpelling[]>();
  for (const one of LEITCH_SPELLINGS) push(leitch, fold(one.word), one);

  const aethyrs = table.aethyrs.map(([dee, gd], index) => ({
    n: index + 1,
    dee,
    gd,
    folded: [...new Set([fold(dee), fold(gd)].filter(Boolean))],
    ordinal: ORDINALS[index] ?? "",
  }));

  const englishVocabulary = new Map<string, string[]>();
  const addEnglish = (word: string) => {
    const key = wordKey(word);
    const list = englishVocabulary.get(key);
    if (!list) englishVocabulary.set(key, [word]);
    else if (!list.includes(word)) list.push(word);
  };
  for (const row of rows)
    for (const word of englishWords(row.english)) addEnglish(word);
  // An Enochian word a gloss names ("Root of OHIO", "I give Ga") is a
  // reference, not English: it counts only where some gloss writes it in
  // lower case, as English ("fire").
  const glosses = [...dictionary.values()].flatMap((word) =>
    word.meanings.flatMap(({ meaning }) => lookupGlosses(meaning)),
  );
  const lowerCase = new Set(
    glosses.flatMap((gloss) =>
      englishWords(
        (gloss.match(/[\p{L}\p{N}']+/gu) ?? ([] as string[]))
          .filter((one) => one === one.toLowerCase())
          .join(" "),
      ),
    ),
  );
  const enochianForm = (word: string) =>
    keyForms.has(fold(word)) || dictionary.has(fold(word));
  for (const gloss of glosses) {
    if (gloss.includes("'") || /\b(?:var|letter)\b/i.test(gloss)) continue;
    for (const one of englishWords(gloss))
      if (
        (one.length > 1 || "aio".includes(one)) &&
        (lowerCase.has(one) || !enochianForm(one))
      )
        addEnglish(one);
  }
  const infinitives = new Set<string>();
  for (const text of [...rows.map((row) => row.english), ...glosses]) {
    const words = englishWords(text);
    words.forEach((word, at) => {
      const next = words[at + 1];
      if (word === "to" && next && !ARTICLES.has(next) && !PRONOUNS.has(next))
        infinitives.add(next);
    });
  }
  for (const set of [
    ARTICLES,
    PREPOSITIONS,
    BE,
    NEGATION,
    PRONOUNS,
    AUXILIARIES,
    new Set(Object.keys(IRREGULAR)),
    new Set(["and", "or", "but", "if", "so", "yes", "what", "who"]),
  ])
    for (const word of set) addEnglish(word);

  const enochian = new Set<string>([
    ...keyForms.keys(),
    ...gdForms.keys(),
    ...dictionary.keys(),
    ...leitch.keys(),
  ]);
  for (const row of rows) for (const part of row.gdParts) enochian.add(part);

  const uses: Record<string, number> = {};
  for (const [folded, word] of dictionary)
    uses[word.headwords[0]] = keyForms.get(folded)?.length ?? 0;

  return {
    rows,
    keyRows,
    keyForms,
    gdForms,
    dictionary,
    tiers: {
      literal: literal as unknown as Tiers,
      plain: plain as unknown as Tiers,
    },
    display,
    leitch,
    aethyrs,
    englishVocabulary,
    infinitives,
    enochianWords: enochian,
    // `search.ts` types its index on full entries but reads only meanings.
    search: buildIndex(asEntries(source), uses),
    source,
    stripped: unhyphenated(source),
  };
}
