import type { Report } from "./score.ts";

/**
 * The withdrawn design's bars (plan 077, "Thresholds", settled 11 November
 * 2026), for the held-out Keys, and the experiment's figures for each. The
 * new text's bars replaced them in `src/app/enochian/translate/bars.ts` on
 * 12 November; these stay with the held-out-Key path (`run --set folds`,
 * `report`), kept for models the recall probe doesn't flag. Plan 077 still
 * quotes them word for word, and `heldout-bars.test.ts` keeps the two equal.
 */

/** When the bars were settled. */
export const HELDOUT_BARS_SETTLED = "2026-11-11";

/** How a bar's value reads. */
export type BarUnit =
  /** A fraction of rows or sentences, shown as a percentage. */
  | "share"
  /** A difference between two shares, shown as percentage points. */
  | "points"
  /** A count per 100 scoreable rows. */
  | "per100";

export interface HeldOutBar {
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
  spec: Omit<HeldOutBar, "rule"> & { rule: (value: string) => string },
): HeldOutBar {
  return { ...spec, rule: spec.rule(formatBarValue(spec.value, spec.unit)) };
}

/** Every bar, in the order the plan and the page list them. */
export const HELDOUT_BARS: readonly HeldOutBar[] = [
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
  bar: HeldOutBar;
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
  return HELDOUT_BARS.map((one) => {
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
    results.length === HELDOUT_BARS.length &&
    results.every((one) => one.met === true)
  );
}

/** What the bars are measured from. Leave out what hasn't run yet. */
export interface BarInputs {
  /** A3, task 1, open book, all 19 Keys. */
  a3Task1?: Report;
  /** A3, task 2, open book, all 19 Keys. */
  a3Task2?: Report;
  /** A2 and A2c, task 1, open book, narrowed to the unflagged Keys. */
  a2Unflagged?: Report;
  a2cUnflagged?: Report;
  /**
   * Task 3: the share of sentences both judges accept, the share whose round
   * trip keeps the meaning, and silent inventions per 100 English words (the
   * same checker as tasks 1 and 2, on every item of every sentence).
   */
  task3?: { judged: number; roundTrip: number; silentPer100: number };
}

/** The fewest unflagged Keys the memory bar can be tested on (plan 077). */
export const MIN_UNFLAGGED_KEYS = 5;

/**
 * A task-1 report must have its judge verdicts folded in first: no row left
 * "to judge", in the arm or in A1's hard-row marks. Otherwise the figure
 * would silently count every judged row as wrong. The judges' step
 * (`judge.ts`, the `judge` and `judge-a1` commands) folds them in.
 */
function judged(name: string, r: Report): Report {
  if ((r.pooled.all.counts["to judge"] ?? 0) > 0)
    throw new Error(`${name}: judge its "to judge" rows first`);
  if (r.a1ToJudge.all.rows > 0)
    throw new Error(`${name}: judge A1's "to judge" rows first (hard rows)`);
  return r;
}

/** Each bar's measured figure, where the inputs allow it. */
export function measureBars(
  inputs: BarInputs,
): Partial<Record<BarId, Measured>> {
  const out: Partial<Record<BarId, Measured>> = {};
  const silent: number[] = [];
  if (inputs.a3Task1) {
    const r = judged("A3 task 1", inputs.a3Task1);
    out.toEnglish = r.pooled.headline;
    out.toEnglishHard = r.hard.headline;
    silent.push(r.pooled.all.silentInventionsPer100);
  }
  if (inputs.a3Task2) {
    out.toEnochian = inputs.a3Task2.pooled.headline;
    silent.push(inputs.a3Task2.pooled.all.silentInventionsPer100);
  }
  const { a2Unflagged: a2, a2cUnflagged: a2c } = inputs;
  if (a2 && a2c) {
    const keys = (r: Report) => r.perKey.map((one) => one.key).join(",");
    if (keys(a2) !== keys(a2c))
      throw new Error("A2 and A2c must cover the same unflagged Keys");
    out.notMemory =
      a2.perKey.length < MIN_UNFLAGGED_KEYS
        ? {
            unmeasurable: `only ${a2.perKey.length} Keys are not recited from memory; the bar needs ${MIN_UNFLAGGED_KEYS}`,
          }
        : judged("A2 task 1", a2).pooled.headline -
          judged("A2c task 1", a2c).pooled.headline;
  }
  if (inputs.task3) {
    out.newSentencesJudged = inputs.task3.judged;
    out.newSentencesRoundTrip = inputs.task3.roundTrip;
    silent.push(inputs.task3.silentPer100);
  }
  // "In every task": only once all three tasks have run.
  if (silent.length === 3) out.silentInventions = Math.max(...silent);
  return out;
}
