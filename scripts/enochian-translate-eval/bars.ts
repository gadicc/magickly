import type { BarId, Measured } from "../../src/app/enochian/translate/bars.ts";
import type { Report } from "./score.ts";

/**
 * The experiment's figures for each bar in `src/app/enochian/translate/bars.ts`
 * (plan 077, "Thresholds"). The bars themselves live there; this only reads
 * them off the reports.
 */

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
 * would silently count every judged row as wrong. (The judges' step that
 * folds them in is not built yet; see plan 077, "Where the work lives".)
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
