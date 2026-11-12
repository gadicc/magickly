import type {
  EnochianDictionary,
  EnochianEntry,
} from "magick-data/enochian/dictionary";
import type { EnochianKey } from "magick-data/enochian/keys";
import {
  editDistance,
  englishWords,
  FUNCTION_WORDS,
  foldVariants,
  isFunctionOnly,
  meaningAgrees,
  normEnochian,
  sharesContentWord,
  stemEnglish,
} from "./normalise.ts";
import { englishKey } from "./score.ts";
import { isScoreable, type KeyRowRecord, type SourceData } from "./testset.ts";

/**
 * The new text of plan 077 ("The new text"): sentences joined from passages
 * of two Keys, with some rows swapped, planted or joined, so that no model
 * can have seen it. Built by script from our own data and a seed, written to
 * `data/newtext.json` and committed.
 *
 * Every function takes the data as arguments, so tests can pass a few rows;
 * `cli.ts` passes the package's.
 */

/** What a row of the new text is (plan 077's table). */
export type RowKind = "unchanged" | "swapped" | "plant" | "known" | "join";

export const ROW_KINDS: readonly RowKind[] = [
  "unchanged",
  "swapped",
  "plant",
  "known",
  "join",
];

/** One row of the new text, as the runner sends it and the scorer reads it. */
export interface NewTextRow {
  /** "S03.07": the sentence and the row in it, from 1. */
  id: string;
  /** "S03". */
  sentence: string;
  kind: RowKind;
  /** The Key row ("K.R") this row stands in: its place in Dee's text. */
  at: string;
  /**
   * The Key row the word and its English come from: `at` for unchanged and
   * join rows, the swapped-in row for swapped ones; none for made-up words.
   */
  source?: string;
  /** Task 1's input: the Enochian shown. */
  enochian: string;
  /**
   * Task 2's input: the English shown. Also task 1's key, except on a plant,
   * whose key is "unknown".
   */
  english: string;
  /**
   * The forms task 2 takes as right, as printed: Casaubon's word and the
   * GD's; for a join, the joined and the separate forms; none for a plant.
   */
  forms: string[];
  /** Shown in the Golden Dawn's spelling (The Equinox I(8)). */
  gdSpelling?: true;
  /**
   * Swapped: every gloss Dee gives the swapped-in word, any of which counts
   * as right in task 1.
   */
  glosses?: string[];
  /** Swapped: the swapped-in word occurs on more than one Key row. */
  multi?: true;
  /**
   * Swapped: the word that stood here, and every gloss of it (its rows' and
   * its dictionary entries'), for task 1's "recalled".
   */
  replaced?: { word: string; english: string; glosses: string[] };
  /** Join: its parts, and the small word's senses that render it. */
  join?: { small: string; word: string; senses: string[]; english: string };
}

export interface NewTextSentence {
  id: string;
  /** The two passages, as "K.R–K.R", in the order shown. */
  passages: string[];
  rows: NewTextRow[];
}

/** A made-up word given a meaning in the prompt's dictionary. */
export interface PlantedKnown {
  headword: string;
  meaning: string;
  /** The source tag the prompt shows, as for an ordinary entry. */
  source: string;
}

/** Counts of the Leitch check, made once from a private file (see cli.ts). */
export interface LeitchCounts {
  /** SHA-256 of the lexicon file read. */
  lexiconSha256: string;
  /** Distinct Leitch forms compared, normalised. */
  forms: number;
  groups: Record<
    "plants" | "knowns" | "joins",
    {
      words: number;
      exact: number;
      withinOne: number;
      withinTwo: number;
      foldedWithinOne: number;
      /** Holds a Leitch form of three letters or more. */
      containsForm: number;
    }
  >;
}

export interface NewTextSet {
  about: string;
  seed: number;
  sentences: NewTextSentence[];
  /** Interleaved into the prompt's dictionary by `withPlantedKnowns`. */
  plantedKnowns: PlantedKnown[];
  /** The rows of Opus's repeat runs: whole sentences, fixed by the seed. */
  repeat: { sentences: string[]; rows: number };
  /** How many candidates each rule left, and what the set holds. */
  meta: Record<string, unknown> & { leitch: LeitchCounts | null };
}

// --- Randomness ---------------------------------------------------------------

/** Mulberry32: a small seeded generator, uniform on [0, 1). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pick = <T>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length)];

// --- The shape of Dee's English -------------------------------------------------

/**
 * Dee's English words that aren't nouns, by class; every other content word
 * is taken as a noun. Covers the content words of the Keys' English, as
 * `englishWords` folds them; -ed, -eth and -ing words are classed by their
 * ending (`wordClass`). `?` marks words read either way ("rest", "reign"):
 * a row holding one is never swapped or planted.
 */
const WORD_CLASSES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries({
    V:
      "add appear apply arise behold bind bring burn come conclude confound " +
      "conquer descend destroy differ diminish dispose dwell execute flew " +
      "flourish forget gather gave gird govern hearken know laid lift live " +
      "make made move obey prepare remain run said say see serve show sing " +
      "sink spake stir stretch swore talked understand vex visit vomit wax " +
      "became become",
    Ved: "fallen given known spoken sworn",
    A:
      "barren bright continual drunken empty equal fierce fiery flaming " +
      "friendly great greater happy highest holy long loud lower mightier " +
      "mighty pleasant powerful reasonable rich righteous rotten same sharp " +
      "strange strong stronger true unspeakable wicked all any every own such",
    D:
      "about above according also always amongst away because before down " +
      "even ever except forth here how moreover neither out over still " +
      "successively there therefore through thus together under underneath " +
      "until up wherefore wherein while why yet continually like none",
    NUM:
      "one two six eight nine nineteen twenty hundred thousand first second " +
      "third fourth",
    P: "self selves themselves another",
    N:
      "bed beginning beginnings building buildings dwelling dwellings " +
      "understanding wedding furnishing",
    "?":
      "cast end ends fall rest range reign set rise roar sleep open separate " +
      "rose praise praises work works comfort place promise guard fold frown " +
      "sound sounds",
  }).flatMap(([tag, list]) => list.split(" ").map((word) => [word, tag])),
);

/** A content word's class: N, V, Ved, ING, A, D, NUM, P or `?`. */
export function wordClass(word: string): string {
  const listed = WORD_CLASSES[word];
  if (listed) return listed;
  if (/^\d+(?:st|nd|rd|th)?$/.test(word)) return "NUM";
  if (word.length > 4 && word.endsWith("ing")) return "ING";
  if (word.length > 4 && word.endsWith("eth")) return "V";
  if (word.length > 4 && word.endsWith("ed")) return "Ved";
  return "N";
}

