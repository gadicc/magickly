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
  joinScores,
  type Scores,
  scoreFold,
  type Task1Outcome,
} from "./score.ts";
import { type Book, contextDictionary, type Fold } from "./testset.ts";

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
  const shown = contextDictionary(fold, book, dictionary);
  const byNorm = headwordsByNorm(shown);
  return fold.input.map((row, index) => {
    const word = row.word as string;
    const token = index + 1;
    const headword = Object.hasOwn(shown, word)
      ? word
      : byNorm.get(normEnochian(word))?.[0];
    const meaning = headword
      ? firstKnownMeaning(shown[headword]).meaning
      : null;
    if (!headword || !meaning) return unknown(word, row.id, token);
    return {
      source: word,
      target: meaning,
      basis: "attested",
      ref: headword,
      row: row.id,
      token,
    };
  });
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
  const index = buildIndex(
    contextDictionary(fold, book, dictionary),
    contextUses(fold),
  );
  return fold.rows.map((row) => {
    // The row as Dee wrote it, then with his spelling folded ("Raign"), then
    // its content words one by one.
    const all = englishWords(row.english);
    let hit = bestHit(index, row.english) ?? bestHit(index, all.join(" "));
    if (!hit)
      for (const word of all.filter((one) => !FUNCTION_WORDS.has(one))) {
        const one = bestHit(index, word);
        if (one && (!hit || one.tier < hit.tier)) hit = one;
      }
    if (!hit) return unknown(row.english, row.id);
    return {
      source: row.english,
      target: hit.word,
      basis: "attested",
      ref: hit.word,
      row: row.id,
    };
  });
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
