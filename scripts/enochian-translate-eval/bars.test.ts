import { describe, expect, it } from "vitest";
import { MIN_UNFLAGGED_KEYS, measureBars } from "./bars.ts";
import { type Outcome, type RowScore, report } from "./score.ts";

/** A report from bare rows: one row per [key, outcome, A1's outcome]. */
function made(rows: [number, Outcome, string][]) {
  const scores = rows.map(
    ([key, outcome, a1], i): RowScore => ({
      id: `${key}.${i}`,
      key,
      outcome,
      a1,
      singleKey: false,
      knowableClosed: true,
      knowableOpen: true,
    }),
  );
  return report({ rows: scores, items: [] }, "open");
}

describe("measuring the bars", () => {
  it("reads task 1 overall and on lookup's wrong rows", () => {
    const a3Task1 = made([
      [1, "correct", "correct"],
      [1, "correct", "wrong"],
      [1, "missing", "unknown"],
      [2, "correct", "correct"],
    ]);
    const out = measureBars({ a3Task1 });
    expect(out.toEnglish).toBe(0.75);
    expect(out.toEnglishHard).toBe(0.5);
    // Inventions count only once every task has run.
    expect(out.silentInventions).toBeUndefined();
  });

  it("refuses rows still waiting for the judges", () => {
    expect(() =>
      measureBars({ a3Task1: made([[1, "to judge", "correct"]]) }),
    ).toThrow(/judge/);
    expect(() =>
      measureBars({ a3Task1: made([[1, "correct", "to judge"]]) }),
    ).toThrow(/A1/);
  });

  it("tests memory only on enough unflagged Keys", () => {
    const keys = (outcome: Outcome, n: number) =>
      made(
        Array.from(
          { length: n },
          (_, i) => [i + 1, outcome, "correct"] as [number, Outcome, string],
        ),
      );
    const enough = MIN_UNFLAGGED_KEYS;
    expect(
      measureBars({
        a2Unflagged: keys("correct", enough),
        a2cUnflagged: keys("missing", enough),
      }).notMemory,
    ).toBe(1);
    expect(
      measureBars({
        a2Unflagged: keys("correct", enough - 1),
        a2cUnflagged: keys("missing", enough - 1),
      }).notMemory,
    ).toEqual({ unmeasurable: expect.stringMatching(/only 4 Keys/) });
    expect(() =>
      measureBars({
        a2Unflagged: keys("correct", enough),
        a2cUnflagged: keys("correct", enough + 1),
      }),
    ).toThrow(/same unflagged Keys/);
  });

  it("takes the worst task's silent inventions", () => {
    const r = made([[1, "correct", "correct"]]);
    const out = measureBars({
      a3Task1: r,
      a3Task2: r,
      task3: { judged: 0.7, roundTrip: 0.8, silentPer100: 3 },
    });
    expect(out.silentInventions).toBe(3);
    expect(out.newSentencesJudged).toBe(0.7);
    expect(out.toEnochian).toBe(1);
  });
});
