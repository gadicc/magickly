import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import { serialiseDictionary, serialiseRow } from "./context.ts";
import { type Effort, shortName } from "./models.ts";
import {
  NEWTEXT_DEFAULTS,
  type NewTextRow,
  type NewTextSet,
  newTextRows,
  withPlantedKnowns,
} from "./newtext.ts";
import {
  CONTEXT_HEAD,
  GRAMMAR_HEAD,
  INSTRUCTIONS,
  NO_MATERIAL,
} from "./prompt.ts";
import type { KeyRowRecord } from "./testset.ts";
import type { ModelRequest } from "./transport.ts";

/**
 * The requests of plan 077's redesign: tasks 1 and 2 on the new text, task 3
 * on new English, and task 3's round trips. Nothing is held out, so every
 * request of a kind carries the same reference material, as one identical
 * prefix a prompt cache can share: the fixed instructions, then the context
 * (dictionary, then all 19 Keys), then for A3 the grammar notes. Tasks 1 and
 * 2 show the dictionary with the planted knowns among its entries; task 3
 * and its round trips show it without them, so they cache apart.
 *
 * The instructions are the folds' (`INSTRUCTIONS`), which say nothing of
 * held-out Keys or tests; the input is a passage to translate.
 */

export type NewArm = "A0" | "A2" | "A3";

export const NEW_ARMS: readonly NewArm[] = ["A0", "A2", "A3"];

/** Which sentences a run covers (plan 077, "Models and budget"). */
export type Subset = "all" | "first30" | "repeat";

export const SUBSETS: readonly Subset[] = ["all", "first30", "repeat"];

export type NewTask = 1 | 2 | 3;

/** What one request on the new text, or on task 3, covers. */
export interface NewSpec {
  arm: NewArm;
  task: NewTask;
  subset: Subset;
  /** The part, from 1. */
  part: number;
  /** The part's sentences, in order ("S03", or "T03" for task 3). */
  sentences: string[];
  model: string;
  effort: Effort;
}

/** One sentence of task 3 (`data/task3-sentences.json`). */
export interface Task3Sentence {
  id: string;
  kind: string;
  english: string;
}

/** What one round-trip request translates back. */
export interface RoundTripSpec {
  part: number;
  /** Each candidate's blind id and its Enochian. */
  input: { id: string; enochian: string }[];
  model: string;
  effort: Effort;
}

/** The rows a part of tasks 1 and 2 aims at ("parts of about 75 rows"). */
export const PART_ROWS = 75;

/**
 * Task 3's sentences a part: about 20, so its three kinds of 20 make three
 * parts. A task-3 answer has an item for every Enochian word, about 200 to
 * a part, so it is far longer than a part of task 1 or 2.
 */
export const TASK3_PART_SENTENCES = 20;

/** Round-trip candidates a request. */
export const ROUND_TRIP_PART = 20;

/**
 * Splits units into about `total / target` parts, only between units: each
 * break at the unit end nearest its share of the total.
 */
export function partsOf<T>(
  units: readonly T[],
  size: (unit: T) => number,
  target: number,
): T[][] {
  const total = units.reduce((sum, one) => sum + size(one), 0);
  const n = Math.max(1, Math.min(units.length, Math.round(total / target)));
  const ends: number[] = [];
  let sum = 0;
  for (const one of units) ends.push((sum += size(one)));
  const breaks: number[] = [];
  let from = 0;
  for (let k = 1; k < n; k++) {
    const want = (k * total) / n;
    // Leave at least one unit for each part still to come.
    const last = units.length - (n - k);
    let best = from;
    for (let i = from; i < last; i++)
      if (Math.abs(ends[i] - want) < Math.abs(ends[best] - want)) best = i;
    breaks.push(best + 1);
    from = best + 1;
  }
  const out: T[][] = [];
  let start = 0;
  for (const end of [...breaks, units.length]) {
    out.push(units.slice(start, end));
    start = end;
  }
  return out;
}

/** The new text's sentences a subset covers, in order. */
export function subsetSentences(set: NewTextSet, subset: Subset) {
  if (subset === "all") return set.sentences;
  if (subset === "first30")
    return set.sentences.filter(
      (one) => Number(one.id.slice(1)) <= NEWTEXT_DEFAULTS.firstSentences,
    );
  const repeat = new Set(set.repeat.sentences);
  return set.sentences.filter((one) => repeat.has(one.id));
}