/**
 * A row's shape: its English as words, function words kept as they are and
 * content words replaced by their class ("the N", "of the A N", "V"). Rows
 * swap only with rows of the same shape: a noun phrase for a noun phrase, a
 * verb for a verb.
 */
export function englishShape(english: string): string {
  let shape = shapes.get(english);
  if (shape === undefined) {
    shape = englishWords(english)
      .map((word) => (FUNCTION_WORDS.has(word) ? word : wordClass(word)))
      .join(" ");
    shapes.set(english, shape);
  }
  return shape;
}

const shapes = new Map<string, string>();

const contentClasses = (english: string) =>
  englishWords(english)
    .filter((word) => !FUNCTION_WORDS.has(word))
    .map(wordClass);

/**
 * Whether a row may be swapped (either way): it has content words, none read
 * either way, and not only adverbs and pronouns ("moreover", "your selves").
 */
export function swappableShape(english: string): boolean {
  if (isFunctionOnly(english)) return false;
  const classes = contentClasses(english);
  return (
    classes.length > 0 &&
    !classes.includes("?") &&
    classes.some((one) => one !== "D" && one !== "P")
  );
}

/**
 * Whether a planted word can take a row's place: its English has exactly
 * one content word, a noun, so the plant's English noun can stand there
 * ("the horns" → "the kettle").
 */
export function plantableShape(english: string): boolean {
  const classes = contentClasses(english);
  return classes.length === 1 && classes[0] === "N";
}

/** A row's English with its one content word replaced, keeping its case. */
export function withNoun(english: string, noun: string): string {
  const out = english.replace(/[A-Za-z0-9’']+/g, (token) => {
    const [word] = englishWords(token);
    if (!word || FUNCTION_WORDS.has(word)) return token;
    return /^[A-Z]/.test(token) ? noun[0].toUpperCase() + noun.slice(1) : noun;
  });
  // "a" or "an" as the noun now begins.
  const article = /^[aeiou]/i.test(noun) ? "an" : "a";
  return out.replace(
    new RegExp(`\\b(an?)(\\s+${noun}\\b)`, "i"),
    (_, was: string, rest: string) =>
      (/^A/.test(was) ? article[0].toUpperCase() + article.slice(1) : article) +
      rest,
  );
}

// --- Forms, splits and the planted words' rule -----------------------------------

/**
 * G26's small words ("small words join the next word"), each with the senses
 * that render it in a join and the gloss its key gives. DS's senses follow
 * G23 ("which, that"), not G24's disputed "and".
 */
export const SMALL_WORDS: Readonly<
  Record<string, { gloss: string; senses: readonly string[] }>
> = {
  DS: { gloss: "which", senses: ["which", "that"] },
  I: { gloss: "is", senses: ["is"] },
  CHIS: { gloss: "are", senses: ["are"] },
  TA: { gloss: "as", senses: ["as"] },
  L: { gloss: "one", senses: ["one", "first"] },
  AR: { gloss: "that", senses: ["that"] },
  OI: { gloss: "this", senses: ["this"] },
  AG: { gloss: "no", senses: ["no", "none", "not"] },
};

/**
 * Every form in our data, normalised: dictionary headwords, Casaubon's words
 * and the GD's forms, each whole and, where written in parts ("A-C-LONDOH",
 * "iala pire gahe"), part by part.
 */
export function formsOf(data: SourceData): Set<string> {
  const out = new Set<string>();
  const add = (text: string | undefined) => {
    if (!text) return;
    for (const one of [text, ...text.split(/[^A-Za-z]+/)]) {
      const norm = normEnochian(one);
      if (norm) out.add(norm);
    }
  };
  for (const headword of Object.keys(data.dictionary)) add(headword);
  for (const row of data.rows) {
    add(row.word);
    add(row.gd);
  }
  return out;
}

/**
 * The parts a word may split into: attested forms of two letters or more and
 * G26's small words ("I", "L" among them).
 */
export function splitParts(forms: ReadonlySet<string>): Set<string> {
  return new Set([
    ...[...forms].filter((one) => one.length >= 2),
    ...Object.keys(SMALL_WORDS),
  ]);
}

/**
 * The number of ways (up to `cap`) a word splits wholly into parts, each
 * part following the last either directly or sharing its last letter (G27,
 * "a shared letter is written once": DS + SONF is DSONF).
 */
export function splitCount(
  word: string,
  parts: ReadonlySet<string>,
  cap = 10,
): number {
  const memo = new Map<number, number>();
  const from = (i: number): number => {
    if (i === word.length) return 1;
    const known = memo.get(i);
    if (known !== undefined) return known;
    let n = 0;
    for (const start of i > 0 ? [i, i - 1] : [i])
      for (let end = i + 1; end <= word.length && n < cap; end++)
        if (parts.has(word.slice(start, end))) n += from(end);
    memo.set(i, Math.min(n, cap));
    return Math.min(n, cap);
  };
  return from(0);
}

