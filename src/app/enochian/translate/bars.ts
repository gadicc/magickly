/**
 * The bars an Enochian translator must clear before it is built (plan 077,
 * "Thresholds"), settled 11 November 2026.
 *
 * This file is the only place the numbers live. The experiment's scorer
 * checks its results against them, plan 077 quotes each bar word for word
 * (`bars.test.ts` keeps the two equal), and the translator page, if one is
 * built, shows them beside the measured figures so readers see its limits.
 */

/** When the bars were settled. Changing a bar means a new date. */
export const BARS_SETTLED = "2026-11-11";

/** How a bar's value reads. */
export type BarUnit =
  /** A fraction of rows or sentences, shown as a percentage. */
  | "share"
  /** A difference between two shares, shown as percentage points. */
  | "points"
  /** A count per 100 scoreable rows. */
  | "per100";

export interface TranslatorBar {
  id: BarId;
  /** One sentence stating the bar, for readers. */
  rule: string;
  /** How the figure is measured: arm, task, rows. */
  measure: string;
  /** "min": the measured figure must be at least `value`; "max": at most. */
  kind: "min" | "max";
  value: number;
  unit: BarUnit;
}

export type BarId =
  | "toEnglish"
  | "toEnglishHard"
  | "toEnochian"
  | "notMemory"
  | "silentInventions"
  | "newSentencesJudged"
  | "newSentencesRoundTrip";

/** A bar's value as the rule says it: "90%", "two thirds", "10 points". */
export function formatBarValue(value: number, unit: BarUnit): string {
  if (unit === "per100") return String(value);
  if (Math.abs(value - 2 / 3) < 1e-9) return "two thirds";
  const percent = Math.round(value * 1000) / 10;
  return unit === "points" ? `${percent} points` : `${percent}%`;
}

/** A bar whose rule is written from its value, so the two can't disagree. */
function bar(
  spec: Omit<TranslatorBar, "rule"> & { rule: (value: string) => string },
): TranslatorBar {
  return { ...spec, rule: spec.rule(formatBarValue(spec.value, spec.unit)) };
}

/** Every bar, in the order the plan and the page list them. */
export const TRANSLATOR_BARS: readonly TranslatorBar[] = [
  bar({
    id: "toEnglish",
    rule: (v) => `Enochian to English: at least ${v} of rows right.`,
    measure:
      'Arm A3, open book, pooled over the 19 held-out Keys. A row is right when it shares a content word with Dee\'s English (where his English is only words like "of" or "I", when it uses the same ones), by script or by both judges; a row the judges disagree on counts as wrong.',
    kind: "min",
    value: 0.9,
    unit: "share",
  }),
  bar({
    id: "toEnglishHard",
    rule: (v) =>
      `Enochian to English: at least ${v} of the rows that word-by-word dictionary lookup gets wrong.`,
    measure:
      "Arm A3, open book, on the rows where A1 (lookup, no model) is wrong: wrong by script, or sent to the judges and not accepted by both.",
    kind: "min",
    value: 0.5,
    unit: "share",
  }),
  bar({
    id: "toEnochian",
    rule: (v) => `English to Enochian: at least ${v} of rows right.`,
    measure:
      "Arm A3, open book, pooled, given Dee's English row by row. Right means Casaubon's form or the Equinox reading after normalising spelling; synonyms and near misses don't count.",
    kind: "min",
    value: 0.75,
    unit: "share",
  }),
  bar({
    id: "notMemory",
    rule: (v) =>
      `With the Enochian scrambled, Enochian-to-English accuracy drops by at most ${v}.`,
    measure:
      "A2 minus A2c (the same context under a letter substitution), task 1, open book, pooled over the Keys the recall probe does not flag. It needs at least five unflagged Keys.",
    kind: "max",
    value: 0.1,
    unit: "points",
  }),
  bar({
    id: "silentInventions",
    rule: (v) =>
      `At most ${v} unmarked invented words per 100 rows, in every task.`,
    measure:
      "Arm A3, open book. Words given as found in our data that aren't: the reference is missing or not in the context, it isn't the word being translated, or the word isn't in the input at all. Counted per 100 scoreable rows (in task 3, per 100 English words); unreadable references are counted apart. The worst of the three tasks counts.",
    kind: "max",
    value: 2,
    unit: "per100",
  }),
  bar({
    id: "newSentencesJudged",
    rule: (v) => `New English sentences: both judges accept at least ${v}.`,
    measure:
      "Task 3, about 30 sentences, arm A3; judged by Opus and GPT-6.1 against the rubric, and a sentence counts only if both accept it.",
    kind: "min",
    value: 2 / 3,
    unit: "share",
  }),
  bar({
    id: "newSentencesRoundTrip",
    rule: (v) =>
      `New English sentences: translating back keeps the meaning of at least ${v}.`,
    measure:
      "A separate call translates the Enochian back using only the dictionary, and both judges compare the two English versions.",
    kind: "min",
    value: 2 / 3,
    unit: "share",
  }),
];

/**
 * A measured figure, or why the bar can't be measured on these results
 * (for example, too few Keys left once memorised ones are set aside). A bar
 * that can't be measured is never met, and says so rather than "not run".
 */
export type Measured = number | { unmeasurable: string };

/** One bar against a measured figure. `met` is undefined when unmeasured. */
export interface BarResult {
  bar: TranslatorBar;
  measured?: number;
  /** Why it can't be measured, when it can't. */
  unmeasurable?: string;
  met?: boolean;
}

/**
 * Shares are ratios of row counts, so a figure exactly at a bar can come out
 * a hair either side of it in floating point (0.8 - 0.7 > 0.1).
 */
const EPSILON = 1e-9;

/** Every bar against the figures measured so far. */
export function checkBars(
  measured: Partial<Record<BarId, Measured>>,
): BarResult[] {
  return TRANSLATOR_BARS.map((one) => {
    const value = measured[one.id];
    if (typeof value === "object")
      return { bar: one, unmeasurable: value.unmeasurable };
    if (value === undefined || Number.isNaN(value)) return { bar: one };
    const met =
      one.kind === "min"
        ? value >= one.value - EPSILON
        : value <= one.value + EPSILON;
    return { bar: one, measured: value, met };
  });
}

/** Whether every bar is measured and met: the plan's condition to build. */
export function allBarsMet(results: readonly BarResult[]): boolean {
  return (
    results.length === TRANSLATOR_BARS.length &&
    results.every((one) => one.met === true)
  );
}
