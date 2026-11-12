/**
 * The bars an Enochian translator must clear before it is built (plan 077,
 * "Bars for the new text"), settled 12 November 2026: after lookup (A1 and
 * A1k) was scored on the new text and before any model translated it.
 *
 * This file is the only place the numbers live. The experiment's scorer
 * (`scripts/enochian-translate-eval/newbars.ts`) measures its results
 * against them, plan 077 quotes each bar word for word (`bars.test.ts` keeps
 * the two equal), and the translator page, if one is built, shows them
 * beside the measured figures so readers see its limits. The withdrawn
 * design's bars (11 November) live with the scripts, in `heldout-bars.ts`.
 */

/** When the bars were settled. Changing a bar means a new date. */
export const BARS_SETTLED = "2026-11-12";

/** How a bar's value reads. */
export type BarUnit =
  /** A fraction of rows, sentences or calls, shown as a percentage. */
  | "share"
  /** A number per 100 rows. */
  | "per100";

export type BarId =
  | "toEnglish"
  | "toEnochian"
  | "swappedRight"
  | "recalled"
  | "plantFailures"
  | "knownsRight"
  | "joinsRight"
  | "silentInventions"
  | "task3Accept"
  | "task3RoundTrip"
  | "task3AttestedForms"
  | "blocked";

export interface TranslatorBar {
  id: BarId;
  /** One sentence stating the bar, for readers, written from its value. */
  rule: string;
  /** How the figure is measured: arm, model, task, rows. */
  measure: string;
  /** What passing it shows. */
  shows: string;
  /** "min": the measured count must be at least the line; "max": at most. */
  kind: "min" | "max";
  /**
   * The value as a fraction of whole numbers, so a line in rows is exact:
   * 96.8% is [968, 1000]. The line scales with the rows measured, so a
   * top-up pooled in moves it.
   */
  value: readonly [number, number];
  unit: BarUnit;
  /** The rows (sentences, calls) planned, for the count the rule gives. */
  planned?: number;
  /**
   * The rows can't change (task 3's sentences): measured on any other
   * number of rows, the bar is unmeasurable.
   */
  fixedRows?: true;
  /**
   * The planted knowns' bar: A0 (no context) may get at most this many,
   * on its own `planned` rows (A0 isn't topped up).
   */
  a0AtMost?: number;
}

/** A bar's value as the rule says it: "96.8%", "two thirds", "2". */
export function formatBarValue(
  value: readonly [number, number],
  unit: BarUnit,
): string {
  const [of, per] = value;
  if (unit === "per100") return String((100 * of) / per);
  if (of * 3 === per * 2) return "two thirds";
  return `${Math.round((1000 * of) / per) / 10}%`;
}

/**
 * The count a bar needs on `rows`: the fewest that meet a "min" bar, the
 * most that meet a "max" one. Whole-number arithmetic, so 484 of 500 meets
 * 96.8% and 483 doesn't, with no floating-point surprise at the line.
 */
export function countLine(
  bar: Pick<TranslatorBar, "kind" | "value">,
  rows: number,
): number {
  const [of, per] = bar.value;
  const product = of * rows;
  const rest = product % per;
  const whole = (product - rest) / per;
  return bar.kind === "min" && rest ? whole + 1 : whole;
}

/** The values a rule is written from. */
interface RuleValues {
  value: string;
  /** The count needed on the planned rows. */
  needs: number;
  /** The rows planned. */
  of: number;
  /** The knowns' ceiling for A0. */
  a0: number;
}

/** A bar whose rule is written from its value, so the two can't disagree. */
function bar(
  spec: Omit<TranslatorBar, "rule"> & { rule: (v: RuleValues) => string },
): TranslatorBar {
  const of = spec.planned ?? 0;
  return {
    ...spec,
    rule: spec.rule({
      value: formatBarValue(spec.value, spec.unit),
      needs: countLine(spec, of),
      of,
      a0: spec.a0AtMost ?? 0,
    }),
  };
}

