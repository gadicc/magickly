import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import {
  type AnswerItem,
  alignItems,
  type Basis,
  type CheckContext,
  type CheckOutcome,
  checkContextFrom,
  checkItem,
  parseRef,
  type Task,
} from "./answer.ts";
import {
  type JudgeCase,
  type JudgedRows,
  type JudgeRow,
  meaningsOf,
  sameAnswer,
} from "./judge.ts";
import type { NewTextRow, RowKind } from "./newtext.ts";
import { englishWords, meaningAgrees, normEnochian } from "./normalise.ts";
import {
  listsAlternatives,
  type Outcome,
  saysUnknown,
  scoreTask1,
  scoreTask2,
  synonymsFrom,
} from "./score.ts";
import type { KeyRowRecord } from "./testset.ts";

/**
 * Scoring tasks 1 and 2 on the new text (plan 077, "Scoring" and "What each
 * answer must look like"), by script. It reuses the folds' checker and row
 * scorers; what is new is the row kinds, "recalled", the plants' outcomes,
 * the joins' two parts, hedging, and the figures per row kind with their
 * Wilson intervals. Rows the script can't settle stay "to judge" until the
 * judges' step settles them.
 */

/**
 * A planted unknown's outcome, either task. `unknown`, `derived` (citing a
 * ref whose form is inside the word) and `coined` pass; `attested` (a silent
 * invention by rule) and `unsupported guess` (derived from no form inside
 * the word) fail.
 */
export type PlantOutcome =
  | "unknown"
  | "derived"
  | "coined"
  | "unsupported guess"
  | "attested"
  | "missing";

export const PLANT_PASSES: ReadonlySet<string> = new Set([
  "unknown",
  "derived",
  "coined",
]);

/**
 * A row's outcome: the folds' task-1 or task-2 outcome; "recalled" (task 1,
 * a swapped row answered with the replaced word's sense); or, on a plant,
 * its plant outcome.
 */
export type NewOutcome = Outcome | "recalled" | PlantOutcome;

/** What the prompt holds, as the scorer reads it. */
export interface NewTextContext {
  check: CheckContext;
  /** Task 2's "synonym": the forms the context uses for each English. */
  synonyms: Map<string, Set<string>>;
}

/**
 * The context of the new text's prompt: `dictionary` with the planted knowns
 * already in it (`withPlantedKnowns`), and every Key row.
 */
export function newTextContext(
  dictionary: EnochianDictionary,
  keyRows: readonly KeyRowRecord[],
): NewTextContext {
  return {
    check: checkContextFrom(dictionary, keyRows),
    synonyms: synonymsFrom(keyRows, dictionary),
  };
}

/** One scored row of the new text. */
export interface NewRowScore {
  id: string;
  sentence: string;
  kind: RowKind;
  multi: boolean;
  gdSpelling: boolean;
  outcome: NewOutcome;
  basis?: Basis;
  answer?: AnswerItem;
  /**
   * The word is in the prompt (unchanged, swapped or planted known) but the
   * answer marks it derived, coined or unknown.
   */
  hedged?: boolean;
  /** Task 1: the answer lists alternatives (sent to the judges). */
  multiSense?: boolean;
  /** Task 1: an attested item whose ref's English the judges must weigh. */
  refToJudge?: boolean;
  /** Both judges found the cited reference doesn't support the answer. */
  unsupported?: boolean;
}

/** One checked item. */
export interface NewItemScore {
  row?: string;
  check: CheckOutcome;
  basis: Basis;
}

export interface NewScores {
  task: Task;
  rows: NewRowScore[];
  items: NewItemScore[];
}

export interface NewScoreOptions {
  /** Model arms: alternatives in a task-1 answer go to the judges. */
  flagAlternatives?: boolean;
  /** Arm A0: nothing is in the prompt, so no attested item can pass. */
  emptyContext?: boolean;
}

