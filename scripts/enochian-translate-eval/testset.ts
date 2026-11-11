import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import type { EnochianKey } from "magick-data/enochian/keys";
import {
  editDistance,
  foldVariants,
  meaningAgrees,
  normEnochian,
} from "./normalise.ts";

/**
 * The test set of plan 077: nineteen folds, each holding one Key out.
 *
 * - **Scoreable rows**: those with both Casaubon's word and Dee's English.
 * - **Open book**: the whole dictionary and the other 18 Keys' rows.
 * - **Closed book**: the same, less the dictionary entries for the held-out
 *   Key's words that occur in no other Key (`removalsFor`).
 *
 * Every function takes the data as arguments, so tests can pass a few rows;
 * `cli.ts` passes the package's.
 */

/** The five Keys the smaller arms run on (plan 077, "Models and budget"). */
export const FIXED_KEYS: readonly number[] = [3, 6, 9, 12, 18];

/** Key 19's `{ordinal}` as the first Aethyr (LIL), the row as printed. */
const FIRST_AETHYR = "first";

/** A Key row as the experiment reads it. */
export interface KeyRowRecord {
  /** "K.R": the Key and the row, from 1, as the context names it. */
  id: string;
  key: number;
  row: number;
  /** Casaubon's word, as printed. */
  word?: string;
  /** The Golden Dawn's form (The Equinox I(8)), when shown as a word. */
  gd?: string;
  /** Dee's English; empty when the row has none. */
  english: string;
}

/** How a removed headword met a held-out word. */
export type RemovalRule = "same" | "contains" | "contained";

/** A dictionary entry taken out of a fold's closed book, for audit. */
export interface Removal {
  headword: string;
  /** The held-out form (folded) that caught it. */
  because: string;
  rule: RemovalRule;
  /** The held-out rows that say that form. */
  rows: string[];
}

/** An entry the rule would remove but the other Keys use, so it stays. */
export interface Exemption {
  headword: string;
  because: string;
  rule: RemovalRule;
  /** Rows of the other Keys that say the headword. */
  inKeys: string[];
}

/**
 * A kept closed-book entry that may still gloss an unknowable row: its
 * headword is within one letter of the row's form (four letters or more) and
 * a meaning agrees with the row's English. A known gap, listed for audit.
 */
export interface ClosedGap {
  row: string;
  headword: string;
  form: string;
  meaning: string;
}

/** A1's outcome on a row, by task; it decides which rows are "hard". */
export interface A1Outcomes {
  task1: string;
  task2: string;
}

/** A scoreable row of the held-out Key. */
export interface TestRow extends KeyRowRecord {
  word: string;
  /** Its Casaubon word (folded) is said in no other Key. */
  singleKey: boolean;
  /** Knowable in closed book: some other Key says it, with its English. */
  knowableClosed: boolean;
  /** Knowable in open book: in another Key, or the dictionary has it. */
  knowableOpen: boolean;
  /** The whole dictionary has an entry under its normalised spelling. */
  inDictionary: boolean;
  /** A1's open-book outcomes; set by `markHard`. */
  a1?: A1Outcomes;
}

/** One fold: a held-out Key and what its prompt may contain. */
export interface Fold {
  key: number;
  /** The held-out Key's scoreable rows. */
  rows: TestRow[];
  /** Task 1's input: every held-out row with a Casaubon word, in order. */
  input: KeyRowRecord[];
  /** The other 18 Keys' rows: the context's parallel text. */
  contextRows: KeyRowRecord[];
  removals: Removal[];
  exemptions: Exemption[];
}

export type Book = "open" | "closed";

/** The data a test set is built from. */
export interface SourceData {
  dictionary: EnochianDictionary;
  rows: KeyRowRecord[];
}

/** Every row of every Key, flattened; Key 19 as its first Aethyr. */
export function rowsFromKeys(keys: readonly EnochianKey[]): KeyRowRecord[] {
  return keys.flatMap((key) =>
    key.rows.map((row, index) => {
      const gd = row.readings.equinox1912no8;
      const out: KeyRowRecord = {
        id: `${key.key}.${index + 1}`,
        key: key.key,
        row: index + 1,
        english: row.english.replaceAll("{ordinal}", FIRST_AETHYR).trim(),
      };
      const word = row.readings.casaubon1659?.word;
      if (word) out.word = word;
      if (gd?.word && (!gd.marker || gd.marker === "split")) out.gd = gd.word;
      return out;
    }),
  );
}

/** Whether a row is scored: Casaubon's word and Dee's English both there. */
export function isScoreable(
  row: KeyRowRecord,
): row is KeyRowRecord & { word: string } {
  return Boolean(row.word && row.english);
}

/**
 * A row's Casaubon word, folded for the closed book. Knowability and the
 * removal rule's containment use this alone: GD forms are often run
 * together or respelled, and different words share them ("busada" is both
 * LUSDA's and BUFD's).
 */
function casaubonForm(row: KeyRowRecord): string | undefined {
  const form = row.word ? foldVariants(row.word) : "";
  return form || undefined;
}

/** A row's forms, Casaubon's and the GD's, folded: for the gap audit. */
function formsOf(row: KeyRowRecord): string[] {
  return [
    ...new Set(
      [row.word, row.gd]
        .filter((one): one is string => Boolean(one))
        .map(foldVariants)
        .filter(Boolean),
    ),
  ];
}

