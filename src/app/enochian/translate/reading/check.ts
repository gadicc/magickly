import type { ReadToken, ReadWord, Translator } from "../lookup.ts";
import { fold, type Lookup, type Row } from "../lookupData.ts";
import { parseRef, type ReadingItem } from "./item.ts";
import {
  contentStems,
  englishWords,
  isFunctionOnly,
  sameEnglish,
} from "./normalise.ts";
import { englishLength, sentenceRule, tokenGlosses } from "./sentence.ts";

/**
 * The AI reading's check (plan 081, S6; step 2C): plan 077's checker,
 * extended with the lookup's own spellings, run on the server before the
 * card shows anything. Pure, with no I/O: it takes the passage as the
 * reader typed it, the model's items and sentence, and the page's lookup,
 * and gives one row for each word the lookup reads (its tokens, so one of
 * Crowley's spaced forms, "das iod", is one word), in one of four states,
 * and S7's verdict on the sentence.
 *
 * Nothing the model wrote reaches a row but its English: the word is the
 * reader's, and a source is named as our data names it, never by the
 * model's ref. Plan 081's "2C build notes" record the decisions S6 left
 * open.
 */

/**
 * - `confirmed`: every part cites a source our data has for this word, and
 *   its English is in that source's gloss.
 * - `unconfirmed`: the model's reading of a word our data has, which the
 *   check couldn't settle.
 * - `guess`: the model's reading of a word our data doesn't have.
 * - `none`: no reading.
 */
export type WordState = "confirmed" | "unconfirmed" | "guess" | "none";

/** A source in our data, as our data names it. */
export type ReadingSource =
  /** A dictionary entry, by its key in the dictionary. */
  | { kind: "headword"; headword: string }
  /**
   * A row of Dee's Keys, with Dee's word there (Crowley's where lost); in
   * Key 19's slot, the Aethyr read there, with its number.
   */
  | { kind: "row"; key: number; row: number; word: string; aethyr?: number };

/** One word of the passage, checked. */
export interface CheckedWord {
  /** The word as the reader typed it (the lookup's token). */
  word: string;
  state: WordState;
  /**
   * The model's English, at most `MAX_ENGLISH_WORDS` words; none for
   * `none`. Several items on one word (a join) are joined by spaces.
   */
  english?: string;
  /** The English was cut to `MAX_ENGLISH_WORDS`. */
  cut?: true;
  /**
   * The sources the model cited that our data has for this very word, in
   * the order cited; only on a confirmed or unconfirmed row.
   */
  sources: readonly ReadingSource[];
}

/** Why the card withholds the sentence. */
export type SentenceWithheld =
  | "no sentence"
  | "no content words"
  | "too few supported"
  | "too long"
  | "link";

/**
 * What the card may do with the model's sentence. Withheld, it carries no
 * text of the model's, only the reason and S7's counts; `sentenceRule`
 * gives the words themselves to the experiment's measures.
 */
export type CheckedSentence = {
  /** The sentence's distinct content words. */
  contentWords: number;
  /** How many of them the evidence holds. */
  supported: number;
} & (
  | { shown: true; text: string }
  | { shown: false; withheld: SentenceWithheld }
);

/** The check's outcome for one reading. */
export interface CheckedReading {
  /** One per word the lookup reads, in order. */
  words: readonly CheckedWord[];
  sentence: CheckedSentence;
  /** Items dropped for naming no word of the passage. */
  dropped: number;
}

/** What the model gave for one passage. */
export interface ReadingInput {
  /** The passage as the reader typed it. */
  passage: string;
  /** Its items, as `parseAnswer` reads them; `token` numbers the words. */
  items: readonly ReadingItem[];
  /** Its sentence, as `parseSentence` reads it. */
  sentence?: string;
}

/**
 * The check's version, part of the shared store's key (`readingStoreVersion`):
 * a stored reading is this check's verdict on a reply, kept for a day. Bump it
 * whenever a change here (or in what it reads: the lookup, `normalise.ts`,
 * `sentence.ts`) can change a verdict, so no reading checked the old way is
 * served after the change is deployed.
 */
