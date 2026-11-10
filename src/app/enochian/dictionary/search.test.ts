import dictionary from "magick-data/enochian/dictionary";
import { describe, expect, it } from "vitest";
import { buildKeyUses, countUses } from "./keyUses";
import {
  buildIndex,
  firstKnownMeaning,
  foldSpelling,
  highlight,
  searchDictionary,
  stem,
  words,
} from "./search";

/** The page's index: the real dictionary, ties broken by the Keys. */
const index = buildIndex(dictionary, countUses(buildKeyUses()));
const search = (query: string) => searchDictionary(index, query);
const keysOf = (hits: { word: string }[]) => hits.map((hit) => hit.word);

describe("English (plan 074, decision 5)", () => {
  it("puts a word that means the query first", () => {
    const { means, lead } = search("light");
    expect(lead).toBe("english");
    expect(keysOf(means)).toEqual(["OLPIRT", "OLPRT"]);
  });

  it("breaks ties by how often the Keys say the word", () => {
    const top = keysOf(search("god").means.slice(0, 3));
    expect(top).toEqual(["MAD", "IAD", "OIAD"]);
    expect(keysOf(search("power").means)).toEqual(
      expect.arrayContaining(["BAB", "LONSHI", "MICALZO"]),
    );
  });

  it("ranks the first meaning before later ones", () => {
    // LAH's "God" is its second meaning, ASCHA's its first.
    const means = keysOf(search("god").means);
    expect(means.indexOf("ASCHA")).toBeLessThan(means.indexOf("LAH"));
  });

  it("puts meanings that mention the query after those that are it", () => {
    const { means, mentions } = search("light");
    expect(mentions.length).toBeGreaterThan(50);
    expect(mentions.every((hit) => hit.tier > means[0].tier)).toBe(true);
    expect(keysOf(mentions)).toContain("MARLAN");
  });

  it("lists each word once across means and mentions", () => {
    const { means, mentions } = search("power");
    const all = keysOf([...means, ...mentions]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("pins a headword without letting it lead the English", () => {
    const fire = search("fire");
    expect(keysOf(fire.word)).toEqual(["FIRE"]);
    expect(fire.lead).toBe("english");
    expect(keysOf(fire.means)).toEqual(
      expect.arrayContaining(["BITOM", "PRGE"]),
    );
  });

  it("matches forms both ways, but not by a bare -d", () => {
    expect(keysOf(search("angels").means)).toContain("MERIFRI");
    expect(keysOf(search("spirits").means)).toContain("GAH");
    expect(keysOf(search("spirit").means)).toContain("GAH");
    const go = search("go");
    expect(go.means).toEqual([]);
    expect(go.mentions).toEqual([]);
  });

  it("never matches inside a word", () => {
    expect(
      search("light").mentions.some((hit) =>
        /delight/i.test(hit.meaning ?? ""),
      ),
    ).toBe(false);
  });

  it("takes a phrase as a phrase", () => {
    const { means } = search("son of light");
    expect(keysOf(means)).toEqual(
      expect.arrayContaining(["MARLAN", "ANOLPHE"]),
    );
  });

  it("gives no English for a stopword alone", () => {
    const the = search("the");
    expect(the.terms).toEqual([]);
    expect(the.means).toEqual([]);
    expect(the.mentions).toEqual([]);
  });

  it("finds numbers", () => {
    expect(keysOf(search("24").means)).toContain("OL");
  });

  it("never finds an unknown meaning", () => {
    expect(search("unknown").means).toEqual([]);
    expect(search("unknown").mentions).toEqual([]);
  });

  it("ranks a reference below every ordinary match", () => {
    // ADDARIO's only meaning is "PART IN …"; a reference's tier is 5 or more.
    const all = [...search("part").means, ...search("part").mentions];
    const references = all.filter((hit) => /^part in/i.test(hit.meaning ?? ""));
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference.tier).toBeGreaterThanOrEqual(5);
      expect(all.indexOf(reference)).toBeGreaterThan(
        all.findIndex((hit) => hit.tier < 5),
      );
    }
  });
});

describe("spellings", () => {
  it("leads with spellings when there is no English", () => {
    const ol = search("ol");
    expect(ol.lead).toBe("spelled");
    expect(keysOf(ol.word)).toEqual(["OL"]);
    expect(keysOf(ol.spelled)).not.toContain("OL");
    expect(ol.spelled[0].word.startsWith("OL")).toBe(true);
  });

  it("puts words that begin with the query before those that contain it", () => {
    const tiers = search("ol").spelled.map((hit) => hit.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });

  it("takes the letters Enochian writes as one as one", () => {
    expect(keysOf(search("URBS").word)).toEqual(["VRBS"]);
    expect(keysOf(search("BINEPOR").word)).toEqual(["BYNEPOR"]);
    expect(keysOf(search("CAPENE").word)).toEqual(["KAPENE"]);
    // U/V twins are separate entries; both are the word.
    expect(keysOf(search("DIV").word).sort()).toEqual(["DIU", "DIV"]);
  });

  it("ignores hyphens and treats the query as text, not a pattern", () => {
    expect(keysOf(search("ABABALOND").word)).toEqual(["A-BABALOND"]);
    expect(() => search("(")).not.toThrow();
    expect(() => search("a[b")).not.toThrow();
    expect(foldSpelling("a-b (c)")).toBe("ABC");
  });

  it("finds nothing for an empty query", () => {
    const empty = search("  ");
    expect([empty.word, empty.means, empty.mentions, empty.spelled]).toEqual([
      [],
      [],
      [],
      [],
    ]);
  });
});

describe("helpers", () => {
  it("splits words and stems them alike on both sides", () => {
    expect(words("GOD'S Light, (the)")).toEqual(["god", "light", "the"]);
    expect(stem("angels")).toBe(stem("angel"));
    expect(stem("glories")).toBe(stem("glory"));
    expect(stem("loving")).toBe(stem("love"));
    expect(stem("god")).toBe("god");
    expect(stem("go")).toBe("go");
  });

  it("gives the first known meaning, or none", () => {
    expect(firstKnownMeaning(dictionary.OLPRT)).toEqual({
      meaning: "light",
      meaningIndex: 0,
    });
    const unknown = Object.values(dictionary).find((entry) =>
      entry.meanings.every((one) => /meaning unknown/i.test(one.meaning)),
    );
    expect(unknown && firstKnownMeaning(unknown)).toEqual({
      meaning: null,
      meaningIndex: -1,
    });
  });

  it("marks the query's words and their forms in a meaning", () => {
    expect(highlight("SON OF LIGHT, Lights", ["light"])).toEqual([
      { text: "SON OF ", match: false },
      { text: "LIGHT", match: true },
      { text: ", ", match: false },
      { text: "Lights", match: true },
    ]);
    expect(highlight("delight", ["light"])).toEqual([
      { text: "delight", match: false },
    ]);
    expect(highlight("as is", [])).toEqual([{ text: "as is", match: false }]);
  });
});
