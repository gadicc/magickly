import { describe, expect, it } from "vitest";
import {
  COURT_ELEMENTS,
  COURT_RANKS,
  isMinorCardId,
  MINOR_CARDS,
  minorCard,
  minorCardId,
  SUIT_ELEMENTS,
  suitOfElement,
  TAROT_SUITS,
} from "./minorCards.ts";

describe("the minor cards", () => {
  it("are 56, fourteen a suit, each id once", () => {
    expect(MINOR_CARDS).toHaveLength(56);
    expect(new Set(MINOR_CARDS.map((card) => card.id)).size).toBe(56);
    for (const suit of TAROT_SUITS)
      expect(MINOR_CARDS.filter((card) => card.suit === suit)).toHaveLength(14);
    expect(MINOR_CARDS.filter((card) => card.kind === "ace")).toHaveLength(4);
    expect(MINOR_CARDS.filter((card) => card.kind === "small")).toHaveLength(
      36,
    );
    expect(MINOR_CARDS.filter((card) => card.kind === "court")).toHaveLength(
      16,
    );
  });

  it("are named in English, the court in the Order's ranks", () => {
    expect(minorCard("ace-wands")?.name).toBe("Ace of Wands");
    expect(minorCard("2-cups")?.name).toBe("Two of Cups");
    expect(minorCard("10-swords")?.name).toBe("Ten of Swords");
    expect(minorCard("prince-swords")?.name).toBe("Prince of Swords");
    expect(minorCard("princess-pentacles")?.name).toBe("Princess of Pentacles");
    expect(minorCard("knight-wands")).toBeUndefined();
    expect(minorCard("page-wands")).toBeUndefined();
    expect(COURT_RANKS).toEqual(["king", "queen", "prince", "princess"]);
  });

  it("give each suit and court rank its element (vol. 4, pp.288, 290)", () => {
    expect(SUIT_ELEMENTS).toEqual({
      wands: "fire",
      cups: "water",
      swords: "air",
      pentacles: "earth",
    });
    expect(COURT_ELEMENTS).toEqual({
      king: "fire",
      queen: "water",
      prince: "air",
      princess: "earth",
    });
    for (const suit of TAROT_SUITS)
      expect(suitOfElement(SUIT_ELEMENTS[suit])).toBe(suit);
  });

  it("make and check ids", () => {
    expect(minorCardId("cups", 7)).toBe("7-cups");
    expect(minorCardId("wands", "queen")).toBe("queen-wands");
    expect(isMinorCardId("7-cups")).toBe(true);
    expect(isMinorCardId("1-cups")).toBe(false);
    expect(Object.isFrozen(MINOR_CARDS[0])).toBe(true);
  });
});