/** Whether two words are at most one edit apart, without a table. */
function oneEditApart(a: string, b: string): boolean {
  if (a.length > b.length) return oneEditApart(b, a);
  if (b.length - a.length > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.slice(i) === b.slice(i + 1);
}

/**
 * A form fewer than `limit` letters from a word (edit distance), if any:
 * `limit` 2 is "within one letter", 3 "within two".
 */
function within(
  word: string,
  forms: Iterable<string>,
  limit: number,
): string | undefined {
  for (const form of forms) {
    if (Math.abs(form.length - word.length) >= limit) continue;
    if (
      limit <= 2 ? oneEditApart(form, word) : editDistance(form, word) < limit
    )
      return form;
  }
  return undefined;
}

/** Which of the planted words' rules a word breaks, if any. */
export type PlantRule =
  | "near"
  | "contains"
  | "splits"
  | "folded"
  | "english"
  | "taken";

/** What the planted words' rule compares a candidate with. */
export interface PlantContext {
  forms: ReadonlySet<string>;
  /** `forms` folded wide (C/K, I/Y, U/V/W). */
  folded: ReadonlySet<string>;
  parts: ReadonlySet<string>;
  /** Every English word of our data, lower case: a plant isn't one. */
  english: ReadonlySet<string>;
}

export function plantContext(data: SourceData): PlantContext {
  const forms = formsOf(data);
  const english = new Set<string>();
  for (const row of data.rows)
    for (const word of englishWords(row.english)) english.add(word);
  for (const entry of Object.values(data.dictionary))
    for (const { meaning } of entry.meanings)
      for (const word of englishWords(meaning)) english.add(word);
  return {
    forms,
    folded: new Set([...forms].map(foldVariants)),
    parts: splitParts(forms),
    english,
  };
}

/**
 * The strict rule for a made-up word (plan 077, "Planted unknowns"), checked
 * in order, against our forms and the made-up words already `taken`:
 * - `near`: within two letters of a form;
 * - `contains`: holds a form of three letters or more;
 * - `splits`: splits wholly into forms of two letters or more and G26's
 *   small words (G27's shared letters allowed);
 * - `folded`: within one letter of a form once C/K, I/Y and U/V/W are one;
 * - `english`: is an English word of our data (our addition);
 * - `taken`: within two letters (or one, folded) of a made-up word taken.
 */
export function plantRule(
  word: string,
  context: PlantContext,
  taken: readonly string[] = [],
): PlantRule | undefined {
  if (within(word, context.forms, 3)) return "near";
  for (let start = 0; start < word.length; start++)
    for (let end = start + 3; end <= word.length; end++)
      if (context.forms.has(word.slice(start, end))) return "contains";
  if (splitCount(word, context.parts, 1) > 0) return "splits";
  const folded = foldVariants(word);
  if (within(folded, context.folded, 2)) return "folded";
  if (context.english.has(word.toLowerCase())) return "english";
  if (
    within(word, taken, 3) ||
    within(
      folded,
      taken.map((one) => foldVariants(one)),
      2,
    )
  )
    return "taken";
  return undefined;
}

/**
 * Made-up words of four to eight letters from the letter pairs of Casaubon's
 * words: each letter follows the last as often as it does in the Keys.
 */
export function letterChain(rows: readonly KeyRowRecord[]) {
  const next = new Map<string, string[]>();
  const words = new Set(
    rows.map((row) => normEnochian(row.word ?? "")).filter(Boolean),
  );
  for (const word of [...words].sort()) {
    const text = `^${word}$`;
    for (let i = 0; i < text.length - 1; i++)
      next.set(text[i], [...(next.get(text[i]) ?? []), text[i + 1]]);
  }
  return (random: () => number): string => {
    for (;;) {
      let word = "";
      let letter = "^";
      while (word.length <= 8) {
        letter = pick(next.get(letter) ?? ["$"], random);
        if (letter === "$") break;
        word += letter;
      }
      if (word.length >= 4 && word.length <= 8) return word;
    }
  };
}

// --- English that nothing translates ---------------------------------------------

/**
 * Candidate English nouns for the task-2 plants: everyday ones, and some in
 * the Keys' register (the planted knowns have `KNOWN_CANDIDATES`). The generator
 * keeps those nothing in our data translates (`untranslated`); "lantern" and
 * "harvest" are here to show the check works.
 */
export const ENGLISH_CANDIDATES = {
  everyday:
    "bicycle kettle umbrella pencil ticket button carpet pocket basket " +
    "bottle spoon blanket pillow bucket wallet sandwich potato tomato " +
    "coffee sugar butter cheese rabbit pigeon kitten puppy village market " +
    "school street engine hammer cupboard saucer teapot napkin postman " +
    "railway parcel envelope clock newspaper biscuit carrot onion cabbage " +
    "apron slipper chimney garage helmet jacket mattress toothbrush " +
    "doorbell bakery",
  register:
    "lantern harvest anvil chalice furnace beacon orchard meadow falcon " +
    "cedar cypress frost ember spear shield banner trumpet harp lyre scroll " +
    "anchor ship sail oar fountain cistern vineyard sheaf plough loom " +
    "spindle needle mirror bell drum feather egg honey milk bread barley " +
    "wheat acorn willow ivy lily thistle moth spider bee wolf stag hare fox " +
    "owl raven swan whale dew pearl ivory parchment quill candle incense " +
    "censer goblet veil mantle cloak sandal dagger arrow quiver chariot " +
    "horse lion goat sheep serpent snow hail river valley island desert " +
    "forest cliff shore tide pebble sand",
} as const;

/**
 * Candidate meanings for the planted knowns: ordinary nouns in the Keys'
 * register and older English, by kind, none in `ENGLISH_CANDIDATES` (so none
 * can be a task-2 plant's English). A modern word ("doorbell") would stand out
 * in an Enochian dictionary and tell a model it is being tested. The
 * generator keeps those nothing in our data translates (`untranslated`) and
 * takes the same number of each kind.
 */
export const KNOWN_CANDIDATES = {
  vessel:
    "ewer flagon pitcher basin cauldron urn phial tankard beaker crock " +
    "platter trencher bowl",
  garment:
    "tunic girdle kirtle doublet cowl hood surcoat jerkin smock gown sash " +
    "glove bonnet",
  tool:
    "sickle scythe awl chisel mallet auger adze trowel shears flail " +
    "distaff bellows pestle tongs whetstone ladle",
  plant:
    "hyssop fennel tansy yarrow bramble nettle reed flax hemlock mallow " +
    "sorrel myrtle laurel hazel rowan juniper heather",
  building:
    "lintel threshold rafter gable hearth casement buttress doorpost latch " +
    "hinge porch cellar turret",
} as const;

/**
 * The planted knowns' meanings: from each kind of `KNOWN_CANDIDATES`, those
 * nothing in our data translates, shuffled, the same number of each (the
 * first kinds one more where `count` doesn't divide), then shuffled together.
 * Uses its own generator, so the rest of the set is what the seed made before
 * these meanings were chosen this way.
 */
export function knownMeanings(
  count: number,
  stems: ReadonlySet<string>,
  random: () => number,
): string[] {
  const kinds = Object.values(KNOWN_CANDIDATES).map((list) =>
    shuffle(untranslated(list.split(" "), stems), random),
  );
  const out: string[] = [];
  kinds.forEach((list, i) => {
    const want =
      Math.floor(count / kinds.length) + (i < count % kinds.length ? 1 : 0);
    if (list.length < want)
      throw new Error(
        `known meanings: ${list.length} candidates of a kind for ${want} wanted`,
      );
    out.push(...list.slice(0, want));
  });
  return shuffle(out, random);
}

/** The planted knowns' generator: the set's seed, apart from its own. */
export const KNOWN_MEANINGS_SALT = 0x6b6e6f77;

/**
 * The stems of every content word our data uses for English: each
 * dictionary meaning and Dee's English on every row.
 */
export function englishStems(data: SourceData): Set<string> {
  const out = new Set<string>();
  const add = (text: string) => {
    for (const word of englishWords(text)) out.add(stemEnglish(word));
  };
  for (const row of data.rows) add(row.english);
  for (const entry of Object.values(data.dictionary))
    for (const { meaning } of entry.meanings) add(meaning);
  return out;
}

/** The candidates nothing in our data translates, in the order given. */
export function untranslated(
  candidates: readonly string[],
  stems: ReadonlySet<string>,
): string[] {
  return candidates.filter((word) => !stems.has(stemEnglish(word)));
}

// --- Swaps ------------------------------------------------------------------------

/** What the swap rules know of a word (normalised Casaubon spelling). */
export interface WordInfo {
  word: string;
  rows: KeyRowRecord[];
  /** Dee's English on each of its rows. */
  glosses: string[];
  /** Its dictionary entries' meanings (normalised headword). */
  meanings: string[];
  /** Every gloss Dee gives it agrees with every other (rule 1). */
  glossesAgree: boolean;
  /** No entry, or a meaning agrees with each of Dee's glosses (rule 3). */
  dictionaryAgrees: boolean;
}

/** Each scoreable word's glosses and meanings. */
export function wordInfo(data: SourceData): Map<string, WordInfo> {
  const meanings = new Map<string, string[]>();
  for (const [headword, entry] of Object.entries(data.dictionary)) {
    const norm = normEnochian(headword);
    meanings.set(norm, [
      ...(meanings.get(norm) ?? []),
      ...entry.meanings.map((one) => one.meaning),
    ]);
  }
  const rows = new Map<string, KeyRowRecord[]>();
  for (const row of data.rows.filter(isScoreable)) {
    const word = normEnochian(row.word);
    rows.set(word, [...(rows.get(word) ?? []), row]);
  }
  const out = new Map<string, WordInfo>();
  for (const [word, its] of rows) {
    const glosses = its.map((row) => row.english);
    const senses = meanings.get(word) ?? [];
    out.set(word, {
      word,
      rows: its,
      glosses,
      meanings: senses,
      glossesAgree: glosses.every((a) =>
        glosses.every((b) => meaningAgrees(a, b)),
      ),
      dictionaryAgrees:
        !meanings.has(word) ||
        glosses.every((gloss) =>
          senses.some((sense) => meaningAgrees(gloss, sense)),
        ),
    });
  }
  return out;
}

/**
 * Each English (as `englishKey` folds it) with the Casaubon words the Keys
 * give it, for rule 2: a swapped-in word's English maps to that one form.
 */
export function formsByEnglish(
  rows: readonly KeyRowRecord[],
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const row of rows.filter(isScoreable)) {
    const key = englishKey(row.english);
    out.set(key, (out.get(key) ?? new Set()).add(normEnochian(row.word)));
  }
  return out;
}

