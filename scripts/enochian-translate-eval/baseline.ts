import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import {
  buildIndex,
  firstKnownMeaning,
  type Hit,
  searchDictionary,
} from "../../src/app/enochian/dictionary/search.ts";
import type { AnswerItem } from "./answer.ts";
import { englishWords, FUNCTION_WORDS, normEnochian } from "./normalise.ts";
import {
  englishKey,
  joinScores,
  type Scores,
  scoreFold,
  type Task1Outcome,
} from "./score.ts";
import {
  type Book,
  contextDictionary,
  type Fold,
  type KeyRowRecord,
} from "./testset.ts";

/**
 * Arm A1 (plan 077): no model, only lookup in our own dictionary. It never
 * sees the held-out Key's rows, and in closed book not the removed entries
 * either. Its items are all "attested" with the headword as `ref`, so the
 * checker must pass every one: a useful test of the checker.
 */

/** Headwords by normalised spelling, in file order. */
function headwordsByNorm(dictionary: EnochianDictionary) {
  const out = new Map<string, string[]>();
  for (const headword of Object.keys(dictionary)) {
    const norm = normEnochian(headword);
    out.set(norm, [...(out.get(norm) ?? []), headword]);
  }
  return out;
}

const unknown = (source: string, row: string, token?: number): AnswerItem => ({
  source,
  target: "unknown",
  basis: "unknown",
  row,
  ...(token ? { token } : {}),
});

/**
 * Task 1: each word of the held-out Key glossed with its entry's first known
 * meaning ("meaning unknown" skipped). The entry is the one spelled as the
 * word, else the first whose spelling normalises to it.
 */
export function a1Task1(
  fold: Fold,
  book: Book,
  dictionary: EnochianDictionary,
): AnswerItem[] {
  const gloss = dictionaryGlosser(contextDictionary(fold, book, dictionary));
  return fold.input.map((row, index) =>
    gloss(row.word as string, row.id, index + 1),
  );
}

/**
 * A1's task-1 lookup over one dictionary: a word glossed with its entry's
 * first known meaning, or "unknown".
 */
function dictionaryGlosser(shown: EnochianDictionary) {
  const byNorm = headwordsByNorm(shown);
  return (word: string, row: string, token?: number): AnswerItem => {
    const headword = Object.hasOwn(shown, word)
      ? word
      : byNorm.get(normEnochian(word))?.[0];
    const meaning = headword
      ? firstKnownMeaning(shown[headword]).meaning
      : null;
    if (!headword || !meaning) return unknown(word, row, token);
    return {
      source: word,
      target: meaning,
      basis: "attested",
      ref: headword,
      row,
      ...(token ? { token } : {}),
    };
  };
}

/**
 * How often the other Keys say each headword (Casaubon's spelling), for the
 * search's tie-break. Counted from the fold's context only, so the held-out
 * Key cannot steer the ranking.
 */
function contextUses(fold: Fold): Record<string, number> {
  const uses: Record<string, number> = {};
  for (const row of fold.contextRows)
    if (row.word) uses[row.word] = (uses[row.word] ?? 0) + 1;
  return uses;
}

/** The search's best English hit, or `undefined`. */
function bestHit(
  index: ReturnType<typeof buildIndex>,
  query: string,
): Hit | undefined {
  const found = searchDictionary(index, query);
  return found.means[0] ?? found.mentions[0];
}

/**
 * Task 2: each row of Dee's English reversed through the dictionary's own
 * English search (plan 074): the best hit for the whole row, as written and
 * then with Dee's spelling folded; failing that, the best hit for any one of
 * its content words (lowest tier, then the earlier word). The search's "Enochian word" and spelling groups are
 * ignored: they match the English as if it were Enochian.
 */
export function a1Task2(
  fold: Fold,
  book: Book,
  dictionary: EnochianDictionary,
): AnswerItem[] {
  const reverse = reverser(
    buildIndex(contextDictionary(fold, book, dictionary), contextUses(fold)),
  );
  return fold.rows.map((row) => reverse(row.english, row.id));
}