/**
 * The judges' check that task 3's two judged bars rest on (plan 077, "The
 * judges are checked"), settled with the bars: damaged controls, each
 * counting only if both judges accepted its undamaged original.
 */
export const JUDGES_CHECK = {
  /** Damaged controls made, a third of each kind. */
  controls: 15,
  /** The fewest that must count. */
  minCounted: 8,
  /** The most of those that count the judges may accept, as a fraction. */
  maxAccepted: [1, 5] as readonly [number, number],
} as const;

/** The judges' check in one sentence, as plan 077 quotes it. */
export const JUDGES_CHECK_RULE = `The judges' check: ${JUDGES_CHECK.controls} damaged controls, a third of each kind; at least ${JUDGES_CHECK.minCounted} must count, and the judges may accept at most ${
  JUDGES_CHECK.maxAccepted[0] === 1 && JUDGES_CHECK.maxAccepted[1] === 5
    ? "a fifth"
    : `${JUDGES_CHECK.maxAccepted[0]} in ${JUDGES_CHECK.maxAccepted[1]}`
} of those that do, or neither judged bar of task 3 can be measured.`;

/**
 * Whether the judges pass the check: enough controls count, and they
 * accepted no more than the ceiling of those, in whole numbers.
 */
export function judgesPass(counted: number, accepted: number): boolean {
  const [of, per] = JUDGES_CHECK.maxAccepted;
  return counted >= JUDGES_CHECK.minCounted && accepted * per <= counted * of;
}

/** Task 3's sentence kinds whose round trip is barred. */
export const ROUND_TRIP_KINDS: readonly string[] = ["practitioner", "attested"];

