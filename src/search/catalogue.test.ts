import keys, { aethyrs, hasVersion } from "magick-data/enochian/keys";
import { beforeAll, describe, expect, it } from "vitest";
import { PUBLIC_PAGES } from "@/seo/pages";
import { buildSearchCatalogue } from "./catalogue";
import { createSearchEngine } from "./engine";
import type { SearchCatalogue } from "./types";

let catalogue: SearchCatalogue;
let engine: ReturnType<typeof createSearchEngine>;
beforeAll(async () => {
  catalogue = await buildSearchCatalogue();
  engine = createSearchEngine(catalogue);
});

describe("the real public search catalogue", () => {
  it("includes every public registry page and excludes private/account routes", () => {
    const paths = catalogue.documents.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(expect.arrayContaining(Object.keys(PUBLIC_PAGES)));
    expect(
      paths.some((path) =>
        /^\/(?:temples|admin|signin|chat\/train)(?:\/|$)/.test(path),
      ),
    ).toBe(false);
    expect(paths.filter((path) => path.startsWith("/doc/"))).toEqual([
      "/doc/neophyte",
      "/doc/zelator",
      "/doc/theoricus",
    ]);
    for (const page of catalogue.documents) {
      expect(new Set(page.sections.map((section) => section.id)).size).toBe(
        page.sections.length,
      );
      for (const section of page.sections) {
        expect(section.text).not.toContain("process.env");
        expect(
          section.href === undefined || section.href.startsWith(page.path),
        ).toBe(true);
      }
    }
  });
  it.each([
    ["Planetary hours", "/astrology/planetary-hours"],
    ["Tree of Life", "/kabbalah/tree"],
    ["Qabalah", "/kabbalah"],
    ["עץ חיים", "/kabbalah/tree"],
    ["Vehuiah", "/kabbalah/angel/vehuiah"],
  ])("finds a destination: %s", (query, path) => {
    expect(engine.search(query)[0]?.path).toBe(path);
  });
  it("indexes displayed linked correspondences, including Hebrew archangel names", () => {
    const paths = engine.search("מיכאל").map((result) => result.path);
    expect(paths).toContain("/astrology/planet/sol");
    expect(paths).toContain("/kabbalah/sephirah/hod");
  });

  it("indexes source text beyond SEO descriptions in both languages", () => {
    const angel = catalogue.documents.find(
      (page) => page.path === "/kabbalah/angel/vehuiah",
    )!;
    expect(
      angel.sections.some(
        (section) => section.id.startsWith("en:") && section.text.length > 100,
      ),
    ).toBe(true);
    expect(
      angel.sections.some(
        (section) => section.id.startsWith("fr:") && section.text.length > 100,
      ),
    ).toBe(true);
    expect(
      catalogue.documents
        .find((page) => page.path.endsWith("/chapitre-6"))!
        .sections.some((section) => section.href?.includes("#")),
    ).toBe(true);
    expect(
      catalogue.documents.find((page) => page.path === "/enochian/dictionary")!
        .sections.length,
    ).toBeGreaterThan(1900);
  });

  it("indexes each Key's English and its words in each version it has", () => {
    const ids = catalogue.documents
      .find((page) => page.path === "/enochian/keys")!
      .sections.map((section) => section.id.replace(/:\d+$/, ""));
    for (const key of keys) {
      expect(ids).toContain(`key-${key.key}-en`);
      expect(ids, `Key ${key.key}`).toContain(`key-${key.key}-eo`);
      expect(ids.includes(`key-${key.key}-gd`), `Key ${key.key}`).toBe(
        hasVersion(key, "gd"),
      );
    }
    expect(ids.includes("aethyrs")).toBe(aethyrs.length > 0);
  });
});
