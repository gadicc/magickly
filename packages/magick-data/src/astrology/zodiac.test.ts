import { describe, expect, it } from "vitest";
import zodiac from "./Zodiac.ts";

/** Every order of the given letters, each used once. */
function orders(letters: string): string[] {
  if (letters.length <= 1) return [letters];
  return [...letters].flatMap((letter, i) =>
    orders(letters.slice(0, i) + letters.slice(i + 1)).map(
      (rest) => letter + rest,
    ),
  );
}

const signs = Object.values(zodiac).sort((a, b) => a.no - b.no);
const banners = signs.map((sign) => sign.tetragrammatonPermutation);

describe("the signs' permutations of the Name", () => {
  it("are the twelve orders of YHVH's letters, each sign its own", () => {
    // The two He's are one letter in Hebrew: 4! / 2! = 12 orders.
    const hebrew = (banner: string) => banner.replace(/H/g, "h");
    const all = new Set(orders("yhvh"));
    expect(all.size).toBe(12);
    expect(banners.every((banner) => all.has(hebrew(banner)))).toBe(true);
    expect(new Set(banners.map(hebrew)).size).toBe(12);
  });

  it("each spell y, h, v and H once", () => {
    for (const [i, banner] of banners.entries())
      expect([...banner].sort().join(""), signs[i].id).toBe("Hhvy");
  });

  it("tell the He's apart as YHVH turned round, then swapped", () => {
    // 777 (1909), col. CXL. The cardinal signs turn YHVH round; a kerubic
    // sign swaps the last two letters of the cardinal sign before it, a
    // mutable sign the middle two.
    const name = "yhvH";
    for (const [quarter, start] of [0, 3, 6, 9].entries()) {
      const cardinal = name.slice(quarter) + name.slice(0, quarter);
      const [a, b, c, d] = cardinal;
      expect(signs[start].quadruplicity).toBe("cardinal");
      expect(banners.slice(start, start + 3)).toEqual([
        cardinal,
        a + b + d + c,
        a + c + b + d,
      ]);
    }
  });

  it("give Cancer and Sagittarius their own, as 777 has them", () => {
    expect(zodiac.cancer.tetragrammatonPermutation).toBe("hvHy");
    expect(zodiac.sagittarius.tetragrammatonPermutation).toBe("vyHh");
  });
});
