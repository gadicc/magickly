import { describe, expect, it } from "vitest";
import { createSearchEngine, normalizeSearch } from "./engine";
import type { SearchCatalogue } from "./types";

const catalogue: SearchCatalogue = {
  version: 1,
  documents: [
    {
      path: "/tree",
      title: "Tree of Life",
      description: "The sephirot and paths.",
      aliases: ["עץ חיים"],
      sections: [],
    },
    {
      path: "/book",
      title: "A book",
      description: "Reference text",
      aliases: [],
      sections: [
        {
          id: "one",
          title: "Chapter 1",
          text: "The Tree of Life is described here. Michael stands in the south.",
          href: "/book#one",
        },
        {
          id: "two",
          title: "Chapter 2",
          text: "Michael is named in Hebrew מִיכָאֵל.",
          href: "/book#two",
        },
      ],
    },
    {
      path: "/kabbalah",
      title: "Kabbalah",
      description: "Hermetic Kabbalah resources.",
      aliases: [],
      sections: [],
    },
  ],
};
const engine = createSearchEngine(catalogue);

describe("public lexical search", () => {
  it("keeps a named destination above pages that merely mention it", () => {
    expect(engine.search("Tree of Life").map((hit) => hit.path)).toEqual([
      "/tree",
      "/book",
    ]);
  });
  it("returns one page with its best passage and an existing anchor", () => {
    const hits = engine.search("Michael south");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      path: "/book",
      href: "/book#one",
      section: "Chapter 1",
      match: "content",
    });
    expect(hits[0].excerpt).toContain("south");
  });
  it("matches Hebrew with or without niqqud and French without accents", () => {
    expect(engine.search("מיכאל")[0].path).toBe("/book");
    expect(engine.search("עץ חיים")[0].path).toBe("/tree");
    expect(normalizeSearch("Génies Élevés")).toBe("genies eleves");
  });
  it("handles alternate spellings, partial names and a transposition", () => {
    for (const query of ["qabalah", "kabbal", "kabablah"])
      expect(engine.search(query)[0].path, query).toBe("/kabbalah");
  });
  it("does not fuzzy-match arbitrary body words or return unrelated results", () => {
    expect(engine.search("souht")).toEqual([]);
    expect(engine.search("Michael unicorn")).toEqual([]);
    expect(engine.search("   ")).toEqual([]);
    expect(engine.search("<script>alert(1)</script>")).toEqual([]);
  });
  it("bounds results and preserves deterministic ordering", () => {
    expect(engine.search("Tree", 1)).toHaveLength(1);
    expect(engine.search("Tree", 0)).toHaveLength(0);
    expect(engine.search("Tree")).toEqual(engine.search("Tree"));
  });
});
