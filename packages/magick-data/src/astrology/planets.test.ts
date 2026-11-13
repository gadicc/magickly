import { describe, expect, it } from "vitest";
import letters from "../HebrewLetters.ts";
import kameas from "./kameas.ts";
import planets, { PLANET_IDS } from "./Planets.ts";

/**
 * A Hebrew word's value, each letter at the value the letter table gives it,
 * a final form at its own (final mem 600). Spaces count nothing; anything
 * else fails the test rather than counting as nothing.
 */
function valueOf(hebrew: string) {
  const byLetter = new Map(
    Object.values(letters).map((row) => [row.letter.he, row.value]),
  );
  let sum = 0;
  for (const char of hebrew.replace(/ /g, "")) {
    const value = byLetter.get(char);
    expect(value, `the value of ${char}`).toBeDefined();
    sum += value as number;
  }
  return sum;
}

describe("the Moon's two intelligences", () => {
  const luna = planets.luna;

  it("keep Shelachel and add Agrippa's intelligence of intelligences", () => {
    expect(luna.intelligenceId).toBe("shelachel");
    expect(luna.intelligenceOfIntelligences).toEqual({
      he: "מלכא בתרשיתים עד ברוח שחקים",
      roman: {
        agrippa1533: "Malcha betharsisim hed beruah schehakim",
        crowley777: "Malkah Be Tarshishim va A'ad Be Ruah Shehaqim",
        regardie1940: "Malcah Betarshisim ve-ad Ruachoth ha-Schechalim",
      },
    });
  });

  it("give Agrippa's Hebrew as he prints it, adding up to the Moon's 3321", () => {
    // Agrippa numbers the name 3321, the sum of the Moon's square of 9, and
    // his spelling reaches it with final mem at 600: a check on the letters.
    const square = kameas.luna.flat().reduce((a, b) => a + b, 0);
    expect(square).toBe(3321);
    expect(valueOf(luna.intelligenceOfIntelligences?.he ?? "")).toBe(square);
  });

  it("are the Moon's alone", () => {
    for (const id of PLANET_IDS)
      if (id !== "luna")
        expect(
          (planets[id] as { intelligenceOfIntelligences?: unknown })
            .intelligenceOfIntelligences,
          id,
        ).toBeUndefined();
  });
});
