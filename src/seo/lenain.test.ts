import { describe, expect, it } from "vitest";
import { lenainChapterPage, lenainPages } from "./lenain";

describe("La Science Cabalistique's pages", () => {
  it("names a chapter without a subtitle by its English title", () => {
    expect(lenainChapterPage("chapitre-4")?.description).toBe(
      "CHAPITRE IV of Lazare Lenain's La Science Cabalistique (Amiens, " +
        "1823): The Four Cabalistic Tables. Read from the original scan.",
    );
    expect(lenainChapterPage("preliminaires")?.description).not.toMatch(
      /Preliminaries/,
    );
  });

  it("describes every chapter in a snippet's length", () => {
    for (const page of lenainPages()) {
      // Bing reports a description under 110 characters as too short.
      expect(page.description.length, page.path).toBeGreaterThanOrEqual(110);
      expect(page.description.length, page.path).toBeLessThanOrEqual(160);
    }
  });
});