/**
 * Whether a row's word may be swapped in (plan 077, "Swaps"), by the first
 * three rules: Dee's glosses agree; its English maps to that one form in the
 * Keys; the dictionary agrees with Dee. The shape and the fourth rule depend
 * on the row it replaces (`swapFits`).
 */
export function swapSource(
  row: KeyRowRecord,
  info: ReadonlyMap<string, WordInfo>,
  byEnglish: ReadonlyMap<string, ReadonlySet<string>>,
): "glosses" | "english" | "dictionary" | undefined {
  const word = info.get(normEnochian(row.word ?? ""));
  if (!word) return "glosses";
  if (!word.glossesAgree) return "glosses";
  if ((byEnglish.get(englishKey(row.english))?.size ?? 0) !== 1)
    return "english";
  if (!word.dictionaryAgrees) return "dictionary";
  return undefined;
}

/**
 * Whether a word can replace a row: the same shape, another Key, another
 * word, and no sense of it (Dee's glosses, its meanings) shares a content
 * word, stemmed, with any sense of the word it replaces (that row's English,
 * the word's other glosses and its meanings).
 */
export function swapFits(
  replaced: KeyRowRecord,
  source: KeyRowRecord,
  info: ReadonlyMap<string, WordInfo>,
): boolean {
  if (replaced.key === source.key) return false;
  const word = normEnochian(source.word ?? "");
  if (!word || word === normEnochian(replaced.word ?? "")) return false;
  if (englishShape(replaced.english) !== englishShape(source.english))
    return false;
  const its = info.get(word);
  const senses = [
    ...(its?.glosses ?? [source.english]),
    ...(its?.meanings ?? []),
  ];
  // Against every sense of the word it replaces, as task 1's "recalled"
  // reads them (`rowOf`'s `replaced.glosses`), not only this row's English:
  // else a recalled answer could share a word with the swapped-in key.
  const gone = info.get(normEnochian(replaced.word ?? ""));
  const replacedSenses = [
    replaced.english,
    ...(gone?.glosses ?? []),
    ...(gone?.meanings ?? []),
  ];
  return !senses.some((sense) =>
    replacedSenses.some((one) => sharesContentWord(sense, one)),
  );
}

// --- Joins ------------------------------------------------------------------------

/** A small word joined to a word, G27's shared letter written once. */
export function joinForm(small: string, word: string): string {
  return small.at(-1) === word[0] ? small + word.slice(1) : small + word;
}

/** Why a join can't be used, if it can't. */
export type JoinRule =
  | "attested"
  | "adjacent"
  | "splits"
  | "near"
  | "english"
  | "sense";

export interface JoinContext {
  forms: ReadonlySet<string>;
  parts: ReadonlySet<string>;
  /** "SMALL WORD" pairs the Keys print as neighbouring rows. */
  adjacent: ReadonlySet<string>;
  /** Every Key row's English, as `englishKey` folds it. */
  english: ReadonlySet<string>;
}

export function joinContext(data: SourceData): JoinContext {
  const forms = formsOf(data);
  const adjacent = new Set<string>();
  data.rows.forEach((row, i) => {
    const next = data.rows[i + 1];
    if (next && next.key === row.key && row.word && next.word)
      adjacent.add(`${normEnochian(row.word)} ${normEnochian(next.word)}`);
  });
  return {
    forms,
    parts: splitParts(forms),
    adjacent,
    english: new Set(data.rows.map((row) => englishKey(row.english))),
  };
}

