import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import {
  type AnswerItem,
  alignItems,
  type CheckOutcome,
  checkContext,
  checkItem,
  decipherItem,
  type Task,
} from "./answer.ts";
import type { Cipher } from "./cipher.ts";
import {
  editDistance,
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
  type TestRow,
} from "./testset.ts";

/**
 * Scoring tasks 1 and 2 by script (plan 077, "Scoring"), row by row, every
 * attested item checked, and the figures each arm reports: pooled, per Key
 * with the spread, and on the "hard" rows where A1's lookup is wrong.
 */

/**
 * Task 1, Enochian → English. `to judge`: the script can't settle it and the
 * model judges will. `unknown`: the model said so. Once the two judges have
 * ruled (`judge.ts`), a row both accept becomes `correct`, one both turn down
 * `rejected`, and one they disagree on `split`; the last two are wrong.
 */
export type Task1Outcome =
  | "correct"
  | "to judge"
  | "rejected"
  | "split"
  | "unknown"
  | "missing";

/**
 * Task 2, English → Enochian. `synonym` and `near` are reported apart and not
 * counted as correct.
 */
export type Task2Outcome =
  | "correct"
  | "synonym"
  | "near"
  | "wrong"
  | "unknown"
  | "missing";

export type Outcome = Task1Outcome | Task2Outcome;

/** Whether an item answers "unknown" rather than a word. */
export function saysUnknown(item: AnswerItem, side: string): boolean {
  return item.basis === "unknown" || !side.trim() || /^unknown$/i.test(side);
}

/**
 * Task 1 for one row: correct on a shared content word with Dee's English
 * (stemmed, archaic spelling folded). Where Dee's English is only function
 * words, the same set of words counts ("unto you" is "to you"; the
 * dictionary's "HER, IN" is "in her"), in the whole answer or one of its
 * comma- or semicolon-separated senses. Everything else goes to the judges,
 * so the script never marks a task-1 answer wrong.
 */
export function scoreTask1(
  row: Pick<TestRow, "english">,
  item?: AnswerItem,
): Task1Outcome {
  if (!item) return "missing";
  if (saysUnknown(item, item.target)) return "unknown";
  return meaningAgrees(row.english, item.target) ? "correct" : "to judge";
}

/** English as a lookup key: folded, stemmed words. */
export function englishKey(text: string): string {
  return englishWords(text).map(stemEnglish).join(" ");
}

/**
 * The forms a fold's context uses for each English string, for task 2's
 * "synonym": the other Keys' words by their row's English, and headwords by
 * each comma- or semicolon-separated piece of their meanings.
 */
export function synonymIndex(
  fold: Fold,
  book: Book,
  dictionary: EnochianDictionary,
): Map<string, Set<string>> {
  return synonymsFrom(
    contextRowsFor(fold, book),
    contextDictionary(fold, book, dictionary),
  );
}

/**
 * The same index from any context: Key rows by their English, headwords by
 * each piece of their meanings.
 */
export function synonymsFrom(
  rows: readonly KeyRowRecord[],
  dictionary: EnochianDictionary,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (english: string, form: string) => {
    const key = englishKey(english);
    const norm = normEnochian(form);
    if (!key || !norm) return;
    const forms = out.get(key) ?? new Set<string>();
    forms.add(norm);
    out.set(key, forms);
  };
  for (const row of rows) {
    const form = row.word ?? row.gd;
    if (form && row.english) add(row.english, form);
  }
  for (const [headword, entry] of Object.entries(dictionary))
    for (const { meaning } of entry.meanings)
      for (const piece of meaning.split(/[,;]/)) add(piece, headword);
  return out;
}

/** The forms that count as right for a row: Casaubon's and the GD's. */
function rightForms(row: Pick<TestRow, "word" | "gd">): string[] {
  return [row.word, row.gd]
    .filter((one): one is string => Boolean(one))
    .map(normEnochian);
}

/**
 * Task 2 for one row: correct for Casaubon's word or the GD's form after
 * normalising (or for any of `forms`, where given: the new text's joins);
 * else a synonym the context uses for the same English; else near, within
 * two letters of a right form of five letters or more.
 */
