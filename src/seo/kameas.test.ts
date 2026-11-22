import { KAMEA_PLANETS } from "magick-data/astrology/kameas";
import { describe, expect, it } from "vitest";
import { CONTRACTS } from "@/render/contracts";
import { socialCard } from "./cards";
import {
  allKameaFiles,
  kameaAlt,
  kameaFiles,
  kameaJsonLd,
  kameaQuery,
  kameaSocialImage,
} from "./kameas";

describe("the kameas' static files", () => {
  it("names two files under each kamea's page, the PNG first", () => {
    const files = allKameaFiles();
    expect(files).toHaveLength(14);
    expect(new Set(files.map(({ file }) => file.path)).size).toBe(14);
    for (const { planet, file } of files) {
      expect(file.path).toBe(`/astrology/kamea/${planet}/${file.name}`);
      expect(file.name).toMatch(/^kamea-of-[a-z-]+-magic-square\.(?:png|svg)$/);
    }
    expect(kameaFiles("sol")).toEqual({
      png: {
        name: "kamea-of-the-sun-magic-square.png",
        path: "/astrology/kamea/sol/kamea-of-the-sun-magic-square.png",
        format: "png",
        width: 1024,
        height: 1024,
      },
      svg: {
        name: "kamea-of-the-sun-magic-square.svg",
        path: "/astrology/kamea/sol/kamea-of-the-sun-magic-square.svg",
        format: "svg",
      },
    });
  });

  it("draws each through the kamea contract at its raster default", () => {
    const { png, svg } = kameaFiles("luna");
    expect(kameaQuery("luna", png).toString()).toBe("planet=luna&fmt=png");
    expect(kameaQuery("luna", svg).toString()).toBe("planet=luna");
    expect(CONTRACTS.kamea.rasterDefault).toEqual({
      width: png.width,
      height: png.height,
    });
    // The route's copies stay out of the index; these are the ones in it.
    expect(CONTRACTS.kamea.indexed).toBe(false);
  });

  it("describes each square in its own words, in English for the data", () => {
    expect(kameaAlt("sol")).toBe(
      "Kamea of the Sun, the magic square of 6 by 6: the numbers 1 to 36, every row, column and diagonal adding up to 111, and the whole to 666, as Agrippa prints it",
    );
    expect(new Set(KAMEA_PLANETS.map(kameaAlt)).size).toBe(7);
    // Venus' and the Moon's squares correct a misprinted cell of 1533's.
    expect(kameaAlt("venus")).toMatch(
      /as Agrippa prints it with one misprinted number corrected$/,
    );
    expect(kameaAlt("saturn")).toMatch(/as Agrippa prints it$/);
    expect(kameaSocialImage("venus")).toEqual({
      url: "/astrology/kamea/venus/kamea-of-venus-magic-square.png",
      width: 1024,
      height: 1024,
      alt: kameaAlt("venus"),
    });
  });

  it("gives each file an ImageObject based on Agrippa's leaf of the square", () => {
    const graph = kameaJsonLd("mars")["@graph"];
    expect(graph.map((node) => node["@type"])).toEqual([
      "ImageObject",
      "ImageObject",
    ]);
    const [png, svg] = graph;
    expect(png.contentUrl).toBe(
      "https://magick.ly/astrology/kamea/mars/kamea-of-mars-magic-square.png",
    );
    expect(png).toMatchObject({
      url: "https://magick.ly/astrology/kamea/mars",
      encodingFormat: "image/png",
      width: 1024,
      height: 1024,
      license: "https://creativecommons.org/licenses/by/4.0/",
      associatedMedia: { "@id": svg["@id"] },
    });
    expect(svg.encodingFormat).toBe("image/svg+xml");
    expect(svg).not.toHaveProperty("width");
    expect(png.isBasedOn).toMatchObject({
      "@type": "Book",
      datePublished: "1533",
      url: "https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n165/mode/1up",
    });
    expect(png.isBasedOn.description).toContain("p. CL,");
  });

  it("draws each kamea page's card with its own square, the hub's with the Sun's", () => {
    for (const planet of KAMEA_PLANETS)
      expect(socialCard(`/astrology/kamea/${planet}`, "x")).toMatchObject({
        section: "Astrology",
        art: { kind: "diagram", slug: "kamea", query: `planet=${planet}` },
      });
    expect(socialCard("/astrology/kamea", "x").art).toEqual({
      kind: "diagram",
      slug: "kamea",
      query: "planet=sol",
    });
    // The generator keeps its own.
    expect(socialCard("/astrology/kamea/sigils", "x").art).toMatchObject({
      slug: "kamea-sigil",
    });
  });
});