/** Whether an answer's English renders a small word ("which", "is"). */
function rendersSmall(senses: readonly string[], target: string): boolean {
  const said = new Set(englishWords(target));
  return senses.some((one) => said.has(one));
}

/** The shortest cited form a derivation may rest on. */
export const MIN_DERIVED_FORM = 3;

/**
 * Whether a derived item cites a ref whose form is inside the word: a
 * headword, or a Key row's Casaubon word or GD form, in the context, of
 * three letters or more (a letter or two is inside almost anything).
 */
export function supportedDerivation(
  item: AnswerItem,
  word: string,
  context: CheckContext,
): boolean {
  const ref = parseRef(item.ref);
  const inside = (form: string | undefined) => {
    const norm = normEnochian(form ?? "");
    return norm.length >= MIN_DERIVED_FORM && normEnochian(word).includes(norm);
  };
  if (ref.kind === "row") {
    const row = context.rows.get(ref.id);
    return Boolean(row && (inside(row.word) || inside(row.gd)));
  }
  if (ref.kind === "headword")
    return context.entries.has(normEnochian(ref.word)) && inside(ref.word);
  return false;
}

/**
 * A plant's outcome, from the first item for its row. A derivation is
 * checked against the word: in task 1 the plant as shown (`plant`), never
 * the model's `source`, which it could change; in task 2 the Enochian it
 * wrote. A plant holds no attested form of three letters or more by
 * construction, so in task 1 a derived reading is always an unsupported
 * guess.
 */
export function plantOutcome(
  item: AnswerItem | undefined,
  task: Task,
  context: CheckContext,
  plant: string = item?.source ?? "",
): PlantOutcome {
  if (!item) return "missing";
  if (saysUnknown(item, item.target)) return "unknown";
  if (item.basis === "attested") return "attested";
  if (item.basis === "coined") return "coined";
  const word = task === 1 ? plant : item.target;
  return supportedDerivation(item, word, context)
    ? "derived"
    : "unsupported guess";
}

/** Several items for one row (a join written in parts) as one. */
function combined(items: readonly AnswerItem[], task: Task): AnswerItem {
  if (items.length === 1) return items[0];
  const target = items.map((one) => one.target).join(task === 1 ? " " : "");
  return { ...items[0], target };
}

/**
 * Scores one arm's answer to one task over the new text's rows.
 * - Every item is aligned (by `token`, by `row` id, else by its source) and
 *   every attested item checked; any attested item on a plant row is a
 *   silent invention by rule.
 * - A row's outcome comes from its first item; a join's from all its items
 *   together, in order, since the parts may come apart.
 * - Task 1: a swapped row is right on any of Dee's glosses of the swapped-in
 *   word; wrong on one that agrees only with a gloss of the replaced word
 *   ("recalled"); a join is right only when both parts are rendered, else
 *   it goes to the judges.
 * - Task 2: a join is right joined or apart (`forms`).
 */
