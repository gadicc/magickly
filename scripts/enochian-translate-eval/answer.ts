import type {
  EnochianDictionary,
  EnochianEntry,
} from "magick-data/enochian/dictionary";
import type { Cipher } from "./cipher.ts";
import {
  englishWords,
  meaningAgrees,
  normEnochian,
  stemEnglish,
} from "./normalise.ts";
import {
  type Book,
  contextDictionary,
  contextRowsFor,
  type Fold,
  type KeyRowRecord,
} from "./testset.ts";

/**
 * What a model must answer (plan 077, "What each answer must look like"), and
 * the script that checks every item marked "attested".
 */

/** How the model says it knows a word. */
export type Basis = "attested" | "derived" | "coined" | "unknown";

export type Task = 1 | 2;

/** One word of an answer. */
export interface AnswerItem {
  /** The word given: Enochian in task 1, English in task 2. */
  source: string;
  /** The translation: English in task 1, Enochian in task 2. */
  target: string;
  basis: Basis;
  /**
   * A dictionary headword or a Key row ("K.R") in the context; required for
   * "attested", else optional.
   */
  ref?: string;
  /** The held-out row this item answers ("K.R"). */
  row?: string;
  /** Task 1: the input token it answers, as numbered in the input ("[3]"). */
  token?: number;
}

/**
 * The check's outcome.
 * - `invention`: the ref is missing, is not in the context, or its word is
 *   not the Enochian side; or (task 1) the item answers no input word.
 * - `to judge`: the ref is real but its English shares no content word with
 *   the item's.
 * - `malformed ref`: an attested item whose ref is there but can't be read
 *   as a headword or a row, reported apart from inventions.
 * - `not checked`: not marked attested, so never an invention.
 */
export type CheckOutcome =
  | "ok"
  | "invention"
  | "to judge"
  | "malformed ref"
  | "not checked";

/** What the checker can see of a fold in one book. */
export interface CheckContext {
  /** The context's entries by normalised headword (DIU and DIV together). */
  entries: ReadonlyMap<string, EnochianEntry[]>;
  rows: ReadonlyMap<string, KeyRowRecord>;
}

/** The context a fold's prompt holds, for the checker. */
export function checkContext(
  fold: Fold,
  book: Book,
  dictionary: EnochianDictionary,
): CheckContext {
  return checkContextFrom(
    contextDictionary(fold, book, dictionary),
    contextRowsFor(fold, book),
  );
}

/** The checker's view of any prompt's dictionary and Key rows. */
export function checkContextFrom(
  dictionary: EnochianDictionary,
  rows: readonly KeyRowRecord[],
): CheckContext {
  const entries = new Map<string, EnochianEntry[]>();
  for (const [headword, entry] of Object.entries(dictionary)) {
    const norm = normEnochian(headword);
    entries.set(norm, [...(entries.get(norm) ?? []), entry]);
  }
  return { entries, rows: new Map(rows.map((row) => [row.id, row])) };
}

/** A ref as read: a Key row, a headword, or neither. */
export type ParsedRef =
  | { kind: "row"; id: string }
  | { kind: "headword"; word: string }
  | { kind: "malformed" };

/**
 * Reads a ref in the forms a model is likely to write: "2.3", "Key 2.3",
 * "2.03", "Key 2, row 3", "2:3" for a row; "OL", "OL (dictionary)",
 * "dictionary: OL", "'OL'" for a headword. Anything else is malformed.
 */
