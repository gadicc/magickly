import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import {
  type Cipher,
  encipherMeaning,
  cipher as fixedCipher,
  letterNames,
} from "./cipher.ts";
import { normEnochian } from "./normalise.ts";
import {
  type Book,
  contextDictionary,
  type Fold,
  type KeyRowRecord,
} from "./testset.ts";

/**
 * A fold's context as prompt text: the dictionary first, then the other
 * Keys. The order is fixed (dictionary in file order, Keys by number and
 * row), so every open-book prompt starts with the same dictionary text and a
 * prompt cache can share it across folds. Under the cipher the dictionary is
 * sorted by its enciphered headwords instead: in file order, alphabetical,
 * it would give away each headword's first letter.
 *
 * The context holds each entry's headword, meanings and their `source`, and
 * nothing else: pronunciations, gematria, `source2` and notes are left out,
 * so A2c has nothing of theirs to encipher.
 */

export interface ContextOptions {
  book: Book;
  /** Arm A2c: every Enochian form under the cipher. */
  cipher?: boolean;
}

/**
 * The dictionary part of the context, one entry a line:
 * `WORD<TAB>meaning [source]; meaning [source]`. Under the cipher,
 * `headwords` and the letters' `names` are what is looked for inside
 * meanings; both come from the whole dictionary, even in closed book.
 */
export function serialiseDictionary(
  dictionary: EnochianDictionary,
  using?: Cipher,
  headwords: ReadonlySet<string> = new Set(
    Object.keys(dictionary).map(normEnochian),
  ),
  names: ReadonlySet<string> = letterNames(dictionary),
): string {
  const lines = Object.entries(dictionary).map(([headword, entry]) => {
    const word = using ? using.encipher(headword) : headword;
    const text = entry.meanings
      .map(({ meaning, source }) => {
        const shown = using
          ? encipherMeaning(meaning, headwords, using, headword, names)
          : meaning;
        return source ? `${shown} [${source}]` : shown;
      })
      .join("; ");
    return { word, line: `${word}\t${text}` };
  });
  // A stable sort, by code unit, so the order is the same on every machine.
  if (using)
    lines.sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
  return lines.map((one) => one.line).join("\n");
}

/**
 * A Key row as `K.R<TAB>word<TAB>english`, with `<TAB>GD: form` where the
 * Golden Dawn's form is printed as a word. A row whose Casaubon word is lost
 * has an empty word column and its GD form.
 */
export function serialiseRow(row: KeyRowRecord, using?: Cipher): string {
  const word = (form?: string) => (form && using ? using.encipher(form) : form);
  const columns = [row.id, word(row.word) ?? "", row.english];
  if (row.gd) columns.push(`GD: ${word(row.gd)}`);
  return columns.join("\t");
}

/** The whole context for a fold: dictionary, then the other Keys. */
export function serialiseContext(
  fold: Fold,
  dictionary: EnochianDictionary,
  options: ContextOptions,
): string {
  const using = options.cipher ? fixedCipher : undefined;
  // Meanings are scanned for Enochian against every headword, so a closed
  // book does not leave a removed word's name readable inside another entry.
  const headwords = new Set(Object.keys(dictionary).map(normEnochian));
  const shown = contextDictionary(fold, options.book, dictionary);
  return [
    "# Dictionary (WORD\tmeaning [source]; …)",
    serialiseDictionary(shown, using, headwords, letterNames(dictionary)),
    "",
    "# The other Keys (Key.row\tword\tDee's English)",
    ...fold.contextRows.map((row) => serialiseRow(row, using)),
    "",
  ].join("\n");
}

/**
 * Task 1's input: the held-out Key's Enochian as running text, in row order,
 * each word numbered (`[1] OL [2] SONF …`) so an answer can name the token
 * it translates (`AnswerItem.token`).
 */
export function task1Input(fold: Fold, options: { cipher?: boolean } = {}) {
  return fold.input
    .map((row, index) => {
      const word = row.word ?? "";
      return `[${index + 1}] ${options.cipher ? fixedCipher.encipher(word) : word}`;
    })
    .join(" ");
}

/** Task 2's input: Dee's English, row by row, with the row ids. */
export function task2Input(fold: Fold): string {
  return fold.rows.map((row) => `${row.id}\t${row.english}`).join("\n");
}
