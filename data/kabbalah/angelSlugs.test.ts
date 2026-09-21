import { describe, expect, it } from "vitest";
import { angelBySlug, angelSlug, angelSlugs } from "./angelSlugs";
import angels from "./SeventyTwoAngels";
import { ANGEL_COUNT } from "./seventyTwoAngelsDerived";

/**
 * The slugs are permalinks, so their uniqueness is a test rather than a hope.
 * Lauviah is both the 11th genius and the 17th, which is the whole reason the
 * rule exists: disambiguate what is ambiguous, and nothing else.
 */
describe("the angels' slugs", () => {
  it("gives every genius one slug, and no slug two genii", () => {
    const slugs = angelSlugs();
    expect(slugs).toHaveLength(ANGEL_COUNT);
    expect(new Set(slugs).size).toBe(ANGEL_COUNT);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("round-trips a slug back to its genius", () => {
    for (let no = 1; no <= ANGEL_COUNT; no++)
      expect(angelBySlug(angelSlug(no))?.no, `genius ${no}`).toBe(no);
    expect(angelBySlug("not-an-angel")).toBeUndefined();
  });

  it("numbers only the name that two genii share", () => {
    expect(angelSlug(11)).toBe("lauviah-11");
    expect(angelSlug(17)).toBe("lauviah-17");
    // Every other slug is the bare name, which is what a reader searches for.
    const numbered = angelSlugs().filter((slug) => /-\d+$/.test(slug));
    expect(numbered).toEqual(["lauviah-11", "lauviah-17"]);
    expect(angelSlug(1)).toBe("vehuiah");
  });

  it("keeps the slug recognisable as the angel's name", () => {
    for (const angel of angels) {
      const stem = angelSlug(angel.no).replace(/-\d+$/, "");
      expect(
        angel.name.en
          .toLowerCase()
          .normalize("NFD")
          .replace(/[^a-z]/g, ""),
      ).toBe(stem.replace(/-/g, ""));
    }
  });
});
