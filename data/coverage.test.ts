import { describe, expect, it } from "vitest";
import { coverage } from "./coverage";

/**
 * The list of sources no graph check opens, held where it can be seen.
 *
 * Not a prohibition — a document is not a table and should not be declared one
 * to borrow a validator. What this forbids is the list growing without anyone
 * deciding: a new JSON5 file that nothing checks fails here, and whoever added
 * it says what checks it needs.
 */
describe("what the graph does not check", () => {
  it("is this list and no more", () => {
    const { uncovered } = coverage();
    expect(uncovered.map((entry) => entry.file)).toEqual([
      "enochian/dictionary.json5",
      "kabbalah/lenain/apparatus.json5",
      "kabbalah/lenain/evidence.json5",
      "kabbalah/lenain/pages.json5",
      "kabbalah/seventyTwoAngelsText/en.json5",
      "kabbalah/seventyTwoAngelsText/fr.json5",
    ]);
  });

  it("says what covers each one instead", () => {
    const { uncovered } = coverage();
    const unchecked = uncovered.filter((entry) => entry.by === "nothing");
    // The English translation is the one file with no check of any kind. It is
    // derived from the French, which lenainQuotations.test.ts does hold.
    expect(unchecked.map((entry) => entry.file)).toEqual([
      "kabbalah/seventyTwoAngelsText/en.json5",
    ]);
  });

  it("counts the tables it does check", () => {
    expect(coverage().checked).toBeGreaterThan(20);
  });
});