/**
 * The rules for a new join (plan 077, "Context-only rows"), in order:
 * - `attested`: the joined form is a form in our data;
 * - `adjacent`: the Keys print the two words as neighbours (our addition:
 *   "a word that never takes it in the Keys");
 * - `splits`: it splits into attested parts in more than one way (or none);
 * - `near`: some form is within one letter of it;
 * - `english`: its English is some Key row's English, so task 2 would have
 *   another right answer (our addition, as swaps' second rule);
 * - `sense`: the word's English already holds a sense of the small word.
 * `english` is the row's own English, Dee's, for the last two.
 */
export function joinRule(
  small: string,
  word: string,
  english: string | undefined,
  context: JoinContext,
): JoinRule | undefined {
  const joined = joinForm(small, word);
  if (context.forms.has(joined)) return "attested";
  if (context.adjacent.has(`${small} ${word}`)) return "adjacent";
  if (splitCount(joined, context.parts, 2) !== 1) return "splits";
  if (within(joined, context.forms, 2)) return "near";
  if (english === undefined) return undefined;
  const { gloss, senses } = SMALL_WORDS[small];
  if (context.english.has(englishKey(`${gloss} ${english}`))) return "english";
  if (englishWords(english).some((one) => senses.includes(one))) return "sense";
  return undefined;
}

/** A join's right forms in task 2: joined, or the parts written apart. */
export function joinForms(small: string, row: KeyRowRecord): string[] {
  const out = new Set<string>();
  for (const form of [row.word, row.gd]) {
    if (!form) continue;
    const norm = normEnochian(form);
    out.add(joinForm(small, norm));
    out.add(small + norm);
  }
  return [...out];
}

// --- Passages ---------------------------------------------------------------------

/** A run of consecutive rows of one Key. */
export interface Passage {
  key: number;
  rows: KeyRowRecord[];
}

const STOP = /[;:.?]\s*$/;

/**
 * Candidate passages (plan 077): each Key's scoreable rows, broken wherever a
 * row is unscoreable or excluded, cut into clauses after Dee's stops. A
 * clause under three rows joins the next; each clause is then cut, from its
 * end, into runs of eight, so its last run ends at the stop. What is left
 * under three rows at the front is not used. `clauses` counts the clauses
 * before joining. The generator trims passages to the rows it wants.
 */
export function passages(
  rows: readonly KeyRowRecord[],
  exclude: ReadonlySet<string>,
): { clauses: number; passages: Passage[] } {
  const runs: KeyRowRecord[][] = [];
  let run: KeyRowRecord[] = [];
  for (const row of rows) {
    const usable = isScoreable(row) && !exclude.has(row.id);
    if (!usable || (run.length && run[0].key !== row.key)) {
      if (run.length) runs.push(run);
      run = [];
    }
    if (usable) run.push(row);
  }
  if (run.length) runs.push(run);
  let clauses = 0;
  const out: Passage[] = [];
  const cut = (clause: KeyRowRecord[]) => {
    let rest = clause;
    while (rest.length >= 3) {
      const length = Math.min(8, rest.length);
      out.push({ key: rest[0].key, rows: rest.slice(-length) });
      rest = rest.slice(0, -length);
    }
  };
  for (const one of runs) {
    let clause: KeyRowRecord[] = [];
    one.forEach((row, i) => {
      clause.push(row);
      const end = STOP.test(row.english) || i === one.length - 1;
      if (end) clauses++;
      if (end && clause.length >= 3) {
        cut(clause);
        clause = [];
      }
    });
  }
  return { clauses, passages: out };
}

const span = (passage: Passage) =>
  `${passage.rows[0].id}–${(passage.rows.at(-1) as KeyRowRecord).id}`;

// --- The generator ----------------------------------------------------------------

export interface NewTextOptions {
  seed: number;
  sentences?: number;
  rows?: number;
  swapped?: number;
  plants?: number;
  knowns?: number;
  joins?: number;
  gd?: number;
  /** How many leading sentences hold every planted known and join. */
  firstSentences?: number;
  repeatRows?: number;
}

export const NEWTEXT_DEFAULTS = {
  sentences: 60,
  rows: 600,
  swapped: 120,
  plants: 40,
  knowns: 20,
  joins: 40,
  gd: 50,
  firstSentences: 30,
  repeatRows: 150,
} as const;

/**
 * A top-up set's counts (plan 077, "Scoring": "200 more rows of the same
 * mix"): the defaults scaled to `rows`, every sentence counted as one of the
 * first (so every planted known and join may go anywhere), and no repeat
 * subset.
 */
export function topUpOptions(rows: number): Omit<NewTextOptions, "seed"> {
  const scale = (n: number) => Math.round((n * rows) / NEWTEXT_DEFAULTS.rows);
  const sentences = scale(NEWTEXT_DEFAULTS.sentences);
  return {
    sentences,
    rows,
    swapped: scale(NEWTEXT_DEFAULTS.swapped),
    plants: scale(NEWTEXT_DEFAULTS.plants),
    knowns: scale(NEWTEXT_DEFAULTS.knowns),
    joins: scale(NEWTEXT_DEFAULTS.joins),
    gd: scale(NEWTEXT_DEFAULTS.gd),
    firstSentences: sentences,
    repeatRows: 0,
  };
}

/** The rows of Key 19 that change with the Aethyr's name (its `aethyr` slot). */
export function aethyrSlots(keys: readonly EnochianKey[]): Set<string> {
  const out = new Set<string>();
  for (const key of keys)
    key.rows.forEach((row, index) => {
      if (row.slot === "aethyr") out.add(`${key.key}.${index + 1}`);
    });
  return out;
}

/** What `buildNewText` reads: our data and the rows never used. */
export interface NewTextData extends SourceData {
  exclude: ReadonlySet<string>;
}

interface Draft {
  sentence: string;
  at: KeyRowRecord;
  kind: RowKind;
  source?: KeyRowRecord;
  made?: string;
  english?: string;
  small?: string;
  gd?: boolean;
}

/**
 * Builds the new text from our data and a seed. Throws when a rule leaves
 * too few candidates for a count asked for, rather than give a smaller set.
 */
