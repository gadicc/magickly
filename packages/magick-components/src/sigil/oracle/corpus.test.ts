import { describe, expect, it } from "vitest";
import { roseLetters, roseRings } from "../../gd/roseSigilInternals.ts";
import {
  CORPUS_ROSE_VERSIONS,
  DOMAIN_EDGE_TEXTS,
  inGrammarDomain,
  RANDOM_CORPUS,
  randomRoseTexts,
  roseTexts,
  SEVENTY_TWO_NAMES,
  seededRandom,
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
});

describe("the random corpus", () => {
  it("is the same words on every run, from a seeded generator", () => {
    expect(randomRoseTexts()).toEqual(randomRoseTexts());
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(randomRoseTexts({ ...RANDOM_CORPUS, seed: 89 })).not.toEqual(
      randomRoseTexts(),
    );
  });

  it("has words of 4 to 12 rose letters, all within the grammar's domain", () => {
    const texts = randomRoseTexts();
    const { perLength, minLength, maxLength } = RANDOM_CORPUS;
    expect(texts).toHaveLength(perLength * (maxLength - minLength + 1));
    const letters = new Set(roseRings("gd").flat());
    for (const text of texts) {
      const chars = [...text];
      expect(chars.length).toBeGreaterThanOrEqual(minLength);
      expect(chars.length).toBeLessThanOrEqual(maxLength);
      expect(chars.every((c) => letters.has(c))).toBe(true);
      expect(inGrammarDomain(text)).toBe(true);
    }
    // Repeats and revisits do occur, so crooks and returns are exercised.
    expect(texts.some((t) => /(.)\1\1/u.test(t))).toBe(true);
    expect(texts.some((t) => /(.).+\1/u.test(t))).toBe(true);
  });

  it("knows the domain's edges", () => {
    expect(inGrammarDomain("אאא")).toBe(true);
    expect(inGrammarDomain("אאאא")).toBe(false);
    expect(inGrammarDomain("אבאגאדא")).toBe(true);
    expect(inGrammarDomain("אבאגאדאהא")).toBe(false);
    for (const text of DOMAIN_EDGE_TEXTS)
      expect(inGrammarDomain(text)).toBe(true);
  });
});
