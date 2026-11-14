import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXPERIMENT_LIMITATIONS,
  TRANSLATOR_LIMITATIONS,
} from "./limitations.ts";

const read = (plan: string) =>
  readFileSync(new URL(`../../../../plans/${plan}`, import.meta.url), "utf8");
/** Markdown wraps lines and indents list items; compare words only. */
const flat = (text: string) => text.replace(/\s+/g, " ");

/**
 * The bullets of a plan's list, from the line that introduces it up to
 * the text that follows it, each flattened to one line.
 */
function bullets(plan: string, intro: string, after: string): string[] {
  const text = flat(plan);
  const start = text.indexOf(intro);
  expect(start, intro).toBeGreaterThan(-1);
  const end = text.indexOf(after, start);
  expect(end, after).toBeGreaterThan(start);
  return text
    .slice(start + intro.length, end)
    .trim()
    .split(/ ?- (?=[A-Z])/)
    .filter(Boolean);
}

describe("the lookup's limitations (plan 081, decision 20)", () => {
  it("are quoted word for word in plan 081, in order", () => {
    const plan = read("081-enochian-translator.md");
    expect(
      bullets(
        plan,
        "which Gadi confirmed on 13 November 2026:",
        "21. **Figures, script-only**",
      ),
    ).toEqual(TRANSLATOR_LIMITATIONS.lookup.map(flat));
  });
});

describe("plan 077's limitations, for its record", () => {
  it("are quoted word for word in plan 077, in order", () => {
    const plan = read("077-enochian-translator-experiment.md");
    const section = plan.slice(plan.indexOf("## If it works"));
    expect(
      bullets(
        section,
        "The list, to be settled with the bars:",
        "- It builds on the dictionary",
      ),
    ).toEqual(EXPERIMENT_LIMITATIONS.map(flat));
  });
});