export function buildNewText(
  data: NewTextData,
  options: NewTextOptions,
): NewTextSet {
  const o = { ...NEWTEXT_DEFAULTS, ...options };
  const random = prng(o.seed);
  const enough = (what: string, have: number, want: number) => {
    if (have < want)
      throw new Error(`${what}: ${have} candidates for ${want} wanted`);
  };

  // Passages: one from every Key, then in seeded order; then trimmed a row
  // at a time from the front of one (keeping its stop), to the rows wanted.
  const cut = passages(data.rows, data.exclude);
  const order = shuffle(cut.passages, random);
  const keys = [...new Set(order.map((one) => one.key))].sort((a, b) => a - b);
  const picked = keys.map(
    (key) => order.find((one) => one.key === key) as Passage,
  );
  for (const one of order)
    if (picked.length < 2 * o.sentences && !picked.includes(one))
      picked.push(one);
  enough("passages", picked.length, 2 * o.sentences);
  const chosen = picked.map((one) => ({ ...one, rows: [...one.rows] }));
  let total = chosen.reduce((n, one) => n + one.rows.length, 0);
  for (let longer = chosen; total > o.rows; total--) {
    longer = longer.filter((one) => one.rows.length > 3);
    if (!longer.length) break;
    const one = pick(longer, random);
    one.rows = one.rows.slice(1);
  }

  // Pairs from different Keys.
  let pairs: [Passage, Passage][] = [];
  for (
    let attempt = 0;
    attempt < 100 && pairs.length < o.sentences;
    attempt++
  ) {
    const pool = shuffle(chosen, random);
    pairs = [];
    while (pool.length) {
      const first = pool.shift() as Passage;
      const index = pool.findIndex((one) => one.key !== first.key);
      if (index < 0) break;
      pairs.push([first, pool.splice(index, 1)[0]]);
    }
  }
  enough("sentence pairs", pairs.length, o.sentences);

  const sentenceId = (i: number) => `S${String(i + 1).padStart(2, "0")}`;
  const drafts: Draft[] = pairs.flatMap(([a, b], i) =>
    [...a.rows, ...b.rows].map((at) => ({
      sentence: sentenceId(i),
      at,
      kind: "unchanged" as RowKind,
    })),
  );
  const used = new Set(drafts.map((one) => one.at.id));
  const early = (one: Draft) =>
    Number(one.sentence.slice(1)) <= o.firstSentences;
  const free = (one: Draft) => one.kind === "unchanged";

  // Joins, in the first sentences.
  const joins = joinContext(data);
  const joinCounts: Record<string, number> = { candidates: 0 };
  const content = new Set(
    data.rows
      .filter(isScoreable)
      .filter((row) => !isFunctionOnly(row.english))
      .map((row) => normEnochian(row.word))
      .filter((word) => word.length >= 2 && !(word in SMALL_WORDS)),
  );
  for (const word of [...content].sort())
    for (const small of Object.keys(SMALL_WORDS)) {
      joinCounts.candidates++;
      const broken = joinRule(small, word, undefined, joins);
      joinCounts[broken ?? "passed"] =
        (joinCounts[broken ?? "passed"] ?? 0) + 1;
    }
  const joinRows = shuffle(
    drafts.filter(
      (one) =>
        early(one) &&
        isScoreable(one.at) &&
        !isFunctionOnly(one.at.english) &&
        content.has(normEnochian(one.at.word ?? "")),
    ),
    random,
  )
    .map((one) => ({
      one,
      smalls: Object.keys(SMALL_WORDS).filter(
        (small) =>
          !joinRule(
            small,
            normEnochian(one.at.word ?? ""),
            one.at.english,
            joins,
          ),
      ),
    }))
    .filter(({ smalls }) => smalls.length > 0);
  const joinWords = new Set<string>();
  let joined = 0;
  for (const { one, smalls } of joinRows) {
    const word = normEnochian(one.at.word ?? "");
    if (joined >= o.joins || joinWords.has(word)) continue;
    joinWords.add(word);
    one.kind = "join";
    one.small = pick(smalls, random);
    joined++;
  }
  enough("join rows", joined, o.joins);

  // Made-up words: plants and knowns by the same rule.
  const plantCtx = plantContext(data);
  const chain = letterChain(data.rows);
  const made: string[] = [];
  const plantCounts: Record<string, number> = { generated: 0 };
  while (made.length < o.plants + o.knowns && plantCounts.generated < 200000) {
    const word = chain(random);
    plantCounts.generated++;
    const broken = plantRule(word, plantCtx, made);
    plantCounts[broken ?? "passed"] =
      (plantCounts[broken ?? "passed"] ?? 0) + 1;
    if (!broken) made.push(word);
  }
  enough("made-up words", made.length, o.plants + o.knowns);
  const plantWords = made.slice(0, o.plants);
  const knownWords = made.slice(o.plants);

  // English for the plants: half everyday, half in the Keys' register, each
  // list filtered, then shuffled.
  const stems = englishStems(data);
  const everyday = shuffle(
    untranslated(ENGLISH_CANDIDATES.everyday.split(" "), stems),
    random,
  );
  const register = shuffle(
    untranslated(ENGLISH_CANDIDATES.register.split(" "), stems),
    random,
  );
  const half = (n: number) => Math.ceil(n / 2);
  enough("everyday English", everyday.length, half(o.plants));
  enough("register English", register.length, o.plants - half(o.plants));
  const plantEnglish = [
    ...everyday.slice(0, half(o.plants)),
    ...register.slice(0, o.plants - half(o.plants)),
  ];
  // The knowns' meanings: ordinary nouns of their own list, by their own
  // generator (`knownMeanings`), sharing no word with the plants' English.
  const knownEnglish = knownMeanings(
    o.knowns,
    stems,
    prng((o.seed ^ KNOWN_MEANINGS_SALT) >>> 0),
  );
  const plantStems = new Set(plantEnglish.map(stemEnglish));
  const clash = knownEnglish.find((one) => plantStems.has(stemEnglish(one)));
  if (clash) throw new Error(`known meaning "${clash}" is a plant's English`);
  const plantedKnowns: PlantedKnown[] = knownWords.map((headword, i) => ({
    headword,
    meaning: knownEnglish[i],
    source: "WE",
  }));

  // Knowns in the first sentences, on noun rows.
  const plantable = (one: Draft) => free(one) && plantableShape(one.at.english);
  const knownRows = shuffle(drafts.filter(early).filter(plantable), random);
  enough("known rows", knownRows.length, o.knowns);
  knownRows.slice(0, o.knowns).forEach((one, i) => {
    one.kind = "known";
    one.made = knownWords[i];
    one.english = withNoun(one.at.english, knownEnglish[i]);
  });
  // Swaps: sources from rows no passage uses. Rows and swapped-in words are
  // matched by augmenting paths (each word once), rows in seeded order, so
  // a greedy first choice can't strand a later row.
  const info = wordInfo(data);
  const byEnglish = formsByEnglish(data.rows);
  const swapCounts: Record<string, number> = {};
  const sourceRows = new Map<string, KeyRowRecord[]>();
  for (const row of shuffle(data.rows.filter(isScoreable), random)) {
    if (data.exclude.has(row.id) || !swappableShape(row.english)) continue;
    const broken = swapSource(row, info, byEnglish);
    swapCounts[broken ?? "passed"] = (swapCounts[broken ?? "passed"] ?? 0) + 1;
    if (broken || used.has(row.id)) continue;
    const word = normEnochian(row.word ?? "");
    sourceRows.set(word, [...(sourceRows.get(word) ?? []), row]);
  }
  swapCounts.unusedRows = [...sourceRows.values()].flat().length;
  swapCounts.unusedWords = sourceRows.size;
  const fitting = (one: Draft) =>
    [...sourceRows].flatMap(([word, rows]) =>
      rows.some((row) => swapFits(one.at, row, info)) ? [word] : [],
    );
  const owner = new Map<string, Draft>();
  const edges = new Map<Draft, string[]>();
  const augment = (one: Draft, seen: Set<string>): boolean => {
    if (!edges.has(one)) edges.set(one, fitting(one));
    for (const word of edges.get(one) as string[]) {
      if (seen.has(word)) continue;
      seen.add(word);
      const held = owner.get(word);
      if (!held || augment(held, seen)) {
        owner.set(word, one);
        return true;
      }
    }
    return false;
  };
  const replaceable = shuffle(
    drafts.filter((one) => free(one) && swappableShape(one.at.english)),
    random,
  );
  swapCounts.replaceableRows = replaceable.length;
  let swapped = 0;
  for (const one of replaceable)
    if (swapped < o.swapped && augment(one, new Set())) swapped++;
  enough("swaps", swapped, o.swapped);
  for (const [word, one] of owner) {
    one.kind = "swapped";
    one.source = (sourceRows.get(word) as KeyRowRecord[]).find((row) =>
      swapFits(one.at, row, info),
    );
  }

  // Plants anywhere, on the noun rows left.
  const plantRows = shuffle(drafts.filter(plantable), random);
  enough("plant rows", plantRows.length, o.plants);
  plantRows.slice(0, o.plants).forEach((one, i) => {
    one.kind = "plant";
    one.made = plantWords[i];
    one.english = withNoun(one.at.english, plantEnglish[i]);
  });

  // Rows in the GD's spelling: unchanged or swapped, where it differs.
  const gdForm = (row: KeyRowRecord) =>
    row.gd &&
    !/\s/.test(row.gd) &&
    normEnochian(row.gd) !== normEnochian(row.word ?? "")
      ? row.gd
      : undefined;
  const gdRows = shuffle(
    drafts.filter(
      (one) =>
        (one.kind === "unchanged" || one.kind === "swapped") &&
        gdForm(one.source ?? one.at),
    ),
    random,
  );
  enough("GD rows", gdRows.length, o.gd);
  for (const one of gdRows.slice(0, o.gd)) one.gd = true;

  // The rows, as the set file holds them.
  const sentences: NewTextSentence[] = pairs.map(([a, b], i) => ({
    id: sentenceId(i),
    passages: [span(a), span(b)],
    rows: [],
  }));
  const bySentence = new Map(sentences.map((one) => [one.id, one]));
  for (const one of drafts) {
    const sentence = bySentence.get(one.sentence) as NewTextSentence;
    const id = `${one.sentence}.${String(sentence.rows.length + 1).padStart(2, "0")}`;
    sentence.rows.push(rowOf(one, id, info));
  }

  // The repeat runs' rows: whole sentences in seeded order, to 150 rows.
  const repeat: string[] = [];
  let repeatRows = 0;
  for (const one of shuffle(sentences, random)) {
    if (repeatRows >= o.repeatRows) break;
    repeat.push(one.id);
    repeatRows += one.rows.length;
  }

  const rows = sentences.flatMap((one) => one.rows);
  const count = (keep: (row: NewTextRow) => boolean) =>
    rows.filter(keep).length;
  return {
    about:
      "The new text of plan 077, made by `pnpm translate-eval:newtext` from " +
      "keys.json5, dictionary.json5 and the seed; regenerate rather than edit. " +
      "Planted knowns go into the prompt's dictionary as ordinary entries; only " +
      "this file marks them.",
    seed: o.seed,
    sentences,
    plantedKnowns,
    repeat: { sentences: repeat.sort(), rows: repeatRows },
    meta: {
      rows: rows.length,
      kinds: Object.fromEntries(
        ROW_KINDS.map((kind) => [kind, count((row) => row.kind === kind)]),
      ),
      swappedMulti: count(
        (row) => row.kind === "swapped" && Boolean(row.multi),
      ),
      gdSpelling: count((row) => Boolean(row.gdSpelling)),
      firstSentences: {
        sentences: o.firstSentences,
        rows: count((row) => Number(row.sentence.slice(1)) <= o.firstSentences),
        changed: count(
          (row) =>
            Number(row.sentence.slice(1)) <= o.firstSentences &&
            row.kind !== "unchanged",
        ),
      },
      passages: {
        clauses: cut.clauses,
        candidates: cut.passages.length,
        candidateRows: cut.passages.reduce((n, one) => n + one.rows.length, 0),
        keys: keys.length,
      },
      candidates: {
        joins: joinCounts,
        joinRows: joinRows.length,
        joinsBySmall: Object.fromEntries(
          Object.keys(SMALL_WORDS).map((small) => [
            small,
            [...content].filter(
              (word) => !joinRule(small, word, undefined, joins),
            ).length,
          ]),
        ),
        madeUp: plantCounts,
        english: {
          everyday: ENGLISH_CANDIDATES.everyday.split(" ").length,
          everydayPassed: everyday.length,
          register: ENGLISH_CANDIDATES.register.split(" ").length,
          registerPassed: register.length,
          known: Object.values(KNOWN_CANDIDATES).join(" ").split(" ").length,
          knownPassed: untranslated(
            Object.values(KNOWN_CANDIDATES).join(" ").split(" "),
            stems,
          ).length,
        },
        swapSources: swapCounts,
        knownRows: knownRows.length,
        plantRows: plantRows.length,
        gdRows: gdRows.length,
      },
      leitch: null,
    },
  };
}