export const CHECK_VERSION = 1;

/** The most words of the model's English a row shows (S6). */
export const MAX_ENGLISH_WORDS = 10;

/**
 * The most items one word may have and still be checked: more than any
 * reading of ours has parts. Beyond it the word is unconfirmed (or the
 * model's guess), its English still shown, cut.
 */
export const MAX_ITEMS_PER_WORD = 8;

/**
 * The longest sentence shown, in words for each word of the passage: S7's
 * "at most a few times the input's length". Step 2B's sentences ran at
 * 1.96 at most, over parts of about 75 words.
 */
export const SENTENCE_WORDS_PER_WORD = 4;

/**
 * The longest sentence shown for any passage, however short: a word of
 * Enochian can take a line of English ("be friendly unto me").
 */
export const SENTENCE_FLOOR_WORDS = 12;

/**
 * Text as plain text: NFKC (so fullwidth, mathematical or circled letters
 * and ligatures are the letters they look like), controls and format
 * characters out, spaces collapsed.
 */
function plain(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Something a reader could follow out of the card: a scheme ("https://",
 * "javascript:"), "www.", an address with "@", or a dotted name with an
 * ending of two letters or more ("evil.xyz"). "e.g." and "i.e." are not.
 */
const LINK =
  /[a-z][a-z0-9+.-]*:\/\/|\b(?:javascript|mailto|data|file|tel|vbscript):|\bwww\.|\S@\S|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/i;

/** Whether a text holds a link (`LINK`). */
export function hasLink(text: string): boolean {
  // NFKC first, so a fullwidth dot ("evil．com") is a dot.
  return LINK.test(text.normalize("NFKC"));
}

/** Whether an item reads its word: a basis other than unknown, and English. */
function hasReading(item: ReadingItem): boolean {
  if (item.basis === "unknown") return false;
  const english = englishWords(item.target);
  return english.length > 0 && english.join(" ") !== "unknown";
}

/** A ref resolved in our data. */
interface Resolved {
  source: ReadingSource;
  /** A row's id ("1.2"), for matching the lookup's readings. */
  rowId?: string;
  /** A headword's folded spelling, for the same. */
  folded?: string;
  /** The glosses the model's English must sit in. */
  glosses: readonly string[];
  /**
   * The whole spellings the source has, folded, which a word read by it
   * alone may be: never a part of one, so one of Crowley's spaced forms
   * counts only whole.
   */
  forms: ReadonlySet<string>;
}

/** A row's whole spellings: Dee's, Crowley's, Leitch's of that row alone. */
function rowForms(lookup: Lookup, row: Row): Set<string> {
  const forms = new Set([row.folded, row.gdFolded]);
  for (const [spelling, entries] of lookup.leitch)
    if (
      entries.some(
        (one) =>
          one.key === row.key &&
          one.rows.length === 1 &&
          one.rows[0] === row.row,
      )
    )
      forms.add(spelling);
  forms.delete("");
  return forms;
}

/** A ref as our data has it, or undefined when it names nothing we have. */
function resolve(
  lookup: Lookup,
  ref: string | undefined,
): Resolved | undefined {
  if (!ref?.trim()) return undefined;
  const parsed = parseRef(ref);
  if (parsed.kind === "row") {
    const [key, n] = parsed.id.split(".").map(Number);
    const row = lookup.keyRows.get(key)?.[n - 1];
    if (!row) return undefined;
    return {
      source: { kind: "row", key, row: n, word: row.word || row.gd },
      rowId: row.id,
      glosses: [row.english],
      forms: rowForms(lookup, row),
    };
  }
  if (parsed.kind !== "headword") return undefined;
  const folded = fold(parsed.word);
  const word = folded ? lookup.dictionary.get(folded) : undefined;
  if (!word) return undefined;
  // Of headwords that fold alike, the one the model wrote, else the first;
  // either way our key, not the model's text.
  const named =
    word.headwords.find(
      (one) => one.toUpperCase() === parsed.word.toUpperCase(),
    ) ?? word.headwords[0];
  return {
    source: { kind: "headword", headword: named },
    folded,
    glosses: word.meanings.map(({ meaning }) => meaning),
    forms: new Set([folded]),
  };
}

/** Words that turn a reading round, compared by the word. */
const NEGATIONS: ReadonlySet<string> = new Set([
  "not",
  "no",
  "nor",
  "never",
  "none",
  "neither",
]);

/**
 * A text's negations: its words in `NEGATIONS`, with "-n't" and "cannot"
 * as "not". Plan 077's normalising takes "not" and "no" as grammar words,
 * so without this "not reign" would meet "reign".
 */
function negations(text: string): Set<string> {
  const out = new Set(englishWords(text).filter((one) => NEGATIONS.has(one)));
  if (/n['’]t\b|\bcannot\b/i.test(text)) out.add("not");
  return out;
}

/**
 * Whether the model's English is in a gloss (S6): every content word of
 * it, stemmed and with Dee's spellings folded; or, for English of grammar
 * words only, the same words as the gloss, or as a comma- or
 * semicolon-separated piece of a gloss made only of grammar words ("I"
 * meets "I, my"; "of the" does not meet "earth, of the"). Either way a
 * negation in the English must be in the gloss too.
 */
function englishIn(english: string, gloss: string): boolean {
  const denied = negations(english);
  if (denied.size) {
    const glossDenies = negations(gloss);
    if (![...denied].every((one) => glossDenies.has(one))) return false;
  }
  if (isFunctionOnly(english)) {
    if (sameEnglish(english, gloss)) return true;
    if (!isFunctionOnly(gloss)) return false;
    const bare = gloss.replace(/\([^)]*\)|\[[^\]]*\]/g, " ");
    return [...gloss.split(/[,;]/), ...bare.split(/[,;]/)].some((piece) =>
      sameEnglish(english, piece),
    );
  }
  const wanted = contentStems(english);
  if (!wanted.length) return false;
  const have = new Set(contentStems(gloss));
  return wanted.every((one) => have.has(one));
}

/** An Aethyr the lookup reads in Key 19's slot, in place of LIL. */
interface SlotWord {
  /** The Aethyr's name as the lookup shows it. */
  word: string;
  /** The slot's English with the Aethyr's ordinal. */
  gloss: string;
  /** Its number, 1 to 30. */
  aethyr?: number;
}

/** One part of a reading of the lookup's: the sources that may cite it. */
interface Part {
  /** Its rows' ids ("1.2"). */
  rows: ReadonlySet<string>;
  /** Its headwords, folded. */
  entries: ReadonlySet<string>;
}

/** What the lookup offers for a word, to accept a source against. */
interface Offered {
  /** Whether it reads the word as one word at all. */
  single: boolean;
  /** Rows of its one-word readings. */
  rows: ReadonlySet<string>;
  /**
   * Headwords (folded) of its one-word readings that open the word alone.
   * A reading whose word opens several (TAGE: TA and GE) is read in parts,
   * so none of them stands for the whole word.
   */
  entries: ReadonlySet<string>;
  /** Key 19's slot, by row id, where the lookup reads another Aethyr there. */
  slot: ReadonlyMap<string, SlotWord>;
  /**
   * Its readings in parts: of several words (a split, a form spanning
   * rows), or of one word whose entries are its parts (TA + GE).
   */
  joins: readonly (readonly Part[])[];
}

/** A word of a reading as a part; its entries only when it has one. */
const partOf = (word: ReadWord): Part => ({
  rows: new Set(word.rows.map((one) => `${one.key}.${one.row}`)),
  entries: new Set(word.entries.length === 1 ? [fold(word.entries[0])] : []),
});

function offered(lookup: Lookup, token: ReadToken): Offered {
  let single = false;
  const rows = new Set<string>();
  const entries = new Set<string>();
  const slot = new Map<string, SlotWord>();
  const joins: Part[][] = [];
  for (const reading of token.readings) {
    if (reading.words.length > 1) {
      joins.push(reading.words.map(partOf));
      continue;
    }
    single = true;
    const [word] = reading.words;
    for (const place of word.rows) rows.add(`${place.key}.${place.row}`);
    // The slot's own English and entry are the first Aethyr's (LIL); the
    // lookup's gloss there names the one read, which LIL's entry is not.
    const [place] = word.rows;
    const row = place && lookup.keyRows.get(place.key)?.[place.row - 1];
    if (
      row?.aethyrSlot &&
      word.rows.length === 1 &&
      fold(word.word) !== row.folded
    ) {
      slot.set(row.id, {
        word: word.word,
        gloss: word.gloss,
        aethyr: lookup.aethyrs.find((one) => one.dee === word.word)?.n,
      });
      continue;
    }
    if (word.entries.length === 1) entries.add(fold(word.entries[0]));
    else if (word.entries.length > 1)
      joins.push(
        word.entries.map((entry) => ({
          rows: new Set<string>(),
          entries: new Set([fold(entry)]),
        })),
      );
  }
  return { single, rows, entries, slot, joins };
}

/** Whether a resolved source may cite a part. */
function isPart(source: Resolved, part: Part): boolean {
  return source.rowId
    ? part.rows.has(source.rowId)
    : part.entries.has(source.folded ?? "");
}

/** Whether an item reads its source's gloss as a confirmed part may. */
function partHolds(item: ReadingItem, source: Resolved) {
  return (
    (item.basis === "attested" || item.basis === "derived") &&
    source.glosses.some((gloss) => englishIn(item.target, gloss))
  );
}

/** Sources once each, in order. */
function distinct(sources: readonly ReadingSource[]): ReadingSource[] {
  const seen = new Set<string>();
  return sources.filter((one) => {
    const key = JSON.stringify(one);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** One word's state and the sources shown for it. */
function judge(
  lookup: Lookup,
  token: ReadToken,
  items: readonly ReadingItem[],
): { state: WordState; sources: ReadingSource[] } {
  if (!items.some(hasReading)) return { state: "none", sources: [] };
  // A word our data hasn't is the model's guess, whatever it cites: no
  // source of ours is this word's.
  if (!token.readings.length) return { state: "guess", sources: [] };
  const unsettled = { state: "unconfirmed" as const, sources: [] };
  if (items.length > MAX_ITEMS_PER_WORD) return unsettled;
  const offer = offered(lookup, token);
  const resolved = items.map((item) => resolve(lookup, item.ref));

  if (items.length === 1) {
    let [source] = resolved;
    // A word the lookup reads only in parts ("das iod" is DSI and OD) is
    // not read by one item, whatever it cites.
    if (!source || !offer.single) return unsettled;
    // The lookup offers it for this word, or it is this word, whole, in one
    // of the spellings our data has (a fold, Crowley's or Leitch's).
    const accepted =
      (source.rowId
        ? offer.rows.has(source.rowId)
        : offer.entries.has(source.folded ?? "")) ||
      source.forms.has(fold(token.input));
    if (!accepted) return unsettled;
    // Another Aethyr in Key 19's slot: its own English and name, not LIL's.
    const slot = source.rowId ? offer.slot.get(source.rowId) : undefined;
    if (slot && source.source.kind === "row")
      source = {
        ...source,
        glosses: [slot.gloss],
        source: {
          ...source.source,
          word: slot.word,
          ...(slot.aethyr ? { aethyr: slot.aethyr } : {}),
        },
      };
    return {
      state: partHolds(items[0], source) ? "confirmed" : "unconfirmed",
      sources: [source.source],
    };
  }

  // A join is checked only as the lookup reads the word: one of its
  // readings in parts, part by part. Our spellings alone would rebuild
  // nonsense from one-letter headwords (L + D + S).
  const parts = offer.joins.find(
    (join) =>
      join.length === resolved.length &&
      resolved.every((source, at) => source && isPart(source, join[at])),
  );
  if (!parts) return unsettled;
  const sources = resolved as Resolved[];
  return {
    state: items.every((item, at) => partHolds(item, sources[at]))
      ? "confirmed"
      : "unconfirmed",
    sources: distinct(sources.map((one) => one.source)),
  };
}

/** The model's English for a word, plain and cut (S6). */
function englishOf(items: readonly ReadingItem[]) {
  const all = plain(
    items
      .filter(hasReading)
      .map((one) => one.target)
      .join(" "),
  ).split(" ");
  return all.length > MAX_ENGLISH_WORDS
    ? {
        english: all.slice(0, MAX_ENGLISH_WORDS).join(" "),
        cut: true as const,
      }
    : { english: all.join(" ") };
}

/** One word, checked: its state, English and sources. */
function checkWord(
  lookup: Lookup,
  token: ReadToken,
  items: readonly ReadingItem[],
): CheckedWord {
  const none: CheckedWord = { word: token.input, state: "none", sources: [] };
  // English with a link is no reading, and nothing of it is shown.
  if (items.some((one) => hasReading(one) && hasLink(one.target))) return none;
  const { state, sources } = judge(lookup, token, items);
  if (state === "none") return none;
  return { word: token.input, state, ...englishOf(items), sources };
}

/**
 * S7 on the model's sentence: shown only as plain text, no longer than a
 * few times the passage (`SENTENCE_WORDS_PER_WORD`), with no link, and
 * when `sentenceRule` finds most of its content words in the evidence.
 */
function checkSentence(
  sentence: string | undefined,
  evidence: readonly string[],
  passageWords: number,
): CheckedSentence {
  const text = sentence === undefined ? undefined : plain(sentence);
  const verdict = sentenceRule(text, evidence);
  const counts = {
    contentWords: verdict.contentWords,
    supported: verdict.supported,
  };
  const most = Math.max(
    SENTENCE_FLOOR_WORDS,
    SENTENCE_WORDS_PER_WORD * passageWords,
  );
  // A link or a length the card won't show is withheld whatever the rule says.
  const withheld: SentenceWithheld | undefined = !text
    ? "no sentence"
    : hasLink(text)
      ? "link"
      : englishLength(text) > most
        ? "too long"
        : verdict.withheld;
  return withheld || !text
    ? { shown: false, withheld: withheld ?? "no sentence", ...counts }
    : { shown: true, text, ...counts };
}

/** Checks a reading (see the module's comment). */
export function checkReading(
  translator: Translator,
  { passage, items, sentence }: ReadingInput,
): CheckedReading {
  const { tokens } = translator.toEnglish(passage);
  // Items align by `token`, the lookup's words numbered from 1; one that
  // names no word is dropped, never shown. Several on one word are a join.
  const byToken = tokens.map((): ReadingItem[] => []);
  let dropped = 0;
  for (const raw of items) {
    // The English as plain text once, here: every check reads what is
    // shown, so "ｎｏｔ reign" is "not reign" to both.
    const item = { ...raw, target: plain(raw.target) };
    const at = item.token;
    if (
      at !== undefined &&
      Number.isInteger(at) &&
      at >= 1 &&
      at <= tokens.length
    )
      byToken[at - 1].push(item);
    else dropped++;
  }
  const words = tokens.map((token, at) =>
    checkWord(translator.lookup, token, byToken[at]),
  );
  // S7's evidence: the readings shown, as shown, and the lookup's glosses.
  const evidence = [
    ...words.flatMap((one) => (one.english ? [one.english] : [])),
    ...tokenGlosses(translator, tokens),
  ];
  const passageWords = tokens.at(-1)?.span[1] ?? 0;
  return {
    words,
    sentence: checkSentence(sentence, evidence, passageWords),
    dropped,
  };
}
