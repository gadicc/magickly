import { describe, expect, it } from "vitest";
import { ROSE_SIGIL_PROFILE, roseSigilLayout } from "../gd/roseSigilLayout.ts";
import { sigilFrame, wordInk } from "./ink.ts";
import { placeSigil, placeSigilWords, wordFailures } from "./placeSigil.ts";
import { planSigil, sigilWords } from "./planSigil.ts";
import { SIGIL_MARK_ORDER } from "./types.ts";

const rose = roseSigilLayout();
const plan = (text: string) =>
  planSigil(sigilWords(text), rose, ROSE_SIGIL_PROFILE);

describe("placeSigilWords", () => {
  it("says which words it could not place with every mark clear", () => {
    const [clear, unclear] = placeSigilWords(
      plan("מטטרון פלפלפ"),
      rose,
      ROSE_SIGIL_PROFILE,
    );
    expect(clear.failures).toEqual([]);
    // A-B-A-B-A across the rose: a known failure of the oracle suite.
    expect(unclear.failures.length).toBeGreaterThan(0);
    expect(unclear.word).toHaveLength(5);
  });

  it("places a word met again once, in a text and across texts", () => {
    const [a, b] = placeSigilWords(plan("יהוה יהוה"), rose, ROSE_SIGIL_PROFILE);
    expect(b).toBe(a);
    const [again] = placeSigilWords(plan("יהוה"), rose, ROSE_SIGIL_PROFILE);
    expect(again).toBe(a);
    // Another profile is another placement.
    const [other] = placeSigilWords(plan("יהוה"), rose, {
      ...ROSE_SIGIL_PROFILE,
    });
    expect(other).not.toBe(a);
    expect(other.word).toEqual(a.word);
  });

  it("shares a budget across a text's words, so hard words cost twice one", () => {
    // Words that fail spend all they are given; the third gets the floor.
    const hard = "פלפלפ פנפנפ פספספ";
    const words = placeSigilWords(plan(hard), rose, ROSE_SIGIL_PROFILE);
    const total = words.reduce((sum, w) => sum + w.work, 0);
    // Twice one word's budget, an eighth for the third, and the last
    // round's overrun of each.
    expect(total).toBeLessThanOrEqual((2 + 1 / 8) * 300_000 * 1.1);
    // The same text draws the same figure every time, whatever the cache
    // holds: with the third word kept from another text (placed then with
    // its whole budget), it is still placed with what this text gives it.
    expect(placeSigil(plan(hard), rose, ROSE_SIGIL_PROFILE)).toEqual(
      words.map((w) => w.word),
    );
    const fresh = { ...ROSE_SIGIL_PROFILE };
    placeSigil(plan("פספספ"), rose, fresh);
    expect(placeSigil(plan(hard), rose, fresh)).toEqual(
      words.map((w) => w.word),
    );
  });

  it("gives a word after hard ones enough to be drawn clear", () => {
    // The 72's hardest name, and two plain ones, after two hard words.
    for (const name of ["ללהאל", "והויה", "מטטרון"]) {
      const words = placeSigilWords(
        plan(`נהנהנ ציציצ ${name}`),
        rose,
        ROSE_SIGIL_PROFILE,
      );
      expect([name, words[2].failures]).toEqual([name, []]);
    }
  });

  it("charges nothing for a word met again in the same text", () => {
    for (const hard of ["פלפלפ", "נהנהנ"]) {
      const words = placeSigilWords(
        plan(`${hard} ${hard} ${hard}`),
        rose,
        ROSE_SIGIL_PROFILE,
      );
      expect(words[1]).toBe(words[0]);
      expect(words[2]).toBe(words[0]);
    }
  });

  it("hands out placed words frozen, shared by every caller", () => {
    const [word] = placeSigil(plan("מטטרון"), rose, ROSE_SIGIL_PROFILE);
    expect(Object.isFrozen(word)).toBe(true);
    expect(Object.isFrozen(word[0])).toBe(true);
    expect(Object.isFrozen(word[0].point)).toBe(true);
  });
});

describe("wordFailures", () => {
  const frame = sigilFrame(rose);
  it("passes a placed figure and finds a broken one", () => {
    const [word] = placeSigil(plan("מטטרון"), rose, ROSE_SIGIL_PROFILE);
    const judge = (w: typeof word) => wordFailures(w, rose, ROSE_SIGIL_PROFILE);
    expect(judge(word)).toEqual([]);
    // Vav drawn at Resh's place: out of its slack, on the line.
    const broken = word.map((v, i) =>
      i === 3 ? { ...v, point: word[2].point } : v,
    );
    expect(judge(broken).map((f) => f.check)).toContain("slack");
    // Vav drawn on the line from Resh to Nun: a corner too shallow to see.
    const [r, n] = [word[2].point, word[4].point];
    const flat = word.map((v, i) =>
      i === 3
        ? { ...v, point: { x: (r.x + n.x) / 2 + 0.1, y: (r.y + n.y) / 2 } }
        : v,
    );
    expect(judge(flat).map((f) => f.check)).toContain("corner");
  });

  it("lists marks in SIGIL_MARK_ORDER", () => {
    for (const vertex of plan("ממטרון").flat())
      expect(vertex.marks).toEqual(
        SIGIL_MARK_ORDER.filter((m) => vertex.marks.includes(m)),
      );
  });
});

describe("roseSigilLayout", () => {
  it("is one layout per version, and reads only places it has", () => {
    expect(roseSigilLayout("gd")).toBe(rose);
    expect(roseSigilLayout("nonsense")).toBe(rose);
    expect(roseSigilLayout("regardie1939")).not.toBe(rose);
    expect(() => rose.anchor("ך")).toThrow("roseSigilLayout: no place ך");
    expect(rose.place("ך")).toBe("כ");
    expect(rose.place("a")).toBeNull();
    expect(rose.placeAt({ x: 0, y: 0 })).toBeNull();
    expect(rose.placeAt(rose.anchor("ש"))).toBe("ש");
  });
});
