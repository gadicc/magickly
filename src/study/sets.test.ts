import { PLANET_IDS } from "magick-data/astrology/planets";
import { describe, expect, it, vi } from "vitest";
import getSet, { sets } from "./sets";

// The study API route loads these sets, and Turbopack gives route handlers no
// `next/font`; a font import here would break that route.
vi.mock("next/font/local", () => {
  throw new Error("study sets must not load next/font");
});

describe("study sets", () => {
  it("resolve card ids without loading fonts", () => {
    for (const id of Object.keys(sets))
      expect(Object.keys(getSet(id).data).length, id).toBeGreaterThan(0);
    expect(() => getSet("missing")).toThrow("No such set");
  });

  it("ask the twelve planets' signs, and no sphere of the Tree", () => {
    // The set filters the planet table by the `kind` its rows now declare,
    // where it used to ask whether the row had a `symbol`; the cards are the
    // same twelve either way (plan 032, decision 14).
    expect(Object.keys(getSet("planet-signs").data)).toEqual([...PLANET_IDS]);
  });

  it("deal every set's cards, reading each string path off its rows", () => {
    // A path that finds nothing throws, so a set broken by a data change
    // fails here rather than dealing a blank card.
    for (const id of Object.keys(sets))
      for (const card of getSet(id).generateCards())
        expect(card.answer, `${id} ${card.id}`).toBeTruthy();
  });

  it("answer the stones from the stone rows, joined", () => {
    // A sephirah's stones are linked rows since plan 039, read through the
    // wildcard as the Tree reads them: lower case, joined with "; ".
    const answers = Object.fromEntries(
      getSet("sephirot-stones")
        .generateCards()
        .map((card) => [card.id, card.answer]),
    );
    expect(answers.chochmah).toBe("star ruby; turquoise");
    expect(answers.hesed).toBe("sapphire; amethyst");
    expect(answers.hod).toBe("quartz");
    expect(answers.daat).toBeUndefined();
  });

  it("answer the ten heavens from the planet rows", () => {
    // Since plan 039 a sephirah's heaven is the planet row it links: a sphere
    // answers with its Hebrew name's gloss, a planet as "Sphere of" itself.
    // Progress is keyed by the card's id, the sephirah's, not by this text.
    const answers = Object.fromEntries(
      getSet("ten-heavens")
        .generateCards()
        .map((card) => [card.id, card.answer]),
    );
    expect(answers.keter).toBe("First Swirlings / Roshit HaGilgulim");
    expect(answers.chochmah).toBe("The Zodiac / Mazalot");
    expect(answers.malchut).toBe("Sphere of the Elements / Olam HaYesodot");
    expect(answers.tiferet).toBe("Sphere of Sol / Shemesh");
  });

  it("name the Enochian question font", () => {
    expect(sets["enochian-letters-latin"].questionFont).toBe("enochian");
    expect(sets["enochian-letter-names"].questionFont).toBe("enochian");
  });

  it("never offer the same answer twice", () => {
    // Final letters share their letter's meaning, as in hebrewLetters.json5.
    const letters = (meanings: Record<string, string>) => ({
      ...getSet("hebrew-meaning"),
      data: Object.fromEntries(
        Object.entries(meanings).map(([id, en]) => [
          id,
          { id, letter: { he: id }, meaning: { en } },
        ]),
      ),
    });
    const offered = (set: ReturnType<typeof letters>) =>
      Object.fromEntries(
        set.generateCards().map((card) => [card.id, card.answers.toSorted()]),
      );

    // Five letters but three meanings: three other letters always repeat a
    // meaning, among the distractors or the card's own.
    const three = ["fish", "ox", "palm of hand"];
    expect(
      offered(
        letters({
          aleph: "ox",
          kaf: "palm of hand",
          "kaf-sofit": "palm of hand",
          nun: "fish",
          "nun-sofit": "fish",
        }),
      ),
    ).toEqual({
      aleph: three,
      kaf: three,
      "kaf-sofit": three,
      nun: three,
      "nun-sofit": three,
    });

    // With five meanings for four places, every card still gets three
    // different distractors.
    const cards = letters({
      aleph: "ox",
      beth: "house",
      gimel: "camel",
      kaf: "palm of hand",
      "kaf-sofit": "palm of hand",
      nun: "fish",
      "nun-sofit": "fish",
    }).generateCards();
    expect(cards).toHaveLength(7);
    for (const card of cards) {
      expect(new Set(card.answers).size, card.id).toBe(4);
      expect(card.answers, card.id).toContain(card.answer);
    }
  });

  it("offer each card's answer once in every set", () => {
    for (const id of Object.keys(sets))
      for (const card of getSet(id).generateCards()) {
        const label = `${id}/${card.id}`;
        expect(new Set(card.answers).size, label).toBe(card.answers.length);
        expect(card.answers, label).toContain(card.answer);
      }
  });
});
