import angels from "magick-data/kabbalah/seventyTwoAngels";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { canonicalSigilText } from "@/render/contracts/roseSigil";
import { LENAIN_VULGATE_VERSES } from "@/render/lenainVulgateVerses";
import {
  ANGEL_SIGIL_BUILT_STYLES,
  allAngelSigilStyleFiles,
  angelJsonLd,
  angelSigilAlt,
  angelSigilEveryStyle,
  angelSigilFiles,
  angelSigilGeneratorHref,
  angelSigilRequest,
  angelSigilRouteFile,
  angelSigilSection,
  angelSigilSocialImage,
  angelSigilStyleAlt,
  angelSigilStyleFiles,
  angelSigilText,
} from "./angelSigils";

const vehuiah = angels[0];

describe("the angels' sigil files", () => {
  it("draws each of the 72 from the site's spelling, which needs no change", () => {
    for (const angel of angels) {
      expect(angel.name.he, String(angel.no)).toBeTruthy();
      expect(angelSigilText(angel)).toBe(angel.name.he);
      expect(canonicalSigilText(angelSigilText(angel))).toBe(angel.name.he);
    }
  });

  it("names the rose's two files under each angel's page, as plan 088 did", () => {
    expect(angelSigilFiles(vehuiah)).toEqual({
      png: {
        name: "vehuiah-rose-cross-sigil.png",
        path: "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.png",
        format: "png",
        style: "rose",
        width: 1024,
        height: 1024,
      },
      svg: {
        name: "vehuiah-rose-cross-sigil.svg",
        path: "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.svg",
        format: "svg",
        style: "rose",
      },
    });
  });

  it("asks for the default rose, shown, at the raster default", () => {
    const { png, svg } = angelSigilFiles(vehuiah);
    const he = encodeURIComponent("והויה");
    expect(angelSigilRequest(vehuiah, png)).toEqual({
      slug: "rose-sigil",
      query: new URLSearchParams(`text=${he}&fmt=png`),
    });
    expect(angelSigilRequest(vehuiah, svg).query.toString()).toBe(`text=${he}`);
  });

  it("names every style's two files, the rose's as they were (plan 096)", () => {
    const files = allAngelSigilStyleFiles();
    expect(files).toHaveLength(576);
    // Each angel's band PNG first, then the rest (decision 4).
    expect(files.slice(0, 8).map(({ file }) => file.name)).toEqual([
      "vehuiah-rose-cross-sigil-band.png",
      "vehuiah-rose-cross-sigil-band.svg",
      "vehuiah-rose-cross-sigil-bare.png",
      "vehuiah-rose-cross-sigil-bare.svg",
      "vehuiah-rose-cross-sigil.png",
      "vehuiah-rose-cross-sigil.svg",
      "vehuiah-rose-cross-sigil-talisman.png",
      "vehuiah-rose-cross-sigil-talisman.svg",
    ]);
    expect(new Set(files.map(({ file }) => file.path)).size).toBe(576);
    for (const { slug, file } of files) {
      expect(file.path).toBe(`/kabbalah/angel/${slug}/${file.name}`);
      expect(file.name).toBe(
        `${slug}-rose-cross-sigil${file.style === "rose" ? "" : `-${file.style}`}.${file.format}`,
      );
      expect(angelSigilRouteFile(slug, file.name)?.file).toEqual(file);
    }
    expect(angelSigilEveryStyle(vehuiah).map(({ png }) => png.name)).toEqual([
      "vehuiah-rose-cross-sigil-band.png",
      "vehuiah-rose-cross-sigil-bare.png",
      "vehuiah-rose-cross-sigil.png",
      "vehuiah-rose-cross-sigil-talisman.png",
    ]);
    expect(angelSigilStyleFiles(angels[46], "talisman").png).toEqual({
      name: "asaliah-rose-cross-sigil-talisman.png",
      path: "/kabbalah/angel/asaliah/asaliah-rose-cross-sigil-talisman.png",
      format: "png",
      style: "talisman",
      width: 1024,
      height: 1024,
    });
    expect(angelSigilFiles(vehuiah)).toEqual(
      angelSigilStyleFiles(vehuiah, "rose"),
    );
    // Built at deploy: the rose's and the band's (decision 3).
    expect(ANGEL_SIGIL_BUILT_STYLES).toEqual(["rose", "band"]);
    for (const [slug, name] of [
      ["vehuiah", "jeliel-rose-cross-sigil-band.png"],
      ["vehuiah", "vehuiah-rose-cross-sigil-rose.png"],
      ["vehuiah", "vehuiah-rose-cross-sigil-band.jpg"],
      ["lauviah", "lauviah-rose-cross-sigil-band.png"],
      ["constructor", "constructor-rose-cross-sigil-band.png"],
    ])
      expect(angelSigilRouteFile(slug, name)).toBeUndefined();
  });

  it("asks angel-sigil for every other style, by slug and style", () => {
    const band = angelSigilStyleFiles(vehuiah, "band");
    expect(angelSigilRequest(vehuiah, band.png)).toEqual({
      slug: "angel-sigil",
      query: new URLSearchParams("angel=vehuiah&fmt=png"),
    });
    expect(angelSigilRequest(vehuiah, band.svg).query.toString()).toBe(
      "angel=vehuiah",
    );
    const talisman = angelSigilStyleFiles(angels[10], "talisman");
    expect(angelSigilRequest(angels[10], talisman.svg).query.toString()).toBe(
      "angel=lauviah-11&style=talisman",
    );
  });

  it("links the generator as its own examples do", () => {
    expect(angelSigilGeneratorHref(vehuiah)).toBe(
      "/gd/sigils?text=%D7%95%D7%94%D7%95%D7%99%D7%94",
    );
  });
});

