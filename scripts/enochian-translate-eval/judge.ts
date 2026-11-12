import { createHash } from "node:crypto";
import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import { z } from "zod";
import { parseRef } from "./answer.ts";
import { type Effort, MODELS } from "./models.ts";
import { normEnochian } from "./normalise.ts";
import { parseReply } from "./reply.ts";
import type { Scores, Task1Outcome } from "./score.ts";
import {
  type Book,
  contextDictionary,
  contextRowsFor,
  type Fold,
} from "./testset.ts";
import type { ModelRequest } from "./transport.ts";

/**
 * The judges' step (plan 077, "Scoring"): task-1 rows the script can't settle
 * go to two judges from different model families, each asked whether the
 * answer means the same as Dee's English. Both "same": correct. Both
 * "different": rejected. One of each: split, and the row goes on the expert
 * queue. Rejected and split rows are wrong.
 */

/** The two judges and how hard each thinks (GPT at high, per the owner). */
export const JUDGES = {
  opus: { model: MODELS.opus, effort: "medium" },
  gpt: { model: MODELS.gpt, effort: "high" },
} as const satisfies Record<string, { model: string; effort: Effort }>;

export type JudgeName = keyof typeof JUDGES;

export const JUDGE_NAMES = Object.keys(JUDGES) as JudgeName[];

/** One row put to the judges. */
export interface JudgeRow {
  /** The held-out row ("K.R"). */
  row: string;
  enochian: string;
  dee: string;
  answer: string;
  /** The dictionary's meanings for the word, as the fold's context had them. */
  meanings: string[];
  /** The translation lists alternatives rather than one reading. */
  alternatives?: boolean;
  /**
   * The place the translator said gives this meaning, when its English
   * doesn't obviously agree: the judges also say whether it supports it.
   */
  cited?: { ref: string; text: string };
}

/** The rows of one answer that go to the judges, in one call per judge. */
export interface JudgeCase {
  /** The answer's request id (or "A1-kNN" for the lookup baseline). */
  answer: string;
  key: number;
  rows: JudgeRow[];
}

export type Verdict = {
  verdict: "same" | "different";
  reason: string;
  /** For a row with a cited reference: whether the reference supports it. */
  supported?: boolean;
};

/** A row's verdicts and, once both are in, its outcome. */
export interface JudgedRow {
  /** The translation judged: verdicts on another answer don't apply. */
  answer?: string;
  opus?: Verdict;
  gpt?: Verdict;
  outcome?: Task1Outcome;
  /** Both judges found the cited reference doesn't support it. */
  unsupported?: boolean;
}

/** Judged rows by row id. */
export type JudgedRows = Record<string, JudgedRow>;

/** Two verdicts folded into an outcome; `undefined` until both are in. */
export function foldVerdicts(
  a: Verdict | undefined,
  b: Verdict | undefined,
): Task1Outcome | undefined {
  if (!a || !b) return undefined;
  if (a.verdict === b.verdict)
    return a.verdict === "same" ? "correct" : "rejected";
  return "split";
}

/** A word's meanings in a dictionary, each with its source. */
export function meaningsOf(
  word: string,
  dictionary: EnochianDictionary,
): string[] {
  const norm = normEnochian(word);
  return Object.entries(dictionary)
    .filter(([headword]) => normEnochian(headword) === norm)
    .flatMap(([, entry]) =>
      entry.meanings.map(({ meaning, source }) =>
        source ? `${meaning} [${source}]` : meaning,
      ),
    );
}

/**
 * The case for one answer: its rows still "to judge", with the dictionary's
 * meanings of each word as the answer's context had them.
 */