export function scoreTask2(
  row: Pick<TestRow, "word" | "gd" | "english">,
  item: AnswerItem | undefined,
  synonyms: ReadonlyMap<string, ReadonlySet<string>>,
  forms?: readonly string[],
): Task2Outcome {
  if (!item) return "missing";
  if (saysUnknown(item, item.target)) return "unknown";
  const answer = normEnochian(item.target);
  const right = forms ? forms.map(normEnochian) : rightForms(row);
  if (right.includes(answer)) return "correct";
  if (synonyms.get(englishKey(row.english))?.has(answer)) return "synonym";
  if (right.some((one) => one.length >= 5 && editDistance(one, answer) <= 2))
    return "near";
  return "wrong";
}

/** One scored row: its outcome, from the first item aligned to it. */
export interface RowScore {
  id: string;
  key: number;
  outcome: Outcome;
  basis?: AnswerItem["basis"];
  singleKey: boolean;
  knowableClosed: boolean;
  knowableOpen: boolean;
  /** A1's open-book outcome on the row in this task, once A1 has run. */
  a1?: string;
  /** The answer, deciphered where the arm was A2c. */
  answer?: AnswerItem;
  /**
   * Task 1: the answer lists alternatives ("I; my", "fire / flame", or a
   * comma list hitting several dictionary senses), so the script doesn't
   * settle it; the judges do.
   */
  multiSense?: boolean;
  /**
   * Task 1: its item is marked attested and its reference is real, but the
   * reference's English doesn't agree with the answer's (the checker's
   * "to judge"); the judges say whether the reference supports it.
   */
  refToJudge?: boolean;
  /** The judges found the reference doesn't support it: an invention. */
  unsupported?: boolean;
}

/** One item of an answer, checked. */
export interface ItemScore {
  key: number;
  /** The held-out row it aligned to; none when it aligned to nothing. */
  row?: string;
  /** Whether that row is scoreable (not an input row without English). */
  scoreable: boolean;
  check: CheckOutcome;
  basis: AnswerItem["basis"];
}

/** A fold's (or several folds') scores: rows, and every item. */
export interface Scores {
  rows: RowScore[];
  items: ItemScore[];
}

export interface ScoreOptions {
  task: Task;
  book: Book;
  dictionary: EnochianDictionary;
  /** Arm A2c: the answer's Enochian is deciphered before anything else. */
  cipher?: Cipher;
  /**
   * Arm A0: the prompt held no context, so nothing can be attested; every
   * attested item is checked against an empty context.
   */
  emptyContext?: boolean;
  /**
   * Model arms: a task-1 answer that lists alternatives goes to the judges
   * rather than being scored correct by script. A1 (lookup) leaves it off:
   * its first meaning is what lookup is.
   */
  flagAlternatives?: boolean;
}

/**
 * Whether a translation offers alternatives rather than one reading: parts
 * split by ";", "/" or " or ", or a comma list whose parts agree with two
 * or more different senses the dictionary gives the word.
 */
export function listsAlternatives(
  target: string,
  meanings: readonly string[] = [],
): boolean {
  // Dee's own English ends phrases with ";" ("I am;"): only a separator
  // inside the translation counts.
  const inner = target.trim().replace(/[\s.,;:!?]+$/, "");
  if (/;|[A-Za-z]\s*\/\s*[A-Za-z]|\S\s+or\s+\S/i.test(inner)) return true;
  const pieces = inner
    .split(",")
    .map((one) => one.trim())
    .filter(Boolean);
  if (pieces.length < 2) return false;
  const senses = new Set<number>();
  meanings.forEach((meaning, i) => {
    if (pieces.some((piece) => meaningAgrees(piece, meaning))) senses.add(i);
  });
  return senses.size >= 2;
}

/**
 * Scores one fold's answer. Every item is aligned and every attested item
 * checked, extra items and items for input rows without English included;
 * a row's outcome comes from the first item aligned to it.
 */