/** A draft as the set file's row. */
function rowOf(
  one: Draft,
  id: string,
  info: ReadonlyMap<string, WordInfo>,
): NewTextRow {
  const base = {
    id,
    sentence: one.sentence,
    kind: one.kind,
    at: one.at.id,
  };
  const formsOfRow = (row: KeyRowRecord) =>
    [row.word, row.gd].filter((x): x is string => Boolean(x));
  const shown = (row: KeyRowRecord) =>
    one.gd ? (row.gd as string).toUpperCase() : (row.word as string);
  const flag = one.gd ? { gdSpelling: true as const } : {};
  if (one.kind === "plant")
    return {
      ...base,
      enochian: one.made as string,
      english: one.english as string,
      forms: [],
    };
  if (one.kind === "known")
    return {
      ...base,
      enochian: one.made as string,
      english: one.english as string,
      forms: [one.made as string],
    };
  if (one.kind === "join") {
    const small = one.small as string;
    const printed = one.at.word as string;
    const { gloss, senses } = SMALL_WORDS[small];
    return {
      ...base,
      source: one.at.id,
      // Casaubon's spelling kept (ZUMVI, not ZUMUI), the shared letter once.
      enochian:
        small.at(-1) === normEnochian(printed)[0]
          ? small + printed.slice(1)
          : small + printed,
      english: `${gloss} ${one.at.english}`,
      forms: joinForms(small, one.at),
      join: {
        small,
        word: one.at.word as string,
        senses: [...senses],
        english: one.at.english,
      },
    };
  }
  if (one.kind === "swapped") {
    const source = one.source as KeyRowRecord;
    const its = info.get(normEnochian(source.word ?? ""));
    const gone = info.get(normEnochian(one.at.word ?? ""));
    const row: NewTextRow = {
      ...base,
      source: source.id,
      enochian: shown(source),
      english: source.english,
      forms: formsOfRow(source),
      ...flag,
      glosses: [...new Set(its?.glosses ?? [source.english])],
      replaced: {
        word: one.at.word as string,
        english: one.at.english,
        glosses: [
          ...new Set([
            ...(gone?.glosses ?? [one.at.english]),
            ...(gone?.meanings ?? []),
          ]),
        ],
      },
    };
    if ((its?.rows.length ?? 0) > 1) row.multi = true;
    return row;
  }
  return {
    ...base,
    source: one.at.id,
    enochian: shown(one.at),
    english: one.at.english,
    forms: formsOfRow(one.at),
    ...flag,
  };
}