export function parseRef(ref: string | undefined): ParsedRef {
  let text = (ref ?? "").trim().replace(/^['"‘“]+|['"’”]+$/g, "");
  const row = text.match(
    /^(?:key\s*)?(\d{1,2})\s*(?:[.:]|,?\s*row)\s*0*(\d{1,3})$/i,
  );
  if (row) return { kind: "row", id: `${Number(row[1])}.${Number(row[2])}` };
  text = text
    .replace(/^(?:dictionary|dict|entry|headword)\s*[:\s]\s*/i, "")
    .replace(/\s*[([](?:dictionary|dict|entry|headword|WE|EMPM)[)\]]\s*$/i, "")
    .trim()
    .replace(/^['"‘“]+|['"’”]+$/g, "");
  if (/^[A-Za-z][A-Za-z\- ()]*$/.test(text) && normEnochian(text))
    return { kind: "headword", word: text };
  return { kind: "malformed" };
}

/** The item's Enochian and English sides for a task. */
export function sides(item: AnswerItem, task: Task) {
  return task === 1
    ? { enochian: item.source, english: item.target }
    : { enochian: item.target, english: item.source };
}

/**
 * Checks one item against its fold's context. `enochian` is the word the
 * item must be about: in task 1 the aligned input row's word, so a model
 * that renames an unknown word to a known one is caught; by default the
 * item's own Enochian side. A list gives every spelling of that word that
 * counts (the new text: a row shown in the Golden Dawn's spelling may cite
 * Casaubon's word, and the other way about).
 */
export function checkItem(
  item: AnswerItem,
  task: Task,
  context: CheckContext,
  enochian: string | readonly string[] = sides(item, task).enochian,
): CheckOutcome {
  if (item.basis !== "attested") return "not checked";
  const { english } = sides(item, task);
  const spellings = new Set(
    (typeof enochian === "string" ? [enochian] : enochian)
      .map(normEnochian)
      .filter(Boolean),
  );
  // An attested item must say where; leaving the ref out is no excuse.
  if (!item.ref?.trim()) return "invention";
  const ref = parseRef(item.ref);
  if (ref.kind === "malformed") return "malformed ref";
  if (ref.kind === "row") {
    const row = context.rows.get(ref.id);
    if (!row) return "invention";
    const forms = [row.word, row.gd]
      .filter((one): one is string => Boolean(one))
      .map(normEnochian);
    if (!forms.some((form) => spellings.has(form))) return "invention";
    return meaningAgrees(english, row.english) ? "ok" : "to judge";
  }
  // A headword is found by its normalised spelling, so "DIU" finds DIV and a
  // deciphered ref finds its entry.
  const norm = normEnochian(ref.word);
  const entries = context.entries.get(norm);
  if (!entries || !spellings.has(norm)) return "invention";
  return entries.some((entry) =>
    entry.meanings.some(({ meaning }) => meaningAgrees(english, meaning)),
  )
    ? "ok"
    : "to judge";
}

/**
 * An A2c item in plain letters: its Enochian side and a headword ref
 * deciphered, so it is checked and scored against the plain fold. Row refs
 * are not Enochian and stay.
 */
export function decipherItem(
  item: AnswerItem,
  task: Task,
  using: Cipher,
): AnswerItem {
  const out = { ...item };
  if (task === 1) out.source = using.decipher(item.source);
  else out.target = using.decipher(item.target);
  const ref = parseRef(out.ref);
  if (ref.kind === "headword") out.ref = using.decipher(ref.word);
  return out;
}

/** An item and the held-out row it was aligned to, if any. */
export interface Aligned {
  item: AnswerItem;
  /** The input row ("K.R"), or `undefined` when the item could not align. */
  row?: string;
}

const englishKey = (text: string) =>
  englishWords(text).map(stemEnglish).join(" ");

/**
 * Aligns every item to a held-out row: in task 1 by its `token`, numbered
 * from 1 in the input; else by its `row` where that names one; else by its
 * source: the input word after normalising (task 1) or the row's English
 * (task 2), taking the first such row not yet claimed. `rows` are task 1's
 * input rows or task 2's scoreable rows. Items that match nothing stay
 * unaligned.
 */
export function alignItems(
  items: readonly AnswerItem[],
  rows: readonly Pick<KeyRowRecord, "id" | "word" | "english">[],
  task: Task,
): Aligned[] {
  const ids = new Set(rows.map((row) => row.id));
  const claimed = new Set<string>();
  const keyOf = (text: string) =>
    task === 1 ? normEnochian(text) : englishKey(text);
  const rowKey = (row: Pick<KeyRowRecord, "word" | "english">) =>
    task === 1 ? normEnochian(row.word ?? "") : englishKey(row.english);
  return items.map((item) => {
    // Task 1's input numbers its words and gives no row ids, so a token wins
    // over a row the model worked out; the two differ wherever a row has no
    // word (Keys 14–16).
    let row =
      task === 1 && item.token !== undefined
        ? rows[item.token - 1]?.id
        : undefined;
    if (!row && item.row && ids.has(item.row)) row = item.row;
    if (!row) {
      const wanted = keyOf(item.source);
      const matches = wanted
        ? rows.filter((one) => rowKey(one) === wanted)
        : [];
      row = (matches.find((one) => !claimed.has(one.id)) ?? matches[0])?.id;
    }
    if (row) claimed.add(row);
    return { item, row };
  });
}