/** The folded Casaubon words the given rows say, with the rows saying each. */
function spokenForms(rows: readonly KeyRowRecord[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const form = casaubonForm(row);
    if (form) out.set(form, [...(out.get(form) ?? []), row.id]);
  }
  return out;
}

/** Whether a row's Casaubon word is said in no other Key. */
function saidNowhereElse(
  row: KeyRowRecord,
  elsewhere: ReadonlyMap<string, string[]>,
): boolean {
  const form = casaubonForm(row);
  return Boolean(form) && !elsewhere.has(form as string);
}

/**
 * How a headword meets a held-out form, or `undefined`: the same after
 * folding, or one inside the other where the shorter has at least four
 * letters.
 */
export function removalRule(
  headword: string,
  word: string,
): RemovalRule | undefined {
  if (headword === word) return "same";
  if (Math.min(headword.length, word.length) < 4) return undefined;
  if (headword.includes(word)) return "contains";
  if (word.includes(headword)) return "contained";
  return undefined;
}

/**
 * The closed book's removals for a held-out Key (plan 077, task "Closed
 * book"): every entry whose headword meets the Casaubon word of a held-out
 * row said in no other Key (the same, or one inside the other), or is
 * exactly that row's GD form (ELA for LA); except a headword the other Keys
 * themselves say, which stays and is listed as an exemption. Spellings are
 * compared folded wide (`foldVariants`), so BALIE goes with BALYE.
 */
export function removalsFor(
  heldOut: readonly KeyRowRecord[],
  others: readonly KeyRowRecord[],
  dictionary: EnochianDictionary,
): { removals: Removal[]; exemptions: Exemption[] } {
  const elsewhere = spokenForms(others);
  const singleRows = heldOut.filter((row) => saidNowhereElse(row, elsewhere));
  const single = spokenForms(singleRows);
  // GD forms of those rows, for exact matches only.
  const gd = new Map<string, string[]>();
  for (const row of singleRows) {
    const form = row.gd ? foldVariants(row.gd) : "";
    if (form) gd.set(form, [...(gd.get(form) ?? []), row.id]);
  }
  const removals: Removal[] = [];
  const exemptions: Exemption[] = [];
  for (const headword of Object.keys(dictionary)) {
    const folded = foldVariants(headword);
    if (!folded) continue;
    let met: { word: string; rule: RemovalRule; rows: string[] } | undefined;
    for (const [word, rows] of single) {
      const rule = removalRule(folded, word);
      if (rule) {
        met = { word, rule, rows };
        break;
      }
    }
    const byGd = gd.get(folded);
    if (!met && byGd) met = { word: folded, rule: "same", rows: byGd };
    if (!met) continue;
    const inKeys = elsewhere.get(folded);
    if (inKeys)
      exemptions.push({ headword, because: met.word, rule: met.rule, inKeys });
    else
      removals.push({
        headword,
        because: met.word,
        rule: met.rule,
        rows: met.rows,
      });
  }
  return { removals, exemptions };
}

/** One fold of the test set. */
export function buildFold(key: number, data: SourceData): Fold {
  const heldOut = data.rows.filter((row) => row.key === key);
  const contextRows = data.rows.filter((row) => row.key !== key);
  const elsewhere = spokenForms(contextRows);
  const headwords = new Set(Object.keys(data.dictionary).map(normEnochian));
  const rows: TestRow[] = heldOut.filter(isScoreable).map((row) => {
    const singleKey = saidNowhereElse(row, elsewhere);
    const inDictionary = headwords.has(normEnochian(row.word));
    return {
      ...row,
      singleKey,
      knowableClosed: !singleKey,
      knowableOpen: !singleKey || inDictionary,
      inDictionary,
    };
  });
  return {
    key,
    rows,
    input: heldOut.filter((row) => row.word),
    contextRows,
    ...removalsFor(heldOut, contextRows, data.dictionary),
  };
}

/** Every fold, by Key number. */
export function buildTestSet(data: SourceData): Fold[] {
  const keys = [...new Set(data.rows.map((row) => row.key))].sort(
    (a, b) => a - b,
  );
  return keys.map((key) => buildFold(key, data));
}

/** The dictionary a fold's prompt holds in a given book. */
export function contextDictionary(
  fold: Fold,
  book: Book,
  dictionary: EnochianDictionary,
): EnochianDictionary {
  if (book === "open") return dictionary;
  const removed = new Set(fold.removals.map((one) => one.headword));
  return Object.fromEntries(
    Object.entries(dictionary).filter(([headword]) => !removed.has(headword)),
  );
}

/**
 * The closed book's known gaps: kept entries spelled within one letter of an
 * unknowable row's form (four letters or more) whose meaning agrees with the
 * row's English. The removal rule can't take these without also taking
 * unrelated words, so they are listed rather than removed.
 */
export function closedGaps(
  fold: Fold,
  dictionary: EnochianDictionary,
): ClosedGap[] {
  const kept = Object.entries(contextDictionary(fold, "closed", dictionary));
  const out: ClosedGap[] = [];
  for (const row of fold.rows.filter((one) => !one.knowableClosed))
    for (const form of formsOf(row)) {
      if (form.length < 4) continue;
      for (const [headword, entry] of kept) {
        const folded = foldVariants(headword);
        if (Math.abs(folded.length - form.length) > 1) continue;
        if (editDistance(folded, form) > 1) continue;
        const meaning = entry.meanings.find((one) =>
          meaningAgrees(row.english, one.meaning),
        );
        if (meaning)
          out.push({ row: row.id, headword, form, meaning: meaning.meaning });
      }
    }
  return out;
}