/** A1's task-2 lookup over one search index: English to a headword. */
function reverser(index: ReturnType<typeof buildIndex>) {
  return (english: string, row: string): AnswerItem => {
    // The row as Dee wrote it, then with his spelling folded ("Raign"), then
    // its content words one by one.
    const all = englishWords(english);
    let hit = bestHit(index, english) ?? bestHit(index, all.join(" "));
    if (!hit)
      for (const word of all.filter((one) => !FUNCTION_WORDS.has(one))) {
        const one = bestHit(index, word);
        if (one && (!hit || one.tier < hit.tier)) hit = one;
      }
    if (!hit) return unknown(english, row);
    return {
      source: english,
      target: hit.word,
      basis: "attested",
      ref: hit.word,
      row,
    };
  };
}

/** A1's scores for one fold, both tasks, in one book. */
export function a1Scores(
  fold: Fold,
  book: Book,
  dictionary: EnochianDictionary,
): { task1: Scores; task2: Scores } {
  return {
    task1: scoreFold(fold, a1Task1(fold, book, dictionary), {
      task: 1,
      book,
      dictionary,
    }),
    task2: scoreFold(fold, a1Task2(fold, book, dictionary), {
      task: 2,
      book,
      dictionary,
    }),
  };
}

/**
 * Records A1's open-book outcome on every scoreable row, per task, which
 * decides the "hard" rows: those A1 gets wrong by script, reported with and
 * without the rows its answer sends to the judges. Changes the folds in place
 * and returns the open-book scores, already carrying the outcomes.
 *
 * `judged` holds the judges' folded outcome for A1's task-1 "to judge" rows
 * (`judge-a1`, by row id): with it, those rows become correct, rejected or
 * split, and the rejected and split ones are hard. A row it lacks stays
 * "to judge".
 */
export function markHard(
  folds: Fold[],
  dictionary: EnochianDictionary,
  judged?: ReadonlyMap<string, Task1Outcome>,
): { task1: Scores; task2: Scores } {
  const task1: Scores[] = [];
  const task2: Scores[] = [];
  for (const fold of folds) {
    const scores = a1Scores(fold, "open", dictionary);
    if (judged)
      for (const one of scores.task1.rows) {
        const verdict = judged.get(one.id);
        if (one.outcome === "to judge" && verdict) one.outcome = verdict;
      }
    const outcomes = (one: Scores) =>
      new Map(one.rows.map((row) => [row.id, row.outcome as string]));
    const first = outcomes(scores.task1);
    const second = outcomes(scores.task2);
    for (const row of fold.rows)
      row.a1 = {
        task1: first.get(row.id) as string,
        task2: second.get(row.id) as string,
      };
    for (const one of scores.task1.rows) one.a1 = first.get(one.id);
    for (const one of scores.task2.rows) one.a1 = second.get(one.id);
    task1.push(scores.task1);
    task2.push(scores.task2);
  }
  return { task1: joinScores(task1), task2: joinScores(task2) };
}

// --- The new text: A1 and A1k -------------------------------------------------

/** A row of the new text as the baselines see it: its inputs, by task. */
export interface NewTextInput {
  id: string;
  /** Task 1's Enochian. */
  enochian: string;
  /** Task 2's English. */
  english: string;
}

/** Answers to both tasks, one item a row. */
export interface BaselineAnswers {
  task1: AnswerItem[];
  task2: AnswerItem[];
}

/** How often the Keys say each Casaubon word, for the search's tie-break. */
function keyUses(keyRows: readonly KeyRowRecord[]): Record<string, number> {
  const uses: Record<string, number> = {};
  for (const row of keyRows)
    if (row.word) uses[row.word] = (uses[row.word] ?? 0) + 1;
  return uses;
}

/**
 * A1 on the new text (plan 077, "Arms"): the same lookup as on the folds,
 * over the prompt's dictionary (`dictionary` must already hold the planted
 * knowns, as a model's prompt does) and every Key's uses. It never looks at
 * the Keys' English. A join or a plant is in no entry, so it answers
 * "unknown"; a planted known is found like any word.
 */
