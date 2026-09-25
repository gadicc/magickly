import { statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RWSName, RWSPath, tarotDeck, trumpNumeral } from "./tarot";

describe("tarot package integration", () => {
  it("exposes the card lookup API used by the Kabbalah path page", () => {
    expect(tarotDeck.getByRank(0)).toMatchObject({
      rank: 0,
      name: "The Fool",
      suit: "major",
    });
    expect(tarotDeck.getByRank("21")).toMatchObject({
      rank: 21,
      name: "The World",
      suit: "major",
    });
    expect(tarotDeck.majorArcana).toHaveLength(22);
  });

  it.each([
    { rank: 0, filename: "RWS_Tarot_00_Fool.jpg" },
    { rank: "1", filename: "RWS_Tarot_01_Magician.jpg" },
    { rank: "2", filename: "RWS_Tarot_02_High_Priestess.jpg" },
    { rank: 5, filename: "RWS_Tarot_05_Hierophant.jpg" },
    { rank: 8, filename: "RWS_Tarot_08_Strength.jpg" },
    { rank: "10", filename: "RWS_Tarot_10_Wheel_of_Fortune.jpg" },
    { rank: 12, filename: "RWS_Tarot_12_Hanged_Man.jpg" },
    { rank: "20", filename: "RWS_Tarot_20_Judgement.jpg" },
    { rank: 21, filename: "RWS_Tarot_21_World.jpg" },
  ])(
    "resolves rank $rank to its local Rider-Waite image",
    ({ rank, filename }) => {
      const imagePath = RWSPath(rank);
      expect(imagePath).toBe(`/tarot/rws/${filename}`);
      const asset = statSync(new URL(`../public${imagePath}`, import.meta.url));
      expect(asset.isFile()).toBe(true);
      expect(asset.size).toBeGreaterThan(0);
    },
  );

  it("resolves all 22 major-arcana ranks to distinct nonempty local images", () => {
    const imagePaths = Array.from({ length: 22 }, (_, rank) => {
      const imagePath = RWSPath(rank);
      expect(RWSPath(String(rank))).toBe(imagePath);
      const asset = statSync(new URL(`../public${imagePath}`, import.meta.url));
      expect(asset.isFile()).toBe(true);
      expect(asset.size).toBeGreaterThan(0);
      return imagePath;
    });
    expect(new Set(imagePaths).size).toBe(22);
  });
});

describe("the trumps as the Rider-Waite cards print them", () => {
  it("names the three the deck names otherwise, and keeps the rest", () => {
    expect(RWSName(2)).toBe("The High Priestess");
    expect(RWSName("5")).toBe("The Hierophant");
    expect(RWSName(10)).toBe("Wheel of Fortune");
    expect(RWSName(0)).toBe("The Fool");
    expect(RWSName(12)).toBe("The Hanged Man");
  });

  it("names every trump as its image file does, bar the article", () => {
    // The bundled files are named for the printed cards, so the two agree.
    for (let rank = 0; rank < 22; rank++) {
      const file = RWSPath(rank).replace(/^.*RWS_Tarot_\d\d_|\.jpg$/g, "");
      expect(RWSName(rank).replace(/^The /, ""), String(rank)).toBe(
        file.replaceAll("_", " "),
      );
    }
  });

  it("numbers them in Roman numerals from the Fool's 0", () => {
    expect(Array.from({ length: 22 }, (_, rank) => trumpNumeral(rank))).toEqual(
      [
        "0",
        "I",
        "II",
        "III",
        "IV",
        "V",
        "VI",
        "VII",
        "VIII",
        "IX",
        "X",
        "XI",
        "XII",
        "XIII",
        "XIV",
        "XV",
        "XVI",
        "XVII",
        "XVIII",
        "XIX",
        "XX",
        "XXI",
      ],
    );
    expect(trumpNumeral("2")).toBe("II");
  });
});
