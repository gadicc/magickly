import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BARS_SETTLED,
  barById,
  countLine,
  formatBarValue,
  JUDGES_CHECK,
  JUDGES_CHECK_RULE,
  judgesPass,
  TRANSLATOR_BARS,
} from "./bars.ts";

const plan = readFileSync(
  new URL(
    "../../../../plans/077-enochian-translator-experiment.md",
    import.meta.url,
  ),
  "utf8",
);

/** The plan's date as it writes it: "12 November 2026". */
const settled = new Date(`${BARS_SETTLED}T00:00:00Z`).toLocaleDateString(
  "en-GB",
  { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
);
const heading = `### Bars for the new text (settled ${settled})`;
/** Markdown wraps lines and indents list items; compare words only. */
const flat = (text: string) => text.replace(/\s+/g, " ");

describe("the translator's bars", () => {
  it("are quoted word for word in plan 077's table, in order", () => {
    const start = plan.indexOf(heading);
    expect(start).toBeGreaterThan(0);
    const head = "| Bar | How it is measured | What it shows |";
    const table = plan.indexOf(head, start);
    expect(table).toBeGreaterThan(start);
    // The table's rows, less its head and rule, up to the first other line.
    const lines = plan.slice(table).split("\n");
    const rows = lines
      .slice(
        2,
        lines.findIndex((line) => !line.startsWith("|")),
      )
      .filter(Boolean);
    expect(lines[1]).toBe("| --- | --- | --- |");
    expect(rows).toEqual(
      TRANSLATOR_BARS.map(
        (bar) => `| ${bar.rule} | ${bar.measure} | ${bar.shows} |`,
      ),
    );
  });

  it("carry the date the plan gives", () => {
    expect(BARS_SETTLED).toBe("2026-11-12");
    expect(plan).toContain(heading);
  });

  it("state their own value, as whole-number fractions", () => {
    for (const bar of TRANSLATOR_BARS) {
      expect(bar.rule).toContain(formatBarValue(bar.value, bar.unit));
      expect(bar.value.every(Number.isInteger), bar.id).toBe(true);
      expect(bar.rule).not.toMatch(/\|/);
      expect(bar.measure).not.toMatch(/\|/);
    }
    expect(new Set(TRANSLATOR_BARS.map((bar) => bar.id)).size).toBe(
      TRANSLATOR_BARS.length,
    );
  });

  it("give the counts the plan settled", () => {
    const needs = Object.fromEntries(
      TRANSLATOR_BARS.filter((bar) => bar.planned).map((bar) => [
        bar.id,
        `${countLine(bar, bar.planned ?? 0)} of ${bar.planned}`,
      ]),
    );
    expect(needs).toEqual({
      toEnglish: "484 of 500",
      toEnochian: "465 of 500",
      swappedRight: "108 of 120",
      recalled: "6 of 120",
      plantFailures: "4 of 40",
      knownsRight: "18 of 20",
      joinsRight: "32 of 40",
      task3Accept: "40 of 60",
      task3RoundTrip: "27 of 40",
    });
    expect(barById("knownsRight").a0AtMost).toBe(1);
    expect(() => barById("nonsense" as never)).toThrow(/No bar/);
  });

  it("formats values as the rules read", () => {
    expect(formatBarValue([968, 1000], "share")).toBe("96.8%");
    expect(formatBarValue([93, 100], "share")).toBe("93%");
    expect(formatBarValue([2, 3], "share")).toBe("two thirds");
    expect(formatBarValue([2, 100], "per100")).toBe("2");
    expect(formatBarValue([9, 10], "share")).toBe("90%");
  });

  it("draw the line in whole rows", () => {
    const min = barById("task3RoundTrip");
    expect(countLine(min, 40)).toBe(27);
    expect(countLine(min, 39)).toBe(26);
    const max = barById("blocked");
    expect(countLine(max, 40)).toBe(2);
    expect(countLine(max, 39)).toBe(1);
    // The knowns' line scales with a top-up pooled in: 18 of 20, 25 of 27.
    const knowns = barById("knownsRight");
    expect(countLine(knowns, 20)).toBe(18);
    expect(countLine(knowns, 27)).toBe(25);
  });

  it("settle the judges' check with them, quoted in the plan", () => {
    const start = plan.indexOf(heading);
    const section = plan.slice(start, plan.indexOf("\n## ", start));
    expect(flat(section)).toContain(flat(JUDGES_CHECK_RULE));
    expect(JUDGES_CHECK).toEqual({
      controls: 15,
      minCounted: 8,
      maxAccepted: [1, 5],
    });
    expect(JUDGES_CHECK_RULE).toBe(
      "The judges' check: 15 damaged controls, a third of each kind; at least 8 must count, and the judges may accept at most a fifth of those that do, or neither judged bar of task 3 can be measured.",
    );
    // Whole numbers: 2 of 10 is a fifth, 3 of 10 more; 7 counted too few.
    expect(judgesPass(10, 2)).toBe(true);
    expect(judgesPass(10, 3)).toBe(false);
    expect(judgesPass(15, 3)).toBe(true);
    expect(judgesPass(7, 0)).toBe(false);
  });
});
