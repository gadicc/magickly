import { describe, expect, it } from "vitest";
import { roseLetters } from "../../gd/roseSigilInternals.ts";
import {
  CORPUS_ROSE_VERSIONS,
  KAMEA_STUBS,
  roseTexts,
  SEVENTY_TWO_NAMES,
} from "./corpus.ts";

describe("oracle corpus", () => {
  it("has the 72 names, numbered 1 to 72, each all rose letters", () => {
    expect(SEVENTY_TWO_NAMES.map((name) => name.number)).toEqual(
      Array.from({ length: 72 }, (_, i) => i + 1),
    );
    for (const { text } of SEVENTY_TWO_NAMES) {
      expect(text).toMatch(/^[א-ת]{4,6}$/u);
      expect(roseLetters(text).join("")).toBe(
        text.replace(/[ךםןףץ]/gu, (final) => "כמנפצ"["ךםןףץ".indexOf(final)]),
      );
    }
    // Plan 088's "What is wrong today" names are among them.
    const texts = SEVENTY_TWO_NAMES.map((name) => name.text);
    for (const name of ["ללהאל", "יייאל", "ננאאל", "הההאל", "יבמיה", "מומיה"])
      expect(texts).toContain(name);
  });

  it("runs on both roses", () => {
    expect(CORPUS_ROSE_VERSIONS).toEqual(["gd", "regardie1939"]);
  });

  it.each(CORPUS_ROSE_VERSIONS)(
    "gives every pair and triple of the %s rose's letters once",
    (version) => {
      const pairs = [...roseTexts(2, version)];
      const triples = [...roseTexts(3, version)];
      expect(pairs).toHaveLength(22 ** 2);
      expect(new Set(pairs).size).toBe(22 ** 2);
      expect(triples).toHaveLength(22 ** 3);
      expect(new Set(triples).size).toBe(22 ** 3);
      expect(pairs).toContain("אא");
      expect(triples).toContain("קקק");
      for (const text of triples) expect(roseLetters(text)).toHaveLength(3);
    },
  );

  it("gives nothing for no letters", () => {
    expect([...roseTexts(0, "gd")]).toEqual([]);
  });

  it("has the kamea stubs", () => {
    expect(KAMEA_STUBS).toEqual([
      { id: "zazel-kamea", planet: "saturn", numbers: [7, 1, 7, 3] },
      {
        id: "taphthartharath-kamea",
        planet: "mercury",
        numbers: [40, 8, 40, 20, 40, 20, 40],
      },
    ]);
  });
});