export function scoreFold(
  fold: Fold,
  items: readonly AnswerItem[],
  options: ScoreOptions,
): Scores {
  const { task, book, dictionary, cipher, emptyContext, flagAlternatives } =
    options;
  const plain = cipher
    ? items.map((item) => decipherItem(item, task, cipher))
    : items;
  const aligned = alignItems(plain, task === 1 ? fold.input : fold.rows, task);
  const context = emptyContext
    ? { entries: new Map(), rows: new Map() }
    : checkContext(fold, book, dictionary);
  const inputWord = new Map(fold.input.map((row) => [row.id, row.word]));
  const scoreable = new Set(fold.rows.map((row) => row.id));
  const first = new Map<string, AnswerItem>();
  const firstCheck = new Map<string, CheckOutcome>();
  const itemScores: ItemScore[] = aligned.map(({ item, row }) => {
    const isFirst = Boolean(row && !first.has(row));
    if (row && isFirst) first.set(row, item);
    const word = task === 1 && row ? inputWord.get(row) : undefined;
    // Task 1: an attested item that aligns to no input word (its source is
    // none of them) is about a word the input never gave: an invention.
    const stray = task === 1 && !row && item.basis === "attested";
    const out: ItemScore = {
      key: fold.key,
      scoreable: Boolean(row && scoreable.has(row)),
      check: stray ? "invention" : checkItem(item, task, context, word),
      basis: item.basis,
    };
    if (row) out.row = row;
    if (row && isFirst) firstCheck.set(row, out.check);
    return out;
  });
  const senses = (word: string) => {
    const norm = normEnochian(word);
    return Object.entries(contextDictionary(fold, book, dictionary))
      .filter(([headword]) => normEnochian(headword) === norm)
      .flatMap(([, entry]) => entry.meanings.map((one) => one.meaning));
  };
  const synonyms =
    task === 2 ? synonymIndex(fold, book, dictionary) : new Map();
  const rows = fold.rows.map((row) => {
    const item = first.get(row.id);
    const score: RowScore = {
      id: row.id,
      key: row.key,
      outcome:
        task === 1 ? scoreTask1(row, item) : scoreTask2(row, item, synonyms),
      singleKey: row.singleKey,
      knowableClosed: row.knowableClosed,
      knowableOpen: row.knowableOpen,
    };
    if (row.a1) score.a1 = task === 1 ? row.a1.task1 : row.a1.task2;
    if (item) {
      score.basis = item.basis;
      score.answer = item;
    }
    if (task === 1 && item && score.outcome !== "unknown") {
      // Neither is settled by script: the judges see both.
      if (flagAlternatives && listsAlternatives(item.target, senses(row.word)))
        score.multiSense = true;
      if (firstCheck.get(row.id) === "to judge") score.refToJudge = true;
      if ((score.multiSense || score.refToJudge) && score.outcome === "correct")
        score.outcome = "to judge";
    }
    return score;
  });
  return { rows, items: itemScores };
}

/** Several folds' scores as one. */
export function joinScores(all: readonly Scores[]): Scores {
  return {
    rows: all.flatMap((one) => one.rows),
    items: all.flatMap((one) => one.items),
  };
}

/** Counts and rates over a set of rows and their items. */
export interface Metrics {
  rows: number;
  counts: Partial<Record<Outcome, number>>;
  /** Correct by script, over rows. */
  accuracy: number;
  /** Correct plus "to judge", over rows: the most the judges can make it. */
  accuracyIfJudged: number;
  /** Items checked, of every kind. */
  items: number;
  /** Attested items whose ref is not in the context or not the word. */
  silentInventions: number;
  /** Silent inventions per 100 scoreable rows. */
  silentInventionsPer100: number;
  /** Attested items with a ref that can't be read. */
  malformedRefs: number;
  /** Items marked "derived" or "coined". */
  marked: number;
  /** Items the checker sent to the judges. */
  checkToJudge: number;
  /** Items that aligned to no held-out row. */
  unaligned: number;
  /** Rows answered "unknown" that the book makes knowable. */
  knowableUnknowns: number;
  /** Task 1: rows whose answer lists alternatives (sent to the judges). */
  multiSense: number;
  /**
   * Task 1: attested items the judges found their reference doesn't
   * support; counted in `silentInventions` too.
   */
  judgedInventions: number;
}

const rate = (part: number, whole: number) => (whole ? part / whole : 0);

/** The metrics of some rows and items, in a book. */
export function metrics(scores: Scores, book: Book): Metrics {
  const { rows, items } = scores;
  const counts: Partial<Record<Outcome, number>> = {};
  for (const one of rows) counts[one.outcome] = (counts[one.outcome] ?? 0) + 1;
  const checks = (check: CheckOutcome) =>
    items.filter((one) => one.check === check).length;
  const judgedInventions = rows.filter((one) => one.unsupported).length;
  const silent = checks("invention") + judgedInventions;
  return {
    rows: rows.length,
    counts,
    accuracy: rate(counts.correct ?? 0, rows.length),
    accuracyIfJudged: rate(
      (counts.correct ?? 0) + (counts["to judge"] ?? 0),
      rows.length,
    ),
    items: items.length,
    silentInventions: silent,
    silentInventionsPer100: 100 * rate(silent, rows.length),
    malformedRefs: checks("malformed ref"),
    marked: items.filter(
      (one) => one.basis === "derived" || one.basis === "coined",
    ).length,
    checkToJudge: checks("to judge"),
    unaligned: items.filter((one) => !one.row).length,
    knowableUnknowns: rows.filter(
      (one) =>
        one.outcome === "unknown" &&
        (book === "open" ? one.knowableOpen : one.knowableClosed),
    ).length,
    multiSense: rows.filter((one) => one.multiSense).length,
    judgedInventions,
  };
}