describe("an angel page's sigil section", () => {
  it("hands the page every style, the band first, with its alt text", () => {
    const section = angelSigilSection(vehuiah);
    expect(section).toMatchObject({
      name: "Vehuiah",
      number: 1,
      hebrew: "והויה",
      psalm: 3,
      genesis: false,
      generatorHref: angelSigilGeneratorHref(vehuiah),
    });
    expect(section.styles.map(({ style }) => style)).toEqual([
      "band",
      "bare",
      "rose",
      "talisman",
    ]);
    for (const entry of section.styles) {
      expect(entry.png).toEqual(angelSigilStyleFiles(vehuiah, entry.style).png);
      expect(entry.svg).toEqual(angelSigilStyleFiles(vehuiah, entry.style).svg);
    }
    // Only Jabamiah letters Genesis, with no psalm.
    const genesis = angels.filter((angel) => angelSigilSection(angel).genesis);
    expect(genesis.map((angel) => angel.no)).toEqual([70]);
    expect(angelSigilSection(angels[69]).psalm).toBe(0);
  });

  it("describes each style in its own words, the rose's as plan 088 did", () => {
    expect(
      Object.fromEntries(
        (["band", "bare", "rose", "talisman"] as const).map((style) => [
          style,
          angelSigilStyleAlt(vehuiah, style),
        ]),
      ),
    ).toEqual({
      band: "The Rose Cross sigil of Vehuiah, והויה, inside a ring with the name in Hebrew",
      bare: "The Rose Cross sigil of Vehuiah, והויה, drawn alone with the name beneath",
      rose: "The Rose Cross sigil of Vehuiah, והויה, traced on the Golden Dawn's rose of 22 letters",
      talisman:
        "A talisman of Vehuiah, והויה: the Rose Cross sigil inside a ring lettered with a verse of Psalm 3 in Latin",
    });
    // The talisman names the psalm only, never a verse number (decision
    // for Gadi 12): Lenain's are often not the Vulgate's. The psalm is the
    // one the verse is from, as the Vulgate numbers it (verses.json5), not
    // always the one Lenain names: a new mismatch fails here.
    for (const angel of angels) {
      const alt = angelSigilStyleAlt(angel, "talisman");
      const { vulgate } = LENAIN_VULGATE_VERSES[String(angel.no)];
      if (angel.psalm.psalm > 0) {
        const psalm = Number(vulgate.match(/^Psalm (\d+):/)?.[1]);
        expect(angelSigilSection(angel).psalm, `angel ${angel.no}`).toBe(psalm);
        expect(alt).toContain(`a verse of Psalm ${psalm} in Latin`);
        expect(alt).not.toMatch(/\d+:\d+/);
      } else {
        expect(vulgate).toBe("Genesis 1:1");
        expect(alt).toContain("Genesis 1:1");
      }
    }
  });

  it("names the psalm the 33rd genius's verse is from, not Lenain's", () => {
    // He cites Psalm 33 for the Vulgate's 93:11 (differences.json5).
    const iehuiah = angels[32];
    expect(iehuiah.psalm.psalm).toBe(33);
    expect(angelSigilStyleAlt(iehuiah, "talisman")).toBe(
      "A talisman of Iehuiah, יהויה: the Rose Cross sigil inside a ring lettered with a verse of Psalm 93 in Latin",
    );
    const talisman = angelJsonLd(iehuiah)["@graph"].find((node) =>
      (node as { "@id"?: string })["@id"]?.endsWith("#sigil-talisman-png"),
    ) as { caption: string };
    expect(talisman.caption).toContain("a verse of Psalm 93 in Latin");
  });
});