export function a1NewText(
  rows: readonly NewTextInput[],
  dictionary: EnochianDictionary,
  keyRows: readonly KeyRowRecord[],
): BaselineAnswers {
  const gloss = dictionaryGlosser(dictionary);
  const reverse = reverser(buildIndex(dictionary, keyUses(keyRows)));
  return {
    task1: rows.map((row) => gloss(row.enochian, row.id)),
    task2: rows.map((row) => reverse(row.english, row.id)),
  };
}

/** The commonest of some values, the earliest on a tie; with its first index. */
function commonest<T>(values: readonly T[], keyOf: (one: T) => string) {
  const counts = new Map<string, { n: number; first: T }>();
  for (const one of values) {
    const key = keyOf(one);
    const seen = counts.get(key);
    if (seen) seen.n++;
    else counts.set(key, { n: 1, first: one });
  }
  let best: { n: number; first: T } | undefined;
  for (const one of counts.values()) if (!best || one.n > best.n) best = one;
  return best?.first;
}

/**
 * A1k on the new text (plan 077, "Arms"): A1, but the Keys first.
 * - Task 1: the Key rows whose Casaubon word or GD form is the word, after
 *   normalising, give its commonest gloss (Dee's English, compared as
 *   `englishKey` folds it), cited by the first such row; failing that, A1's
 *   dictionary gloss; failing that, "unknown".
 * - Task 2: the Key rows with the same English (as `englishKey` folds it)
 *   give their commonest Casaubon word, cited by its first row; failing
 *   that, A1's reverse index.
 * Joins and plants are in no Key, so they fall to A1; planted knowns are
 * found there, in the prompt's dictionary.
 */
export function a1kNewText(
  rows: readonly NewTextInput[],
  dictionary: EnochianDictionary,
  keyRows: readonly KeyRowRecord[],
): BaselineAnswers {
  const a1 = a1NewText(rows, dictionary, keyRows);
  const glossed = keyRows.filter((row) => row.english);
  const byForm = new Map<string, KeyRowRecord[]>();
  const byEnglish = new Map<string, KeyRowRecord[]>();
  for (const row of glossed) {
    const forms = new Set(
      [row.word, row.gd]
        .filter((one): one is string => Boolean(one))
        .map(normEnochian),
    );
    for (const form of forms)
      if (form) byForm.set(form, [...(byForm.get(form) ?? []), row]);
    if (row.word) {
      const key = englishKey(row.english);
      byEnglish.set(key, [...(byEnglish.get(key) ?? []), row]);
    }
  }
  return {
    task1: rows.map((row, i) => {
      const found = commonest(
        byForm.get(normEnochian(row.enochian)) ?? [],
        (one) => englishKey(one.english),
      );
      if (!found) return a1.task1[i];
      return {
        source: row.enochian,
        target: found.english,
        basis: "attested",
        ref: found.id,
        row: row.id,
      };
    }),
    task2: rows.map((row, i) => {
      const found = commonest(
        byEnglish.get(englishKey(row.english)) ?? [],
        (one) => normEnochian(one.word as string),
      );
      if (!found) return a1.task2[i];
      return {
        source: row.english,
        target: found.word as string,
        basis: "attested",
        ref: found.id,
        row: row.id,
      };
    }),
  };
}

/**
 * A1 on task 3 (plan 077, "Tasks"): no model, word by word. Each English
 * word of a sentence goes through A1's reverse index (task 2's, over the
 * dictionary without the planted knowns and every Key's uses), in order;
 * one item a word, "unknown" where nothing is found, and a function word
 * nothing translates ("the", "a") is left out, as Enochian has none.
 */
export function a1Task3(
  sentences: readonly { id: string; english: string }[],
  dictionary: EnochianDictionary,
  keyRows: readonly KeyRowRecord[],
): Map<string, AnswerItem[]> {
  const reverse = reverser(buildIndex(dictionary, keyUses(keyRows)));
  return new Map(
    sentences.map((sentence) => [
      sentence.id,
      englishWords(sentence.english).flatMap((word) => {
        const item = reverse(word, sentence.id);
        return item.basis === "unknown" && FUNCTION_WORDS.has(word)
          ? []
          : [item];
      }),
    ]),
  );
}
