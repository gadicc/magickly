import angels from "magick-data/kabbalah/seventyTwoAngels";
import { describe, expect, it } from "vitest";
import { angelSlug } from "@/lib/angelSlugs";
import { canonicalSigilText } from "@/render/contracts/roseSigil";
import {
  ANGEL_SIGIL_BUILT_STYLES,
  allAngelSigilFiles,
  allAngelSigilStyleFiles,
  angelJsonLd,
  angelSigilAlt,
  angelSigilEveryStyle,
  angelSigilFiles,
  angelSigilGeneratorHref,
  angelSigilRequest,
  angelSigilRouteFile,
  angelSigilSocialImage,
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

  it("names two files under each angel's page, the PNG first", () => {
    const files = allAngelSigilFiles();
    expect(files).toHaveLength(144);
    expect(new Set(files.map(({ file }) => file.path)).size).toBe(144);
    for (const { slug, angel, file } of files) {
      expect(slug).toBe(angelSlug(angel.no));
      expect(file.path).toBe(`/kabbalah/angel/${slug}/${file.name}`);
      expect(file.name).toMatch(/^[a-z0-9-]+-rose-cross-sigil\.(?:png|svg)$/);
    }
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
    // Only the rose's: the pages and the sitemap name these until plan
    // 096's Y4.
    expect(new Set(files.map(({ file }) => file.style))).toEqual(
      new Set(["rose"]),
    );
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

describe("an angel page's structured data", () => {
  it("is one graph: the trail, then the PNG and the SVG", () => {
    const data = angelJsonLd(vehuiah);
    const [trail, png, svg] = data["@graph"];
    expect(trail).toMatchObject({ "@type": "BreadcrumbList" });
    expect(
      (trail as { itemListElement: { item: string }[] }).itemListElement.at(-1),
    ).toMatchObject({
      name: "Vehuiah",
      item: "https://magick.ly/kabbalah/angel/vehuiah",
    });
    const caption = angelSigilAlt(vehuiah);
    expect(caption).toBe(
      "The Rose Cross sigil of Vehuiah, והויה, traced on the Golden Dawn's rose of 22 letters",
    );
    expect(png).toMatchObject({
      "@type": "ImageObject",
      "@id": "https://magick.ly/kabbalah/angel/vehuiah#sigil-png",
      contentUrl:
        "https://magick.ly/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.png",
      url: "https://magick.ly/kabbalah/angel/vehuiah",
      name: "Rose Cross sigil of Vehuiah (והויה)",
      caption,
      encodingFormat: "image/png",
      width: 1024,
      height: 1024,
      license: "https://creativecommons.org/licenses/by/4.0/",
      acquireLicensePage: "https://magick.ly/about#licence",
      creditText: "Magick.ly, drawn by magick-components (MIT)",
      associatedMedia: {
        "@id": "https://magick.ly/kabbalah/angel/vehuiah#sigil-svg",
      },
      isBasedOn: {
        "@type": "Book",
        url: "https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n51/mode/1up",
      },
    });
    expect(svg).toMatchObject({
      "@type": "ImageObject",
      "@id": "https://magick.ly/kabbalah/angel/vehuiah#sigil-svg",
      contentUrl:
        "https://magick.ly/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.svg",
      encodingFormat: "image/svg+xml",
      caption,
    });
    // The SVG states only its viewBox, so no pixel size is claimed.
    expect(svg).not.toHaveProperty("width");
  });
});

describe("the two Lauviahs", () => {
  it("are numbered where they are named, as their slugs are, and no one else", () => {
    const numbered = angels.filter((angel) =>
      angelSigilAlt(angel).includes(" of the 72"),
    );
    expect(numbered.map((angel) => angel.no)).toEqual([11, 17]);
    expect(angelSigilAlt(angels[10])).toBe(
      "The Rose Cross sigil of Lauviah, angel 11 of the 72, לאויה, traced on the Golden Dawn's rose of 22 letters",
    );
    const [, png17] = angelJsonLd(angels[16])["@graph"];
    expect(png17).toMatchObject({
      name: "Rose Cross sigil of Lauviah, angel 17 (לאויה)",
      caption: angelSigilAlt(angels[16]),
    });
    // Same name, same sigil, told apart by number.
    expect(angelSigilAlt(angels[10])).not.toBe(angelSigilAlt(angels[16]));
  });
});

describe("the sigil as a share image", () => {
  it("is the static PNG at its size, described by its alt text", () => {
    expect(angelSigilSocialImage(vehuiah)).toEqual({
      url: "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.png",
      width: 1024,
      height: 1024,
      alt: angelSigilAlt(vehuiah),
    });
  });
});
