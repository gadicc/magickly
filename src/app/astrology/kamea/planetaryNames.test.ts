import exceptions from "magick-data/astrology/planetaryNameExceptions";
import names from "magick-data/astrology/planetaryNames";
import { describe, expect, it } from "vitest";
import {
  exceptionOf,
  exceptionsOf,
  planetaryName,
  planetaryNamePath,
  planetaryNamesOf,
  planetaryNamesWithPages,
  ROLE_LABELS,
} from "./planetaryNames";

describe("the planetary names as the pages show them", () => {
  it("give a planet its names in the table's order, divine names first", () => {
    expect(planetaryNamesOf("saturn").map((name) => name.id)).toEqual([
      "saturn-ab",
      "saturn-hod-9",
      "saturn-iah",
      "saturn-hod-15",
      "saturn-tetragrammaton-extensum",
      "agiel",
      "zazel",
    ]);
    expect(planetaryNamesOf("luna").map((name) => name.role)).toEqual([
      "divineName",
      "divineName",
      "spirit",
      "spiritOfSpirits",
      "intelligenceOfIntelligences",
      "intelligence",
    ]);
    expect(planetaryName("agiel")?.planetId).toBe("saturn");
    expect(planetaryName("constructor")).toBeUndefined();
  });

  it("label every role", () => {
    const roles = new Set(Object.values(names).map((name) => name.role));
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...roles].sort());
  });

  it("give a page to each name with a sigil, in the graph's namespaces", () => {
    const pages = planetaryNamesWithPages().map(planetaryNamePath);
    // Decision 8's "about 17": six intelligences and Shelachel's absence,
    // the Bne Seraphim and Malcha; seven spirits and the spirit of spirits.
    expect(pages).toHaveLength(16);
    expect(pages).toContain("/astrology/intelligence/agiel");
    expect(pages).toContain("/astrology/spirit/zazel");
    expect(pages).toContain("/astrology/intelligence/bne-seraphim");
    expect(pages).toContain("/astrology/intelligence/malcha-betharsisim");
    expect(pages).toContain("/astrology/spirit/schedbarschemoth-schartathan");
    // No divine name, and not Shelachel, whom nothing traces.
    expect(planetaryNamePath(names["saturn-ab"])).toBeNull();
    expect(planetaryNamePath(names.shelachel)).toBeNull();
    expect(
      pages.filter((path) => path?.startsWith("/astrology/spirit/")),
    ).toHaveLength(8);
  });

  it("find every exception under its name, and each witness's at most once", () => {
    const found = Object.values(names).flatMap(exceptionsOf);
    expect(found.map((row) => row.id).sort()).toEqual(
      Object.keys(exceptions).sort(),
    );
    expect(exceptionOf(names.kedemel, "agrippa1533")).toMatchObject({
      printed: 157,
      expected: 175,
      whose: "printing",
    });
    expect(exceptionOf(names.kedemel, "barrett1801")).toBeUndefined();
    for (const name of Object.values(names)) {
      const witnesses = exceptionsOf(name).map((row) => row.witness);
      expect(new Set(witnesses).size, name.id).toBe(witnesses.length);
    }
  });
});