/** Every bar, in the order the plan and the page list them. */
export const TRANSLATOR_BARS: readonly TranslatorBar[] = [
  bar({
    id: "toEnglish",
    rule: (v) =>
      `Enochian to English, unchanged and swapped rows: at least ${v.value} (${v.needs} of ${v.of}).`,
    measure:
      "Arm A3 on Opus, task 1, judged; a row the judges disagree on counts as wrong. A fixed figure: A1k's judged 98.8% (494 of 500) less 2 points.",
    shows: "no worse than lookup",
    kind: "min",
    value: [968, 1000],
    unit: "share",
    planned: 500,
  }),
  bar({
    id: "toEnochian",
    rule: (v) =>
      `English to Enochian, unchanged and swapped rows: at least ${v.value} (${v.needs} of ${v.of}).`,
    measure:
      "Arm A3 on Opus, task 2. Right means Casaubon's form or the Equinox reading after normalising spelling. A fixed figure: A1k's 96.0% (480 of 500) less 3 points.",
    shows: "no worse than lookup",
    kind: "min",
    value: [93, 100],
    unit: "share",
    planned: 500,
  }),
  bar({
    id: "swappedRight",
    rule: (v) =>
      `Swapped rows right, task 1: at least ${v.value} (${v.needs} of ${v.of}).`,
    measure:
      "Arm A3 on Opus. Any gloss Dee gives the swapped-in word counts as right.",
    shows: "reads the word in front of it",
    kind: "min",
    value: [9, 10],
    unit: "share",
    planned: 120,
  }),
  bar({
    id: "recalled",
    rule: (v) =>
      `Recalled answers, task 1: at most ${v.value} of swapped rows (${v.needs} of ${v.of}).`,
    measure:
      "Arm A3 on Opus. An answer is recalled when it agrees with the word that stood there before the swap, and not with the key.",
    shows: "not misled by memory",
    kind: "max",
    value: [5, 100],
    unit: "share",
    planned: 120,
  }),
  bar({
    id: "plantFailures",
    rule: (v) =>
      `Planted unknowns given as attested, or guessed without support: at most ${v.value} (${v.needs} of ${v.of}), each task.`,
    measure:
      "Arm A3 on Opus, tasks 1 and 2, each on its own. A derived reading must cite a form of three letters or more found inside the word.",
    shows: "honest about words that don't exist",
    kind: "max",
    value: [1, 10],
    unit: "share",
    planned: 40,
  }),
  bar({
    id: "knownsRight",
    rule: (v) =>
      `Planted knowns right, task 1: at least ${v.needs} of ${v.of} (${v.value}), with A0 at most ${v.a0}.`,
    measure:
      "Arm A3 on Opus. The knowns are made-up words given a meaning only in the prompt's dictionary. With a top-up pooled in, the line is 90% of all the knowns. A0 is Opus with no context, on the 20 knowns of the main set.",
    shows: "reads the prompt, not its memory",
    kind: "min",
    value: [9, 10],
    unit: "share",
    planned: 20,
    a0AtMost: 1,
  }),
  bar({
    id: "joinsRight",
    rule: (v) =>
      `New joins right, both parts, task 1: at least ${v.value} (${v.needs} of ${v.of}).`,
    measure:
      "Arm A3 on Opus. A join is right only when both its parts are rendered.",
    shows: "more than lookup: applies the grammar",
    kind: "min",
    value: [8, 10],
    unit: "share",
    planned: 40,
  }),
  bar({
    id: "silentInventions",
    rule: (v) =>
      `Silent inventions: at most ${v.value} per 100 rows, every task (task 3: per 100 words given).`,
    measure:
      "Arm A3 on Opus, each task on its own. A silent invention is a word given as found in our data that isn't: the reference is missing or not in the context, or names another word.",
    shows: "honest about its sources",
    kind: "max",
    value: [2, 100],
    unit: "per100",
  }),
  bar({
    id: "task3Accept",
    rule: (v) =>
      `Task 3, both judges accept: at least ${v.value} of all ${v.of} sentences (${v.needs}).`,
    measure:
      "Arm A3 on Opus, judged by Opus and GPT-6.1 against the rubric; a missing translation counts as rejected. It is measured only if the judges pass the damaged controls.",
    shows: "composes well enough for the judges",
    kind: "min",
    value: [2, 3],
    unit: "share",
    planned: 60,
    fixedRows: true,
  }),
  bar({
    id: "task3RoundTrip",
    rule: (v) =>
      `Task 3, round trip keeps the meaning: at least ${v.value} of the ${v.of} practitioner and attested sentences (${v.needs} of ${v.of}).`,
    measure:
      "Arm A3 on Opus. A separate call puts the Enochian back into English with only the dictionary, and both judges compare the two. The 20 everyday sentences are reported but not barred: a coined word can't survive a round trip through a dictionary.",
    shows: "the meaning survives",
    kind: "min",
    value: [2, 3],
    unit: "share",
    planned: 40,
    fixedRows: true,
  }),
  bar({
    id: "task3AttestedForms",
    rule: (v) =>
      `Task 3, content words given an attested form where one exists: at least ${v.value}.`,
    measure:
      "Arm A3 on Opus. A word has a form where dictionary lookup (A1) finds one. A floor: A1 scores 100% by construction.",
    shows: "uses our data when it can",
    kind: "min",
    value: [9, 10],
    unit: "share",
  }),
  bar({
    id: "blocked",
    rule: (v) =>
      `Opus translation calls blocked by the provider's filter: at most ${v.value}, counted over every call.`,
    measure:
      "Every Opus translation call in the experiment: the cache check, every task, the repeats, the top-up and the round trips. It is measured once Opus A3 has run on the new text.",
    shows: "usable at all",
    kind: "max",
    value: [5, 100],
    unit: "share",
  }),
];

/** A bar by its id. */
export function barById(id: BarId): TranslatorBar {
  const found = TRANSLATOR_BARS.find((one) => one.id === id);
  if (!found) throw new Error(`No bar ${id}`);
  return found;
}