/** Closed book's honesty: "unknown" against the rows that are unknowable. */
export interface UnknownFigures {
  /** Of the rows answered "unknown", the share that were unknowable. */
  precision: number;
  /** Of the unknowable rows, the share answered "unknown". */
  recall: number;
  /** Of the unknowable rows, the share answered unknown, derived or coined. */
  markedRecall: number;
}

export function unknownFigures(rows: readonly RowScore[]): UnknownFigures {
  const unknown = rows.filter((one) => one.outcome === "unknown");
  const unknowable = rows.filter((one) => !one.knowableClosed);
  return {
    precision: rate(
      unknown.filter((one) => !one.knowableClosed).length,
      unknown.length,
    ),
    recall: rate(
      unknowable.filter((one) => one.outcome === "unknown").length,
      unknowable.length,
    ),
    markedRecall: rate(
      unknowable.filter(
        (one) =>
          one.outcome === "unknown" ||
          one.basis === "derived" ||
          one.basis === "coined",
      ).length,
      unknowable.length,
    ),
  };
}

/** Scores narrowed to some rows, with the items aligned to them. */
function only(scores: Scores, keep: (row: RowScore) => boolean): Scores {
  const rows = scores.rows.filter(keep);
  const ids = new Set(rows.map((one) => one.id));
  return {
    rows,
    items: scores.items.filter((one) => one.row && ids.has(one.row)),
  };
}

/** One set of rows, as each book reports it. */
export interface Figures {
  all: Metrics;
  /** Closed book: the rows still knowable. */
  knowable?: Metrics;
  unknown?: UnknownFigures;
  /** The accuracy the arm is judged by: all rows open, knowable closed. */
  headline: number;
}

export function figures(scores: Scores, book: Book): Figures {
  const all = metrics(scores, book);
  if (book === "open") return { all, headline: all.accuracy };
  const knowable = metrics(
    only(scores, (one) => one.knowableClosed),
    book,
  );
  return {
    all,
    knowable,
    unknown: unknownFigures(scores.rows),
    headline: knowable.accuracy,
  };
}

/** The spread of the per-Key headline accuracy. */
export interface Spread {
  mean: number;
  sd: number;
  min: number;
  max: number;
}

export function spread(values: readonly number[]): Spread {
  if (!values.length) return { mean: 0, sd: 0, min: 0, max: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return {
    mean,
    sd: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/** An arm's report for one task and book. */
export interface Report {
  pooled: Figures;
  perKey: ({ key: number } & Figures)[];
  /** Over Keys with at least one scoreable row. */
  spread: Spread;
  /** Rows A1 gets wrong by script (unknown, wrong, synonym, near). */
  hard: Figures;
  /** The same plus the rows A1's answer sends to the judges. */
  hardWithA1ToJudge: Figures;
  /** Only the rows A1's answer sends to the judges (task 1). */
  a1ToJudge: Figures;
}

/**
 * The report. Hard rows need A1's outcomes on every row (`markHard`); it
 * throws without them rather than report an empty hard set.
 */
export function report(scores: Scores, book: Book): Report {
  if (scores.rows.some((one) => one.a1 === undefined))
    throw new Error("Hard rows need A1's outcomes: run markHard first");
  const keys = [...new Set(scores.rows.map((one) => one.key))].sort(
    (a, b) => a - b,
  );
  const perKey = keys.map((key) => ({
    key,
    ...figures(
      {
        rows: scores.rows.filter((one) => one.key === key),
        items: scores.items.filter((one) => one.key === key),
      },
      book,
    ),
  }));
  return {
    pooled: figures(scores, book),
    perKey,
    spread: spread(perKey.map((one) => one.headline)),
    hard: figures(
      only(scores, (one) => one.a1 !== "correct" && one.a1 !== "to judge"),
      book,
    ),
    hardWithA1ToJudge: figures(
      only(scores, (one) => one.a1 !== "correct"),
      book,
    ),
    a1ToJudge: figures(
      only(scores, (one) => one.a1 === "to judge"),
      book,
    ),
  };
}