/** The parts of a subset of the new text: lists of sentence ids. */
export function newTextParts(set: NewTextSet, subset: Subset): string[][] {
  return partsOf(
    subsetSentences(set, subset),
    (one) => one.rows.length,
    PART_ROWS,
  ).map((part) => part.map((one) => one.id));
}

/** Task 3's parts: lists of sentence ids. */
export function task3Parts(sentences: readonly Task3Sentence[]): string[][] {
  return partsOf(sentences, () => 1, TASK3_PART_SENTENCES).map((part) =>
    part.map((one) => one.id),
  );
}

/**
 * A request's id. They start "N-" (the new text) or "T3-" (task 3), so they
 * never collide with a fold's ("A3-t1-open-k04-…") or with each other.
 */
export function newRequestId(spec: NewSpec): string {
  const part = `p${String(spec.part).padStart(2, "0")}`;
  const tail = [part, shortName(spec.model), spec.effort];
  return spec.task === 3
    ? ["T3", spec.arm, ...tail].join("-")
    : ["N", spec.arm, `t${spec.task}`, spec.subset, ...tail].join("-");
}

export function roundTripId(spec: RoundTripSpec): string {
  return [
    "RT",
    `p${String(spec.part).padStart(2, "0")}`,
    shortName(spec.model),
    spec.effort,
  ].join("-");
}

/** What the new requests are built from. */
export interface NewPromptData {
  /** The dictionary as published, without the planted knowns. */
  dictionary: EnochianDictionary;
  /** Every Key's rows. */
  rows: readonly KeyRowRecord[];
  /** `grammar.md`, whole: nothing is held out. */
  grammar: string;
  newText?: NewTextSet;
  task3?: readonly Task3Sentence[];
}

/**
 * The reference material: the dictionary, then all 19 Keys row by row. The
 * same text for every request with the same dictionary.
 */
export function newContext(
  dictionary: EnochianDictionary,
  rows: readonly KeyRowRecord[],
): string {
  return [
    CONTEXT_HEAD,
    "",
    "# Dictionary (WORD\tmeaning [source]; …)",
    serialiseDictionary(dictionary),
    "",
    "# The Keys (Key.row\tword\tDee's English)",
    ...rows.map((row) => serialiseRow(row)),
    "",
  ].join("\n");
}

/** The prompt's dictionary for tasks 1 and 2: with the planted knowns. */
export function tasks12Dictionary(data: NewPromptData): EnochianDictionary {
  if (!data.newText) throw new Error("No new text loaded");
  return withPlantedKnowns(data.dictionary, data.newText.plantedKnowns);
}

/** The new text's task texts: the input is a passage to translate. */
export const NEW_TASK_TEXT: Record<NewTask, string> = {
  1: `Translate this Enochian passage into English. Each line is a sentence; its words are numbered in square brackets, counting on through the passage. Give one item for each numbered word, in order, with the word as "source" and its number as "token".`,
  2: `Translate this English passage into Enochian. Each line is a row id, a tab, and the English for one Enochian word; a blank line ends a sentence. Give one item for each row, in order, with the row id as "row", the English as "source" and one Enochian word as "target".`,
  3: `Translate these English sentences into Enochian. Each line is a sentence id, a tab, and the sentence. Give one item for each Enochian word of your translation, in the order of your translation, with the sentence id as "row", the English it renders as "source" (a word or a few words) and the Enochian word as "target". Every sentence needs at least one item.`,
};

/** A part's rows of the new text, in order. */
export function partRows(set: NewTextSet, sentences: readonly string[]) {
  const wanted = new Set(sentences);
  const rows = newTextRows(set).filter((one) => wanted.has(one.sentence));
  if (new Set(rows.map((one) => one.sentence)).size !== wanted.size)
    throw new Error(`Unknown sentence in ${sentences.join(",")}`);
  return rows;
}

/** Task 1's input: a sentence a line, its words numbered through the part. */
export function newTask1Input(rows: readonly NewTextRow[]): string {
  const lines: string[] = [];
  let sentence = "";
  rows.forEach((row, i) => {
    const word = `[${i + 1}] ${row.enochian}`;
    if (row.sentence === sentence) lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
    sentence = row.sentence;
  });
  return lines.join("\n");
}

/** Task 2's input: a row a line, a blank line between sentences. */
export function newTask2Input(rows: readonly NewTextRow[]): string {
  return rows
    .map(
      (row, i) =>
        `${i && rows[i - 1].sentence !== row.sentence ? "\n" : ""}${row.id}\t${row.english}`,
    )
    .join("\n");
}

