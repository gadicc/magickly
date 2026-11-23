import names from "magick-data/astrology/planetaryNames";
import { describe, expect, it } from "vitest";
import { CONTRACTS } from "@/render/contracts";
import { socialCards } from "./cardList";
import { type CardArt, socialCard } from "./cards";
import { entityPages } from "./entities";
import { PUBLIC_PAGES } from "./pages";
import {
  allPlanetaryNameSigilFiles,
  planetaryNameCardArt,
  planetaryNameCardColumns,
  planetaryNameJsonLd,
  planetaryNamePage,
  planetaryNamePages,
  planetaryNameSigilAlt,
  planetaryNameSigilFiles,
  planetaryNameSigilQuery,
  planetaryNameSigilText,
  planetaryNameSocialImage,
} from "./planetaryNames";

describe("the planetary names' pages for search", () => {
  it("names each page with the search it answers, within a snippet's bounds", () => {
    const pages = planetaryNamePages();
    expect(pages).toHaveLength(16);
    expect(planetaryNamePage(names.agiel)).toEqual({
      path: "/astrology/intelligence/agiel",
      title: "Sigil of Agiel, Intelligence of Saturn",
      description:
        "The sigil of Agiel, the intelligence of Saturn, traced on its kamea, with its Hebrew אגיאל, the number 45 and Agrippa's own character.",
    });
    expect(planetaryNamePage(names.nakhiel).title).toBe(
      "Sigil of Nakhiel, Intelligence of the Sun",
    );
    // Too long for the planet: the sigil and the name.
    expect(planetaryNamePage(names["schedbarschemoth-schartathan"]).title).toBe(
      "Sigil of Schedbarschemoth Schartathan",
    );
    for (const page of pages) {
      expect(page.title.length, page.path).toBeLessThanOrEqual(48);
      expect(page.description.length, page.path).toBeGreaterThanOrEqual(110);
      expect(page.description.length, page.path).toBeLessThanOrEqual(160);
    }
    expect(new Set(pages.map((page) => page.title)).size).toBe(16);
    expect(new Set(pages.map((page) => page.description)).size).toBe(16);
  });

  it("gives Agrippa's spelling where it differs, and not his misprinted number", () => {
    expect(planetaryNamePage(names.bartzabel).description).toContain(
      "Agrippa's spelling Barzabel",
    );
    // Kedemel: 1533 prints 157 for the 175 its letters give.
    expect(planetaryNamePage(names.kedemel).description).toContain(
      "the number 175",
    );
  });

  it("lists every name page among the entity pages, as the sitemap and cards read them", () => {
    const paths = entityPages().map((page) => page.path);
    for (const page of planetaryNamePages()) expect(paths).toContain(page.path);
    const titles = [
      ...entityPages().map((page) => page.title),
      ...Object.values(PUBLIC_PAGES).map((page) => page.title),
    ];
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe("the planetary names' static sigil files", () => {
  it("names two files under each name's page, the PNG first", () => {
    const files = allPlanetaryNameSigilFiles();
    expect(files).toHaveLength(32);
    expect(new Set(files.map(({ file }) => file.path)).size).toBe(32);
    expect(planetaryNameSigilFiles(names.zazel)).toEqual({
      png: {
        name: "sigil-of-zazel.png",
        path: "/astrology/spirit/zazel/sigil-of-zazel.png",
        format: "png",
        width: 1024,
        height: 1024,
      },
      svg: {
        name: "sigil-of-zazel.svg",
        path: "/astrology/spirit/zazel/sigil-of-zazel.svg",
        format: "svg",
      },
    });
    // A square a word: the Moon's five-word intelligence of intelligences.
    expect(
      planetaryNameSigilFiles(names["malcha-betharsisim"]).png,
    ).toMatchObject(
      CONTRACTS["kamea-sigil"].rasterDefaultOf?.({
        planet: "luna",
        text: planetaryNameSigilText(names["malcha-betharsisim"]),
        finals: false,
      }) as object,
    );
  });

  it("draws each through the kamea-sigil contract: 1533's spelling, finals as ordinary letters", () => {
    const { png, svg } = planetaryNameSigilFiles(names.agiel);
    expect(planetaryNameSigilQuery(names.agiel, png).toString()).toBe(
      new URLSearchParams({
        planet: "saturn",
        text: "אגיאל",
        fmt: "png",
      }).toString(),
    );
    expect(planetaryNameSigilQuery(names.agiel, svg).get("finals")).toBeNull();
    // Decision 10: the spirit of spirits, divided as its romanisation is.
    expect(planetaryNameSigilText(names["schedbarschemoth-schartathan"])).toBe(
      "שדברשהמעת שרתתן",
    );
    expect(CONTRACTS["kamea-sigil"].indexed).toBe(false);
  });

  it("describes each sigil in its own words, and shares it after the card", () => {
    expect(planetaryNameSigilAlt(names.agiel)).toBe(
      "The sigil of Agiel, אגיאל, traced on the Kamea of Saturn by the method Regardie sets out",
    );
    expect(planetaryNameSocialImage(names.sorath)).toEqual({
      url: "/astrology/spirit/sorath/sigil-of-sorath.png",
      width: 1024,
      height: 1024,
      alt: planetaryNameSigilAlt(names.sorath),
    });
  });

  it("draws each name's card with its own sigil", () => {
    const card = socialCards().find(
      (entry) =>
        entry.segments.join("/") === "astrology/intelligence/agiel.png",
    );
    expect(card?.art).toEqual(planetaryNameCardArt(names.agiel));
    expect(card?.art).toEqual({
      kind: "diagram",
      slug: "kamea-sigil",
      // By width: a long name's row is too wide to ask for by height.
      query: new URLSearchParams({
        planet: "saturn",
        text: "אגיאל",
        width: "880",
      }).toString(),
      raster: "query",
    });
    expect(card?.section).toBe("Astrology");
    // A name of more words in rows, drawing its squares largest.
    expect(
      [1, 2, 3, 4, 5].map((words) => planetaryNameCardColumns(words)),
    ).toEqual([1, 1, 2, 2, 2]);
    const malcha = new URLSearchParams(
      (
        planetaryNameCardArt(names["malcha-betharsisim"]) as Extract<
          CardArt,
          { kind: "diagram" }
        >
      ).query,
    );
    expect(malcha.get("text")?.split(" ")).toHaveLength(5);
    expect(malcha.get("columns")).toBe("2");
    expect(malcha.get("width")).toBe("880");
    // The planet pages keep their section's art.
    expect(socialCard("/astrology/planet/saturn", "x").art).not.toEqual(
      card?.art,
    );
  });

  it("gives each file an ImageObject based on Agrippa's leaves and Regardie's method", () => {
    const graph = planetaryNameJsonLd(names.agiel)["@graph"];
    expect(graph.map((node) => node["@type"])).toEqual([
      "BreadcrumbList",
      "ImageObject",
      "ImageObject",
    ]);
    const [trail, png, svg] = graph as Record<string, unknown>[];
    expect(
      (trail.itemListElement as { name: string; item: string }[]).map(
        (crumb) => crumb.item,
      ),
    ).toEqual([
      "https://magick.ly",
      "https://magick.ly/astrology",
      "https://magick.ly/astrology/kamea",
      "https://magick.ly/astrology/kamea/saturn",
      "https://magick.ly/astrology/intelligence/agiel",
    ]);
    expect(png).toMatchObject({
      contentUrl:
        "https://magick.ly/astrology/intelligence/agiel/sigil-of-agiel.png",
      url: "https://magick.ly/astrology/intelligence/agiel",
      encodingFormat: "image/png",
      width: 1024,
      height: 1024,
      caption: planetaryNameSigilAlt(names.agiel),
      license: "https://creativecommons.org/licenses/by/4.0/",
      associatedMedia: { "@id": svg["@id"] },
    });
    expect(svg.encodingFormat).toBe("image/svg+xml");
    const sources = png.isBasedOn as { description: string; url: string }[];
    expect(sources.map((source) => source.url)).toEqual([
      "https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n163/mode/1up",
      "https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n164/mode/1up",
      "https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n72/mode/1up",
    ]);
    expect(sources[0].description).toBe(
      "book II, chapter 22, p. CXLVIII, archive.org leaf n163 (the name Agiel)",
    );
    expect(sources[1].description).toContain("the character of Agiel");
  });
});