describe("an angel page's structured data", () => {
  const graphOf = (angel = vehuiah) =>
    angelJsonLd(angel)["@graph"] as Record<string, unknown>[];

  it("is one graph: the trail, then each style's PNG and SVG, the band first", () => {
    const [trail, ...images] = graphOf();
    expect(trail).toMatchObject({ "@type": "BreadcrumbList" });
    expect(
      (trail as { itemListElement: { item: string }[] }).itemListElement.at(-1),
    ).toMatchObject({
      name: "Vehuiah",
      item: "https://magick.ly/kabbalah/angel/vehuiah",
    });
    expect(images.map((image) => image.contentUrl)).toEqual(
      [
        "band.png",
        "band.svg",
        "bare.png",
        "bare.svg",
        ".png",
        ".svg",
        "talisman.png",
        "talisman.svg",
      ].map(
        (end) =>
          `https://magick.ly/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil${end.startsWith(".") ? "" : "-"}${end}`,
      ),
    );
    const [bandPng, bandSvg] = images;
    expect(bandPng).toMatchObject({
      "@type": "ImageObject",
      "@id": "https://magick.ly/kabbalah/angel/vehuiah#sigil-band-png",
      url: "https://magick.ly/kabbalah/angel/vehuiah",
      name: "Rose Cross sigil of Vehuiah (והויה), in a ring with its name",
      caption: angelSigilStyleAlt(vehuiah, "band"),
      encodingFormat: "image/png",
      width: 1024,
      height: 1024,
      license: "https://creativecommons.org/licenses/by/4.0/",
      acquireLicensePage: "https://magick.ly/about#licence",
      creditText: "Magick.ly, drawn by magick-components (MIT)",
      associatedMedia: {
        "@id": "https://magick.ly/kabbalah/angel/vehuiah#sigil-band-svg",
      },
    });
    expect(bandSvg).toMatchObject({
      "@id": "https://magick.ly/kabbalah/angel/vehuiah#sigil-band-svg",
      encodingFormat: "image/svg+xml",
      caption: angelSigilStyleAlt(vehuiah, "band"),
    });
    // The SVG states only its viewBox, so no pixel size is claimed.
    expect(bandSvg).not.toHaveProperty("width");
    // The rose's caption is plan 088's.
    expect(images[4]).toMatchObject({
      "@id": "https://magick.ly/kabbalah/angel/vehuiah#sigil-rose-png",
      caption: angelSigilAlt(vehuiah),
      name: "Rose Cross sigil of Vehuiah (והויה), on the rose",
    });
    // Each PNG points at its own SVG.
    for (const [i, image] of images.entries())
      if (i % 2 === 0)
        expect(image.associatedMedia).toEqual({ "@id": images[i + 1]["@id"] });
  });

  it("says what each style is based on (decision 4)", () => {
    const basedOn = (i: number) => {
      const value = graphOf()[1 + i].isBasedOn as
        | { url: string; description: string }
        | { url: string; description: string }[];
      return (Array.isArray(value) ? value : [value]).map(
        ({ url, description }) => [url, description.split(",")[0]],
      );
    };
    const regardie = (leaf: number) =>
      `https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n${leaf}/mode/1up`;
    const mathers = "https://archive.org/details/b24884431/page/n79/mode/1up";
    // band, bare, rose and talisman's PNGs; each SVG says the same.
    expect(basedOn(0)).toEqual([
      [mathers, "Plate IV"],
      [regardie(51), "p.57"],
    ]);
    expect(basedOn(2)).toEqual([
      [regardie(51), "p.57"],
      [regardie(52), "p.58"],
    ]);
    expect(basedOn(4)).toEqual([[regardie(51), "p.57"]]);
    expect(basedOn(6)).toEqual([
      [
        "https://books.google.com/books?id=qt9SAAAAcAAJ&pg=PA45",
        "p.45 (the 72 verses written round the genii's talismans)",
      ],
      [mathers, "Plate IV"],
      [regardie(51), "p.57"],
    ]);
    for (let i = 0; i < 8; i += 2) expect(basedOn(i + 1)).toEqual(basedOn(i));
    expect(
      (graphOf()[1].isBasedOn as { description: string }[])[0].description,
    ).toContain("Fig. 18");
    expect(
      (graphOf()[7].isBasedOn as { description: string }[])[1].description,
    ).toContain("Figs. 20 and 21");
  });
});

describe("the two Lauviahs", () => {
  it("are numbered where they are named, as their slugs are, and no one else", () => {
    for (const style of ["band", "bare", "rose", "talisman"] as const) {
      const numbered = angels.filter((angel) =>
        angelSigilStyleAlt(angel, style).includes(" of the 72"),
      );
      expect(
        numbered.map((angel) => angel.no),
        style,
      ).toEqual([11, 17]);
      // Same name, told apart by number.
      expect(angelSigilStyleAlt(angels[10], style)).not.toBe(
        angelSigilStyleAlt(angels[16], style),
      );
    }
    expect(angelSigilAlt(angels[10])).toBe(
      "The Rose Cross sigil of Lauviah, angel 11 of the 72, לאויה, traced on the Golden Dawn's rose of 22 letters",
    );
    const [, png17] = angelJsonLd(angels[16])["@graph"];
    expect(png17).toMatchObject({
      name: "Rose Cross sigil of Lauviah, angel 17 (לאויה), in a ring with its name",
      caption: angelSigilStyleAlt(angels[16], "band"),
    });
  });
});

describe("the sigil as a share image", () => {
  it("is the band's static PNG at its size, described by its alt text", () => {
    expect(angelSigilSocialImage(vehuiah)).toEqual({
      url: "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-band.png",
      width: 1024,
      height: 1024,
      alt: angelSigilStyleAlt(vehuiah, "band"),
    });
  });
});