/** Task 3's input: a sentence a line, with its id. */
export function task3Input(sentences: readonly Task3Sentence[]): string {
  return sentences.map((one) => `${one.id}\t${one.english}`).join("\n");
}

/** One request on the new text or task 3, ready for a transport. */
export function newRequest(spec: NewSpec, data: NewPromptData): ModelRequest {
  const instructions = [INSTRUCTIONS];
  let input: string;
  if (spec.task === 3) {
    const byId = new Map((data.task3 ?? []).map((one) => [one.id, one]));
    const sentences = spec.sentences.map((id) => {
      const one = byId.get(id);
      if (!one) throw new Error(`No task-3 sentence ${id}`);
      return one;
    });
    if (spec.arm !== "A0")
      instructions.push(newContext(data.dictionary, data.rows));
    input = task3Input(sentences);
  } else {
    const rows = partRows(
      data.newText as NewTextSet,
      spec.sentences,
    ) as NewTextRow[];
    if (spec.arm !== "A0")
      instructions.push(newContext(tasks12Dictionary(data), data.rows));
    input = spec.task === 1 ? newTask1Input(rows) : newTask2Input(rows);
  }
  if (spec.arm === "A3")
    instructions.push(`${GRAMMAR_HEAD}\n\n${data.grammar.trim()}`);
  return {
    id: newRequestId(spec),
    kind: "translate",
    model: spec.model,
    effort: spec.effort,
    instructions,
    prompt: [
      ...(spec.arm === "A0" ? [NO_MATERIAL] : []),
      NEW_TASK_TEXT[spec.task],
      "",
      input,
    ].join("\n"),
  };
}

/** The choices a run on the new text or task 3 takes. */
export interface NewChoice {
  arms: readonly NewArm[];
  /** 1 and 2 for the new text; 3 for task 3. */
  tasks: readonly NewTask[];
  subset: Subset;
  model: string;
  efforts: readonly Effort[];
}

/** Every request a run makes: each arm, task, effort and part. */
export function planNewSpecs(
  choice: NewChoice,
  data: Pick<NewPromptData, "newText" | "task3">,
): NewSpec[] {
  const out: NewSpec[] = [];
  for (const arm of choice.arms)
    for (const task of choice.tasks) {
      if (task === 3 && choice.subset !== "all")
        throw new Error("Task 3 runs on all its sentences (--subset all)");
      const parts =
        task === 3
          ? task3Parts(data.task3 ?? [])
          : newTextParts(data.newText as NewTextSet, choice.subset);
      for (const effort of choice.efforts)
        parts.forEach((sentences, i) =>
          out.push({
            arm,
            task,
            subset: choice.subset,
            part: i + 1,
            sentences,
            model: choice.model,
            effort,
          }),
        );
    }
  return out;
}

// --- Round trips ---------------------------------------------------------------

/**
 * The round trip's instructions (plan 077, "Scoring"): Enochian back into
 * English with only the dictionary, no Keys, no grammar notes, no English.
 */
export const ROUND_TRIP_INSTRUCTIONS = `You translate Enochian, the language of the Keys (Calls) that John Dee and Edward Kelley recorded, into English, using only the dictionary that follows: one entry a line, the word, a tab, then its meanings, each with its source in brackets.

Each line of the input is an id, a tab, and a sentence of Enochian. Translate each sentence into plain English, as well as the dictionary allows. Where a word is not in the dictionary, keep it as it is, in capitals.

Work it through as you need to, then end your reply with one fenced code block marked json, holding an object with one field, "sentences": a list with one entry per input line, each {"id": the id, "english": your translation}. Write nothing after the block.`;

/** The round trip's context: the dictionary alone, without planted knowns. */
export function roundTripContext(dictionary: EnochianDictionary): string {
  return [
    "Reference material: our dictionary.",
    "",
    "# Dictionary (WORD\tmeaning [source]; …)",
    serialiseDictionary(dictionary),
    "",
  ].join("\n");
}

export function roundTripRequest(
  spec: RoundTripSpec,
  dictionary: EnochianDictionary,
): ModelRequest {
  return {
    id: roundTripId(spec),
    kind: "translate",
    model: spec.model,
    effort: spec.effort,
    instructions: [ROUND_TRIP_INSTRUCTIONS, roundTripContext(dictionary)],
    prompt: spec.input.map((one) => `${one.id}\t${one.enochian}`).join("\n"),
  };
}
