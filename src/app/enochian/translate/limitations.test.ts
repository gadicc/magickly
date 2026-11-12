import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRANSLATOR_LIMITATIONS } from "./limitations.ts";

const plan = readFileSync(
  new URL(
    "../../../../plans/077-enochian-translator-experiment.md",
    import.meta.url,
  ),
  "utf8",
);
/** Markdown wraps lines and indents list items; compare words only. */
const flat = (text: string) => text.replace(/\s+/g, " ");

describe("the translator's limitations", () => {
  it("are quoted word for word in plan 077, in order", () => {
    const section = plan.slice(plan.indexOf("## If it works"));
    const start = flat(section).indexOf(
      "The list, to be settled with the bars:",
    );
    expect(start).toBeGreaterThan(-1);
    const end = flat(section).indexOf("- It builds on the dictionary");
    expect(end).toBeGreaterThan(start);
    const list = flat(section).slice(start, end);
    // Every bullet in the list is a limitation, and every limitation a bullet.
    expect(list.match(/ - /g) ?? []).toHaveLength(
      TRANSLATOR_LIMITATIONS.length,
    );
    let after = -1;
    for (const text of TRANSLATOR_LIMITATIONS) {
      const at = list.indexOf(` - ${flat(text)} `);
      expect(at, text).toBeGreaterThan(after);
      after = at;
    }
    // Nothing else in the list: the bullets joined are the whole of it.
    expect(
      list
        .replace("The list, to be settled with the bars:", "")
        .trim()
        .split(/ ?- (?=[A-Z])/)
        .filter(Boolean),
    ).toEqual(TRANSLATOR_LIMITATIONS.map(flat));
  });
});