export function judgeCase(
  answer: string,
  fold: Fold,
  scores: Scores,
  book: Book,
  dictionary: EnochianDictionary,
): JudgeCase {
  const shown = contextDictionary(fold, book, dictionary);
  const contextRows = new Map(
    contextRowsFor(fold, book).map((row) => [row.id, row]),
  );
  const byId = new Map(fold.rows.map((row) => [row.id, row]));
  const rows: JudgeRow[] = [];
  for (const one of scores.rows) {
    if (one.outcome !== "to judge" || !one.answer) continue;
    const row = byId.get(one.id);
    if (!row) continue;
    const out: JudgeRow = {
      row: row.id,
      enochian: row.word,
      dee: row.english,
      answer: one.answer.target,
      meanings: meaningsOf(row.word, shown),
    };
    if (one.multiSense) out.alternatives = true;
    if (one.refToJudge && one.answer.ref) {
      const ref = parseRef(one.answer.ref);
      const text =
        ref.kind === "row"
          ? (() => {
              const cited = contextRows.get(ref.id);
              return cited
                ? `Key row ${cited.id}: ${cited.word ?? cited.gd ?? ""} = ${cited.english}`
                : "";
            })()
          : ref.kind === "headword"
            ? `${ref.word}: ${meaningsOf(ref.word, shown).join("; ")}`
            : "";
      if (text) out.cited = { ref: one.answer.ref, text };
    }
    rows.push(out);
  }
  return { answer, key: fold.key, rows };
}

export const JUDGE_INSTRUCTIONS = `You check English translations of Enochian words against John Dee's own English for the same words, in the nineteen Keys.

For each row you get its id, the Enochian word, Dee's English for it, the English a translator gave, and the meanings our dictionary lists for the word. Decide whether the translator's English means the same as Dee's English for that word in that place.

- "same": the same sense, even in other words or another form of the word. Dee's English is free: it adds articles, pronouns and prepositions that the Enochian word may not carry, so their presence or absence alone doesn't make a difference ("of the earth" and "earth" are the same; "move" and "moving" are the same).
- "different": another sense, or one so vague or broad that it doesn't say what Dee's English says. A meaning the dictionary lists for the word is still "different" if it isn't the sense Dee gives here.

A row marked "alternatives" offers several readings instead of one: it is "same" only if every reading it offers means the same as Dee's English for the word; otherwise "different".

A row with "cited" names the dictionary entry or Key row the translator said gives this meaning. For those rows also give "supported": true if the cited entry or row gives the word a meaning the translation renders, false if not.

Judge each row on its own. Work through them as you need to, then end your reply with one fenced code block marked json, holding an object with one field, "verdicts": a list with one entry per row, each {"row": the row id, "verdict": "same" or "different", "reason": a short phrase}, adding "supported" for rows with "cited". Write nothing after the block.`;

/** A judge's request for a case. Ids keep to [A-Za-z0-9_-], as batches need. */
export function judgeRequest(
  item: JudgeCase,
  judge: JudgeName,
  id = `${item.answer}_judge-${judge}`,
): ModelRequest {
  const rows = item.rows.map((one) => ({
    row: one.row,
    enochian: one.enochian,
    dee: one.dee,
    translation: one.answer,
    dictionary: one.meanings.length ? one.meanings : ["(no entry)"],
    ...(one.alternatives ? { alternatives: true } : {}),
    ...(one.cited ? { cited: one.cited.text } : {}),
  }));
  return {
    id,
    kind: "judge",
    model: JUDGES[judge].model,
    effort: JUDGES[judge].effort,
    instructions: [JUDGE_INSTRUCTIONS],
    prompt: `The rows, as JSON:\n\n${JSON.stringify(rows, null, 1)}`,
  };
}

const verdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      row: z.string(),
      verdict: z.enum(["same", "different"]),
      reason: z
        .string()
        .nullish()
        .transform((one) => one ?? ""),
      supported: z
        .boolean()
        .nullish()
        .transform((one) => one ?? undefined),
    }),
  ),
});

/** A judge's verdicts by row id; an unreadable reply gives none. */
export function parseVerdicts(text: string): {
  verdicts: Map<string, Verdict>;
  error?: string;
} {
  const parsed = parseReply(text, verdictsSchema);
  if (!parsed.ok) return { verdicts: new Map(), error: parsed.error };
  return {
    verdicts: new Map(
      parsed.value.verdicts.map((one) => [
        one.row,
        {
          verdict: one.verdict,
          reason: one.reason,
          ...(one.supported === undefined ? {} : { supported: one.supported }),
        },
      ]),
    ),
  };
}

/**
 * The judged rows of one case from each judge's verdicts. A row a judge gave
 * no verdict for (its reply failed, or skipped the row) has no outcome and
 * stays "to judge", so the bars refuse it rather than count it.
 */
