import { describe, expect, it } from "vitest";
import { bookJsonLd, lenainChapterPage, lenainPages } from "./lenain";

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

  it("says the 1823 book is the 1823 printing, and gives it no reissue pages", () => {
    const [work, copy] = bookJsonLd("https://example.test").isBasedOn;
    expect(work.datePublished).toBe("1823");
    expect(work.sameAs).toBe("https://books.google.com/books?id=qt9SAAAAcAAJ");
    // The edition's page numbers are the reissue's, so the 1823 book's
    // chapters carry none.
    expect(work.hasPart?.length).toBeGreaterThan(0);
    for (const chapter of work.hasPart ?? [])
      expect(Object.keys(chapter)).not.toContain("pageStart");
    expect(copy.url).toBe("https://books.google.com/books?id=ZqgpxTZ43HkC");
  });
});
