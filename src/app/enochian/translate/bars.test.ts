import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allBarsMet,
  BARS_SETTLED,
  checkBars,
  formatBarValue,
  TRANSLATOR_BARS,
} from "./bars.ts";

const plan = readFileSync(
  new URL(
    "../../../../plans/077-enochian-translator-experiment.md",
    import.meta.url,
  ),
  "utf8",
);
/** Markdown wraps lines and indents list items; compare words only. */
const flat = (text: string) => text.replace(/\s+/g, " ");

describe("the translator's bars", () => {
  it("are quoted word for word in plan 077, in order", () => {
    const start = plan.indexOf("### Thresholds");
    const section = plan.slice(start, plan.indexOf("## Where the work lives"));
    const list = section.slice(
      section.indexOf("Build the LLM translator if all of these hold:"),
      section.indexOf("**Why these numbers.**"),
    );
    // Every bullet in the list is a bar, and every bar is a bullet.
    expect(list.match(/^- /gm) ?? []).toHaveLength(TRANSLATOR_BARS.length);
    const flatList = flat(list);
    let after = -1;
    for (const bar of TRANSLATOR_BARS) {
      const at = flatList.indexOf(flat(`- **${bar.rule}** ${bar.measure}`));
      expect(at, bar.id).toBeGreaterThan(after);
      after = at;
    }
  });

  it("carry the date the plan gives", () => {
    const settled = new Date(`${BARS_SETTLED}T00:00:00Z`).toLocaleDateString(
      "en-GB",
      { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
    );
    expect(plan).toContain(`### Thresholds (settled ${settled})`);
  });

  it("state their own value", () => {
    for (const bar of TRANSLATOR_BARS)
      expect(bar.rule).toContain(formatBarValue(bar.value, bar.unit));
    expect(new Set(TRANSLATOR_BARS.map((bar) => bar.id)).size).toBe(
      TRANSLATOR_BARS.length,
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
        TRANSLATOR_BARS.map((bar) => [bar.id, bar.value]),
      ) as Record<string, number>,
    );
    expect(allBarsMet(all)).toBe(true);
  });
});