export function judgeRows(
  item: JudgeCase,
  verdicts: Partial<Record<JudgeName, ReadonlyMap<string, Verdict>>>,
): JudgedRows {
  const out: JudgedRows = {};
  for (const { row, answer } of item.rows) {
    const judged: JudgedRow = { answer };
    for (const judge of JUDGE_NAMES) {
      const verdict = verdicts[judge]?.get(row);
      if (verdict) judged[judge] = verdict;
    }
    const outcome = foldVerdicts(judged.opus, judged.gpt);
    if (outcome) judged.outcome = outcome;
    if (judged.opus?.supported === false && judged.gpt?.supported === false)
      judged.unsupported = true;
    out[row] = judged;
  }
  return out;
}

/**
 * Folds the judges' outcomes into scores: "to judge" rows that have one, for
 * the same translation (a reply re-run since has its rows judged afresh).
 */
export function applyVerdicts(scores: Scores, judged: JudgedRows | undefined) {
  if (!judged) return scores;
  for (const one of scores.rows) {
    const verdict = judged[one.id];
    if (!sameAnswer(verdict, one.answer?.target)) continue;
    const outcome = verdict?.outcome;
    if (one.outcome === "to judge" && outcome) one.outcome = outcome;
    if (verdict?.unsupported && one.refToJudge) one.unsupported = true;
  }
  return scores;
}

/** A translation as the verdict store keys it: case, spaces, edges folded. */
export function normTranslation(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’.,;:!?]+|[\s"'“”‘’.,;:!?]+$/g, "");
}

/**
 * The verdict store's key for a row's translation: the row, the normalised
 * translation, any reference put to the judges with the text cited for it,
 * and whether the alternatives rule applied.
 * The same translation of the same row is the same question in any run or
 * arm, and in A1.
 */
export function verdictKey(row: JudgeRow): string {
  // The alternatives rule and the cited text (which differs between open and
  // closed book) change the judges' question, so they are part of the key.
  const cited = row.cited
    ? `${row.cited.ref}#${createHash("sha256").update(row.cited.text).digest("hex").slice(0, 12)}`
    : "";
  return [
    row.row,
    normTranslation(row.answer),
    cited,
    row.alternatives ? "alternatives" : "",
  ].join("\t");
}

/** Verdicts by `verdictKey`, across runs (`<out>/verdicts.json`). */
export type VerdictStore = Record<string, Partial<Record<JudgeName, Verdict>>>;

/** Whether saved verdicts are for this translation. */
export function sameAnswer(
  judged: JudgedRow | undefined,
  answer: string | undefined,
): boolean {
  return judged?.answer === undefined || judged.answer === answer;
}

/** Counts of each judged outcome and of rows still waiting. */
export function judgedCounts(all: readonly JudgedRows[]) {
  const out = { correct: 0, rejected: 0, split: 0, waiting: 0, agree: 0 };
  for (const rows of all)
    for (const one of Object.values(rows)) {
      if (one.outcome === "correct") out.correct++;
      else if (one.outcome === "rejected") out.rejected++;
      else if (one.outcome === "split") out.split++;
      else out.waiting++;
      if (one.outcome === "correct" || one.outcome === "rejected") out.agree++;
    }
  return out;
}

/** The expert queue's columns (`<out>/expert-queue.tsv`). */
export const EXPERT_QUEUE_HEAD =
  "source\tanswer\trow\tenochian\tdee\ttranslation\topus\topus reason\tgpt\tgpt reason";

/** The expert queue's lines for a case's split rows. */
export function expertLines(
  source: string,
  item: JudgeCase,
  judged: JudgedRows,
): string[] {
  const clean = (text: string | undefined) =>
    (text ?? "").replace(/[\t\n]+/g, " ");
  return item.rows
    .filter((one) => judged[one.row]?.outcome === "split")
    .map((one) => {
      const { opus, gpt } = judged[one.row];
      return [
        source,
        item.answer,
        one.row,
        one.enochian,
        one.dee,
        one.answer,
        opus?.verdict,
        opus?.reason,
        gpt?.verdict,
        gpt?.reason,
      ]
        .map(clean)
        .join("\t");
    });
}
