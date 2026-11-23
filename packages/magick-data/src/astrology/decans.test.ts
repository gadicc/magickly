import { describe, expect, it } from "vitest";
import { minorCard } from "../tarot/minorCards.ts";
import { CHALDEAN_ORDER, DECANS, decanById, decansOf } from "./decans.ts";
import zodiac from "./Zodiac.ts";

describe("the decans", () => {
  it("are 36, three a sign from Aries, each id once", () => {
    expect(DECANS).toHaveLength(36);
    expect(new Set(DECANS.map((decan) => decan.id)).size).toBe(36);
    expect(DECANS.map((decan) => decan.no)).toEqual(
      Array.from({ length: 36 }, (_, i) => i + 1),
    );
    expect(DECANS.slice(0, 3).map((decan) => decan.id)).toEqual([
      "aries-1",
      "aries-2",
      "aries-3",
    ]);
    expect(DECANS[35].id).toBe("pisces-3");
  });

  it("step through the Chaldean order from Mars round to Mars (pp.285-286)", () => {
    expect(CHALDEAN_ORDER).toEqual([
      "saturn",
      "jupiter",
      "mars",
      "sol",
      "venus",
      "mercury",
      "luna",
    ]);
    expect(DECANS[0].planetId).toBe("mars");
    expect(DECANS[35].planetId).toBe("mars");
    for (const [i, decan] of DECANS.entries())
      if (i)
        expect(CHALDEAN_ORDER.indexOf(decan.planetId)).toBe(
          (CHALDEAN_ORDER.indexOf(DECANS[i - 1].planetId) + 1) % 7,
        );
    // Vol. 4 p.287 and the Equinox's Plate IV: Libra's Moon, Saturn, Jupiter.
    expect(decansOf("libra").map((decan) => decan.planetId)).toEqual([
      "luna",
      "saturn",
      "jupiter",
    ]);
  });

  it("give each its small card: the sign's suit, 2-4, 5-7 or 8-10", () => {
    const numbers = {
      cardinal: [2, 3, 4],
      kerubic: [5, 6, 7],
      mutable: [8, 9, 10],
    };
    for (const id of Object.keys(zodiac) as (keyof typeof zodiac)[]) {
      const cards = decansOf(id).map((decan) => minorCard(decan.minorCardId));
      expect(cards.map((card) => card?.rank)).toEqual(
        numbers[zodiac[id].quadruplicity],
      );
      const suit = {
        fire: "wands",
        water: "cups",
        air: "swords",
        earth: "pentacles",
      }[zodiac[id].elementId as "fire"];
      expect(cards.every((card) => card?.suit === suit)).toBe(true);
    }
    expect(new Set(DECANS.map((decan) => decan.minorCardId)).size).toBe(36);
    expect(decanById("aquarius-1")?.minorCardId).toBe("5-swords");
    expect(decanById("aquarius-1")?.planetId).toBe("venus");
    expect(decanById("aquarius-4")).toBeUndefined();
    expect(() => decansOf("ophiuchus" as "aries")).toThrow(RangeError);
  });
});

describe("decansOf", () => {
  it("gives the same frozen triple each time", () => {
    const libra = decansOf("libra");
    expect(Object.isFrozen(libra)).toBe(true);
    expect(decansOf("libra")).toBe(libra);
    expect(libra[0]).toBe(DECANS[18]);
  });
});
