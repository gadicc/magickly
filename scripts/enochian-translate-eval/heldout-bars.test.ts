import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allBarsMet,
  checkBars,
  formatBarValue,
  HELDOUT_BARS,
  HELDOUT_BARS_SETTLED,
  MIN_UNFLAGGED_KEYS,
  measureBars,
} from "./heldout-bars.ts";
import { type Outcome, type RowScore, report } from "./score.ts";

const plan = readFileSync(
  new URL("../../plans/077-enochian-translator-experiment.md", import.meta.url),
  "utf8",
);
/** Markdown wraps lines and indents list items; compare words only. */
const flat = (text: string) => text.replace(/\s+/g, " ");

describe("the withdrawn design's bars", () => {
  it("are quoted word for word in plan 077, in order", () => {
    const start = plan.indexOf("### Thresholds");
    const section = plan.slice(start, plan.indexOf("## Where the work lives"));
    const list = section.slice(
      section.indexOf("Build the LLM translator if all of these hold:"),
      section.indexOf("**Why these numbers.**"),
    );
    // Every bullet in the list is a bar, and every bar is a bullet.
    expect(list.match(/^- /gm) ?? []).toHaveLength(HELDOUT_BARS.length);
    const flatList = flat(list);
    let after = -1;
    for (const bar of HELDOUT_BARS) {
      const at = flatList.indexOf(flat(`- **${bar.rule}** ${bar.measure}`));
      expect(at, bar.id).toBeGreaterThan(after);
      after = at;
    }
  });

  it("carry the date the plan gives", () => {
    const settled = new Date(
      `${HELDOUT_BARS_SETTLED}T00:00:00Z`,
    ).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(plan).toContain(`### Thresholds (settled ${settled})`);
  });

  it("state their own value", () => {
    for (const bar of HELDOUT_BARS)
      expect(bar.rule).toContain(formatBarValue(bar.value, bar.unit));
    expect(new Set(HELDOUT_BARS.map((bar) => bar.id)).size).toBe(
      HELDOUT_BARS.length,
    );
  });

  it("formats values as the rules read", () => {
    expect(formatBarValue(0.9, "share")).toBe("90%");
    expect(formatBarValue(2 / 3, "share")).toBe("two thirds");
    expect(formatBarValue(0.1, "points")).toBe("10 points");
    expect(formatBarValue(2, "per100")).toBe("2");
  });

  it("are met only when measured, at the bar inclusive", () => {
    const results = checkBars({
      toEnglish: 0.9,
      toEnglishHard: 0.49,
      // Exactly 10 points, as floating point computes it: 0.10000000000000009.
      notMemory: 8 / 10 - 7 / 10,
      silentInventions: 2.5,
      newSentencesJudged: { unmeasurable: "too few Keys" },
    });
    const met = Object.fromEntries(results.map((r) => [r.bar.id, r.met]));
    expect(met).toEqual({
      toEnglish: true,
      toEnglishHard: false,
      toEnochian: undefined,
      notMemory: true,
      silentInventions: false,
      newSentencesJudged: undefined,
      newSentencesRoundTrip: undefined,
    });
    expect(results.find((r) => r.unmeasurable)?.bar.id).toBe(
      "newSentencesJudged",
    );
    expect(allBarsMet(results)).toBe(false);
    expect(allBarsMet([])).toBe(false);
    const all = checkBars(
      Object.fromEntries(
        HELDOUT_BARS.map((bar) => [bar.id, bar.value]),
      ) as Record<string, number>,
    );
    expect(allBarsMet(all)).toBe(true);
  });
});

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