/** Every row of the set, in order. */
export function newTextRows(set: Pick<NewTextSet, "sentences">): NewTextRow[] {
  return set.sentences.flatMap((one) => one.rows);
}

/**
 * The dictionary's order: headwords compared upper-cased, by code unit. It
 * has a few lower-case and mixed-case headwords ("fatesged", "OBZa") in
 * their places by this order, not after "Z" as plain code units would put
 * them.
 */
export const dictionaryOrder = (a: string, b: string) => {
  const x = a.toUpperCase();
  const y = b.toUpperCase();
  return x < y ? -1 : x > y ? 1 : 0;
};

/**
 * The dictionary with the planted knowns among its entries, each before the
 * first headword that sorts after it in the dictionary's order
 * (`dictionaryOrder`), as an ordinary entry: nothing in the prompt marks it.
 */
export function withPlantedKnowns(
  dictionary: EnochianDictionary,
  knowns: readonly PlantedKnown[],
): EnochianDictionary {
  const entries: [string, EnochianEntry][] = Object.entries(dictionary);
  for (const known of [...knowns].sort((a, b) =>
    dictionaryOrder(a.headword, b.headword),
  )) {
    const at = entries.findIndex(
      ([headword]) => dictionaryOrder(headword, known.headword) > 0,
    );
    entries.splice(at < 0 ? entries.length : at, 0, [
      known.headword,
      {
        gematria: [],
        meanings: [{ meaning: known.meaning, source: known.source }],
        pronounciations: [],
      },
    ]);
  }
  return Object.fromEntries(entries);
}

/**
 * The Leitch check's counts: how near the planted words (and the joins) come
 * to the forms of Leitch's lexicon. Counts only; the caller reads the
 * private file and never prints a gloss.
 */
export function leitchCounts(
  set: Pick<NewTextSet, "sentences">,
  leitchForms: readonly string[],
  lexiconSha256: string,
): LeitchCounts {
  const forms = [...new Set(leitchForms.map(normEnochian).filter(Boolean))];
  const folded = forms.map(foldVariants);
  const long = new Set(forms.filter((one) => one.length >= 3));
  const rows = newTextRows(set);
  const group = (kind: RowKind) => {
    const words = rows
      .filter((row) => row.kind === kind)
      .map((row) => normEnochian(row.enochian));
    const n = (keep: (word: string) => boolean) => words.filter(keep).length;
    return {
      words: words.length,
      exact: n((word) => forms.includes(word)),
      withinOne: n((word) => Boolean(within(word, forms, 2))),
      withinTwo: n((word) => Boolean(within(word, forms, 3))),
      foldedWithinOne: n((word) =>
        Boolean(within(foldVariants(word), folded, 2)),
      ),
      containsForm: n((word) => {
        for (let start = 0; start < word.length; start++)
          for (let end = start + 3; end <= word.length; end++)
            if (long.has(word.slice(start, end))) return true;
        return false;
      }),
    };
  };
  return {
    lexiconSha256,
    forms: forms.length,
    groups: {
      plants: group("plant"),
      knowns: group("known"),
      joins: group("join"),
    },
  };
}

/** The Leitch forms that a made-up word or join is within one letter of. */
export function leitchMatches(
  set: Pick<NewTextSet, "sentences">,
  leitchForms: readonly string[],
): { row: string; word: string; leitch: string }[] {
  const forms = [...new Set(leitchForms.map(normEnochian).filter(Boolean))];
  const out: { row: string; word: string; leitch: string }[] = [];
  for (const row of newTextRows(set)) {
    if (row.kind !== "plant" && row.kind !== "known" && row.kind !== "join")
      continue;
    const word = normEnochian(row.enochian);
    const found = within(word, forms, 2);
    if (found) out.push({ row: row.id, word, leitch: found });
  }
  return out;
}