export function scoreNewText(
  rows: readonly NewTextRow[],
  items: readonly AnswerItem[],
  task: Task,
  context: NewTextContext,
  options: NewScoreOptions = {},
): NewScores {
  const check = options.emptyContext
    ? { entries: new Map(), rows: new Map() }
    : context.check;
  const aligned = alignItems(
    items,
    rows.map((row) => ({
      id: row.id,
      word: row.enochian,
      english: row.english,
    })),
    task,
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const forRow = new Map<string, AnswerItem[]>();
  const firstCheck = new Map<string, CheckOutcome>();
  const itemScores: NewItemScore[] = aligned.map(({ item, row: id }) => {
    const row = id ? byId.get(id) : undefined;
    let outcome: CheckOutcome;
    if (task === 1 && !row && item.basis === "attested") outcome = "invention";
    else if (row?.kind === "plant" && item.basis === "attested")
      outcome = "invention";
    // Task 1: the item must be about the row's word, in any spelling
    // that counts for it (shown in the GD's, cited as Casaubon's).
    else
      outcome = checkItem(
        item,
        task,
        check,
        task === 1 && row ? [row.enochian, ...row.forms] : undefined,
      );
    if (id) {
      if (!forRow.has(id)) firstCheck.set(id, outcome);
      forRow.set(id, [...(forRow.get(id) ?? []), item]);
    }
    const out: NewItemScore = { check: outcome, basis: item.basis };
    if (id) out.row = id;
    return out;
  });
  const senses = (word: string) =>
    (check.entries.get(normEnochian(word)) ?? []).flatMap((entry) =>
      entry.meanings.map((one) => one.meaning),
    );
  const scored = rows.map((row): NewRowScore => {
    const its = forRow.get(row.id) ?? [];
    const item =
      row.kind === "join" && its.length ? combined(its, task) : its[0];
    const score: NewRowScore = {
      id: row.id,
      sentence: row.sentence,
      kind: row.kind,
      multi: Boolean(row.multi),
      gdSpelling: Boolean(row.gdSpelling),
      outcome: "missing",
    };
    if (item) {
      score.basis = item.basis;
      score.answer = item;
    }
    if (row.kind === "plant") {
      score.outcome = plantOutcome(item, task, check, row.enochian);
      return score;
    }
    score.outcome =
      task === 1 ? task1Outcome(row, item) : task2Outcome(row, item, context);
    if (
      item &&
      row.kind !== "join" &&
      (item.basis !== "attested" || score.outcome === "unknown")
    )
      score.hedged = true;
    if (task === 1 && item && score.outcome !== "unknown") {
      if (
        options.flagAlternatives &&
        listsAlternatives(item.target, senses(row.enochian))
      )
        score.multiSense = true;
      if (firstCheck.get(row.id) === "to judge") score.refToJudge = true;
      if ((score.multiSense || score.refToJudge) && score.outcome === "correct")
        score.outcome = "to judge";
    }
    return score;
  });
  return { task, rows: scored, items: itemScores };
}

/** Task 1 on a row that isn't a plant. */
function task1Outcome(row: NewTextRow, item: AnswerItem | undefined) {
  if (!item) return "missing";
  if (row.kind === "join" && row.join) {
    const outcome = scoreTask1({ english: row.join.english }, item);
    if (outcome === "unknown") return outcome;
    return outcome === "correct" && rendersSmall(row.join.senses, item.target)
      ? "correct"
      : "to judge";
  }
  const glosses = row.glosses ?? [row.english];
  const outcome = glosses.some(
    (english) => scoreTask1({ english }, item) === "correct",
  )
    ? "correct"
    : scoreTask1({ english: row.english }, item);
  if (
    outcome === "to judge" &&
    row.replaced?.glosses.some((gloss) => meaningAgrees(gloss, item.target))
  )
    return "recalled";
  return outcome;
}

/** Task 2 on a row that isn't a plant. */
function task2Outcome(
  row: NewTextRow,
  item: AnswerItem | undefined,
  context: NewTextContext,
) {
  return scoreTask2(
    { word: row.forms[0], gd: row.forms[1], english: row.english },
    item,
    context.synonyms,
    row.forms,
  );
}

// --- The judges ---------------------------------------------------------------------

/**
 * The case one answer sends to the judges (`judge.ts`): its rows still "to
 * judge". Each row shows its word's dictionary meanings as `dictionary` (the
 * prompt's) has them; a swapped row, every English Dee gives the word; a
 * join, both parts, which the answer must render; a ref put to the judges,
 * the text it cites. Its `question` keeps the verdict store from reusing a
 * ruling on another sentence with the same row id (a top-up's).
 */
export function newJudgeCase(
  answer: string,
  rows: readonly NewTextRow[],
  scores: NewScores,
  dictionary: EnochianDictionary,
  keyRows: readonly KeyRowRecord[],
): JudgeCase {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const keyRow = new Map(keyRows.map((row) => [row.id, row]));
  const out: JudgeRow[] = [];
  for (const one of scores.rows) {
    if (one.outcome !== "to judge" || !one.answer) continue;
    const row = byId.get(one.id);
    if (!row) continue;
    // The word as the dictionary spells it: Casaubon's, not the GD's shown.
    const word = row.join
      ? row.join.word
      : (keyRow.get(row.source ?? "")?.word ?? row.enochian);
    const judged: JudgeRow = {
      row: row.id,
      enochian: row.enochian,
      dee: row.english,
      answer: one.answer.target,
      meanings: meaningsOf(word, dictionary),
    };
    if (row.kind === "swapped" && row.glosses?.length)
      judged.senses = row.glosses;
    if (row.join)
      judged.join = {
        small: row.join.small,
        smallSenses: row.join.senses,
        word: row.join.word,
        english: row.join.english,
      };
    if (one.multiSense) judged.alternatives = true;
    if (one.refToJudge && one.answer.ref) {
      const ref = parseRef(one.answer.ref);
      const cited = ref.kind === "row" ? keyRow.get(ref.id) : undefined;
      const text = cited
        ? `Key row ${cited.id}: ${cited.word ?? cited.gd ?? ""} = ${cited.english}`
        : ref.kind === "headword"
          ? `${ref.word}: ${meaningsOf(ref.word, dictionary).join("; ")}`
          : "";
      if (text) judged.cited = { ref: one.answer.ref, text };
    }
    judged.question = JSON.stringify([
      "newtext",
      row.enochian,
      row.english,
      judged.senses ?? [],
      judged.join ?? null,
      judged.meanings,
    ]);
    out.push(judged);
  }
  return { answer, key: 0, rows: out };
}

/**
 * Folds the judges' outcomes into a new-text score: "to judge" rows that
 * have one, for the same translation.
 */
export function applyNewVerdicts(
  scores: NewScores,
  judged: JudgedRows | undefined,
): NewScores {
  if (!judged) return scores;
  for (const one of scores.rows) {
    const verdict = judged[one.id];
    if (!verdict || !sameAnswer(verdict, one.answer?.target)) continue;
    if (one.outcome === "to judge" && verdict.outcome)
      one.outcome = verdict.outcome;
    if (verdict.unsupported && one.refToJudge) one.unsupported = true;
  }
  return scores;
}

/** Several parts' scores as one. */
export function joinNewScores(list: readonly NewScores[]): NewScores {
  return {
    task: list[0]?.task ?? 1,
    rows: list.flatMap((one) => one.rows),
    items: list.flatMap((one) => one.items),
  };
}

// --- Figures ----------------------------------------------------------------------

/** A 95% Wilson score interval for k of n. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half =
    (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** A count over some rows, with its share and interval. */
export interface Share {
  count: number;
  rows: number;
  share: number;
  interval: [number, number];
}

export function share(count: number, rows: number): Share {
  return {
    count,
    rows,
    share: rows ? count / rows : 0,
    interval: wilson(Math.min(count, rows), rows),
  };
}

/** Whether a row counts as right: correct, or a plant that passes. */
export function rowRight(row: NewRowScore): boolean {
  return row.kind === "plant"
    ? PLANT_PASSES.has(row.outcome)
    : row.outcome === "correct";
}

/** One group of rows' figures. */
export interface NewFigures {
  rows: number;
  counts: Partial<Record<NewOutcome, number>>;
  /** Right by script (plants: passed). */
  right: Share;
  /** Right plus "to judge": the most the judges can make it. */
  ifJudged: Share;
  toJudge: number;
  /** Task 1, swapped rows: answered with the replaced word's sense. */
  recalled: Share;
  /** Plants given as attested or guessed without support. */
  plantFailures: Share;
  /** Silent inventions: items, not rows, as the folds count them. */
  silentInventions: number;
  silentInventionsPer100: number;
  malformedRefs: number;
  /** Items marked derived or coined. */
  marked: number;
  hedged: number;
  /** "unknown" on a row that isn't a plant. */
  knowableUnknowns: number;
  multiSense: number;
  /** Rows whose cited reference both judges found doesn't support them. */
  judgedInventions: number;
}

export function newFigures(scores: NewScores): NewFigures {
  const { rows, items } = scores;
  const counts: Partial<Record<NewOutcome, number>> = {};
  for (const one of rows) counts[one.outcome] = (counts[one.outcome] ?? 0) + 1;
  const n = (keep: (row: NewRowScore) => boolean) => rows.filter(keep).length;
  const right = n(rowRight);
  const toJudge = counts["to judge"] ?? 0;
  const silent = items.filter((one) => one.check === "invention").length;
  return {
    rows: rows.length,
    counts,
    right: share(right, rows.length),
    ifJudged: share(right + toJudge, rows.length),
    toJudge,
    recalled: share(
      counts.recalled ?? 0,
      n((row) => row.kind === "swapped"),
    ),
    plantFailures: share(
      n(
        (row) =>
          row.kind === "plant" &&
          (row.outcome === "attested" || row.outcome === "unsupported guess"),
      ),
      n((row) => row.kind === "plant"),
    ),
    silentInventions: silent,
    silentInventionsPer100: rows.length ? (100 * silent) / rows.length : 0,
    malformedRefs: items.filter((one) => one.check === "malformed ref").length,
    marked: items.filter(
      (one) => one.basis === "derived" || one.basis === "coined",
    ).length,
    hedged: n((row) => Boolean(row.hedged)),
    knowableUnknowns: n(
      (row) => row.kind !== "plant" && row.outcome === "unknown",
    ),
    multiSense: n((row) => Boolean(row.multiSense)),
    judgedInventions: n((row) => Boolean(row.unsupported)),
  };
}

/** The groups the figures are given for (plan 077, "Scoring"). */
export const FIGURE_GROUPS = {
  all: () => true,
  unchanged: (row: NewRowScore) => row.kind === "unchanged",
  swapped: (row: NewRowScore) => row.kind === "swapped",
  swappedSingle: (row: NewRowScore) => row.kind === "swapped" && !row.multi,
  swappedMulti: (row: NewRowScore) => row.kind === "swapped" && row.multi,
  unchangedAndSwapped: (row: NewRowScore) =>
    row.kind === "unchanged" || row.kind === "swapped",
  plant: (row: NewRowScore) => row.kind === "plant",
  known: (row: NewRowScore) => row.kind === "known",
  join: (row: NewRowScore) => row.kind === "join",
  gdSpelling: (row: NewRowScore) => row.gdSpelling,
} as const satisfies Record<string, (row: NewRowScore) => boolean>;

export type FigureGroup = keyof typeof FIGURE_GROUPS;

/** Scores narrowed to some rows, with the items aligned to them. */
export function narrow(
  scores: NewScores,
  keep: (row: NewRowScore) => boolean,
): NewScores {
  const rows = scores.rows.filter(keep);
  const ids = new Set(rows.map((one) => one.id));
  return {
    task: scores.task,
    rows,
    items: scores.items.filter((one) => one.row && ids.has(one.row)),
  };
}

/** The figures for every group, pooled first. */
export function newReport(
  scores: NewScores,
): Record<FigureGroup, NewFigures> & { unaligned: number } {
  const out = Object.fromEntries(
    Object.entries(FIGURE_GROUPS).map(([group, keep]) => [
      group,
      newFigures(narrow(scores, keep)),
    ]),
  ) as Record<FigureGroup, NewFigures>;
  return {
    ...out,
    // Items no row claimed count in the pooled silent inventions too.
    all: newFigures(scores),
    unaligned: scores.items.filter((one) => !one.row).length,
  };
}
