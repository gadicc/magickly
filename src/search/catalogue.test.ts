import keys, { aethyrs, hasVersion } from "magick-data/enochian/keys";
import { beforeAll, describe, expect, it } from "vitest";
import { PUBLIC_PAGES } from "@/seo/pages";
import { buildSearchCatalogue, tabletNamesText } from "./catalogue";
import { createSearchEngine } from "./engine";
import prose from "./generated/prose.json";
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
    // The public rituals are found by their metadata; the reader's own
    // controls and messages are not their text (plan 089, item 9).
    for (const page of catalogue.documents.filter((page) =>
      page.path.startsWith("/doc/"),
    )) {
      expect(page.title).toMatch(/ Ritual$/);
      expect(
        page.sections.filter((section) => section.id.startsWith("prose:")),
      ).toEqual([]);
      expect(JSON.stringify(page)).not.toMatch(/More Variables|not found/);
    }
    // Nor is it extracted for them in the first place.
    expect(
      Object.keys(prose).filter((path) => path.startsWith("/doc/")),
    ).toEqual([]);
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

  it("indexes each kamea's square and its names by every witness (plan 093, K4)", () => {
    const saturn = catalogue.documents.find(
      (page) => page.path === "/astrology/kamea/saturn",
    )!;
    expect(saturn.aliases).toContain("Magic square of Saturn");
    const text = saturn.sections.map((section) => section.text).join(" ");
    expect(text).toContain("4 9 2, 3 5 7, 8 1 6");
    for (const word of ["Agiel", "אגיאל", "Zazel", "Daemonium", "AGIEL"])
      expect(text).toContain(word);
    expect(engine.search("Kamea of the Sun")[0]?.path).toBe(
      "/astrology/kamea/sol",
    );
    expect(engine.search("magic square of Jupiter")[0]?.path).toBe(
      "/astrology/kamea/jupiter",
    );
    expect(engine.search("Taphthartharath").map((r) => r.path)).toContain(
      "/astrology/kamea/mercury",
    );
    // Each square's document is its own: the Moon's paragraphs on the
    // Moon's alone, each square's construction and notes on its own page,
    // and none of the component's other branches (plan 093, K4 review).
    const textAt = (path: string) =>
      catalogue.documents
        .find((page) => page.path === path)!
        .sections.map((section) => section.text)
        .join(" ");
    for (const planet of [
      "saturn",
      "jupiter",
      "mars",
      "sol",
      "venus",
      "mercury",
    ]) {
      const own = textAt(`/astrology/kamea/${planet}`);
      expect(own, planet).not.toContain("Shelachel");
      expect(own, planet).not.toContain(
        "the tens from 10 to 80 stand in one column",
      );
      expect(own, planet).not.toMatch(/A magic square of\s+by\s+:/);
    }
    expect(textAt("/astrology/kamea/luna")).toContain("Shelachel");
    expect(textAt("/astrology/kamea/saturn")).toContain(
      "A magic square of 3 by 3: the numbers 1 to 9",
    );
    expect(textAt("/astrology/kamea/saturn")).not.toContain("square of six");
    expect(textAt("/astrology/kamea/sol")).toContain("square of six");
    const top = (query: string) => engine.search(query)[0]?.path;
    expect(top("Moon's column")).toBe("/astrology/kamea/luna");
    // The planet's page names Shelachel too; of the squares, the Moon's alone.
    const shelachel = engine.search("Shelachel").map((r) => r.path);
    expect(shelachel).toContain("/astrology/kamea/luna");
    expect(
      shelachel.filter((path) => path.startsWith("/astrology/kamea/")),
    ).toEqual(["/astrology/kamea/luna"]);
    expect(top("square of six")).toBe("/astrology/kamea/sol");
    expect(top("43 twice")).toBe("/astrology/kamea/venus");
    // The hub outranks the components explorer's Kamea.
    expect(top("kamea")).toBe("/astrology/kamea");
    // The hub's own prose reaches the index through its components.
    const hub = catalogue.documents.find(
      (page) => page.path === "/astrology/kamea",
    )!;
    expect(
      hub.sections.some((section) => section.text.includes("Aiq Bekar")),
    ).toBe(true);
  });

  it("indexes each planetary name's page under every witness's spelling (plan 093, K4)", () => {
    const bartzabel = catalogue.documents.find(
      (page) => page.path === "/astrology/spirit/bartzabel",
    )!;
    for (const alias of [
      "Bartzabel",
      "Sigil of Bartzabel",
      "Barzabel",
      "ברצאבאל",
      "ברצבאל",
      "BARTZABEL",
    ])
      expect(bartzabel.aliases).toContain(alias);
    const text = bartzabel.sections.map((section) => section.text).join(" ");
    // The reduction, and the verdict on the character.
    expect(text).toContain("ר 200 20");
    expect(text).toContain("777's spelling");
    expect(engine.search("sigil of Agiel")[0]?.path).toBe(
      "/astrology/intelligence/agiel",
    );
    expect(engine.search("Barzabel").map((r) => r.path)).toContain(
      "/astrology/spirit/bartzabel",
    );
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

  it("indexes each tablet's names and lede on its own page, not the hub (plan 100)", () => {
    const text = Object.fromEntries(tabletNamesText());
    expect(Object.keys(text).sort()).toEqual([
      "air",
      "earth",
      "fire",
      "union",
      "water",
    ]);
    expect(text.earth).toMatch(
      /^Holy names: Mor Dial Hctga\. King: Iczhihal\. Seniors: Laidrom Aczinor Lzinopo Alhctga Ahmlicv Liiansa\. Air of Earth: Angpoi Unnax Boza Aira Ormn Rsni Iznr; with the Union's letters: Nboza Aaira Aormn Arsni Aiznr\./,
    );
    expect(text.union).toBe(
      "Lines: Exarp Hcoma Nanta Bitom. First column: Ehnb.",
    );
    const documentAt = (path: string) =>
      catalogue.documents.find((each) => each.path === path)!;
    // Each page its own document: its lede and note, then its names.
    for (const [id, names] of tabletNamesText()) {
      const page = documentAt(`/enochian/tablets/${id}`);
      expect(
        page.sections.map((section) => section.id.replace(/:\d+$/, "")),
        id,
      ).toEqual(["tablet", "names"]);
      expect(page.sections[1]).toMatchObject({
        title: "Names on the tablet",
        text: names,
        href: `/enochian/tablets/${id}#names`,
      });
    }
    expect(documentAt("/enochian/tablets/earth").sections[0]?.text).toMatch(
      /^The Earth tablet is one of the four Watchtowers of Enochian magic\. Its three holy names are Mor, Dial and Hctga, and its King is Iczhihal\. The Watchtower of the North, Earth,/,
    );
    expect(documentAt("/enochian/tablets/union").sections[0]?.text).toMatch(
      /^The Tablet of Union joins the four Watchtowers of Enochian magic\. Its four lines are Exarp, Hcoma, Nanta and Bitom\./,
    );
    expect(documentAt("/enochian/tablets/fire").aliases).toEqual(
      expect.arrayContaining(["Fire Watchtower", "Watchtower of the South"]),
    );
    // The hub files the tool's prose, no longer the tablets' names.
    const hub = documentAt("/enochian/tablets");
    expect(
      hub.sections.some((section) => section.text.includes("Laidrom")),
    ).toBe(false);
    for (const [name, id] of [
      ["Laidrom", "earth"],
      ["Bataivah", "air"],
      ["Boza", "earth"],
      ["Edlprnaa", "fire"],
      ["Nboza", "earth"],
      ["Exarp", "union"],
    ])
      expect(
        engine.search(name).map((result) => result.path),
        name,
      ).toContain(`/enochian/tablets/${id}`);
  });
});
