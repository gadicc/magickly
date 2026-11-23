import { JSDOM } from "jsdom";
import { resolveSitemap } from "next/dist/build/webpack/loaders/metadata/resolve-route-data";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { indexableLocalizedPaths, publicAlternates } from "@/i18n/publications";
import { componentPages } from "./components";
import { entityPages } from "./entities";
import { hallPages } from "./halls";
import { lenainPages } from "./lenain";
import { PUBLIC_PAGES } from "./pages";

describe("sitemap", () => {
  const urls = sitemap().map((entry) => entry.url);

  it("lists every public and entity page once, as its canonical", () => {
    expect(urls).toHaveLength(
      Object.keys(PUBLIC_PAGES).length +
        entityPages().length +
        lenainPages().length +
        hallPages().length +
        componentPages().length +
        indexableLocalizedPaths().length,
    );
    expect(urls).toContain("https://magick.ly/open-source/components");
    expect(urls).toContain(
      "https://magick.ly/open-source/components/tree-of-life",
    );
    expect(urls).toContain("https://magick.ly/gd/halls/zelator-1");
    expect(urls).toContain("https://magick.ly/gd/halls");
    expect(urls).toContain("https://magick.ly/gd/halls/editor");
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls[0]).toBe("https://magick.ly");
    expect(urls).toContain("https://magick.ly/gd/grade/0=0");
    expect(urls).toContain("https://magick.ly/kabbalah/sephirah/daat");
    expect(urls).toContain("https://magick.ly/kabbalah/path/9_10");
    expect(urls).toContain(
      "https://magick.ly/books/la-science-cabalistique/chapitre-6",
    );
  });

  it("leaves out private pages and query variants", () => {
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/magick\.ly(\/[^?#]*)?$/);
      // The temples guide under /help is public; the temple screens are not.
      expect(url).not.toMatch(
        /\/(admin|signin|upload|offline|chat\/train|gd\/components)\b|^https:\/\/magick\.ly\/temples\b/,
      );
    }
  });

  it("indexes current authoring and temple help but excludes retired syntax recovery", () => {
    expect(urls).toContain("https://magick.ly/help/ritual-pug");
    expect(urls).toContain("https://magick.ly/help/temples");
    expect(urls).not.toContain("https://magick.ly/help/ritual-text");
  });

  it("claims no change frequency, priority or modification date", () => {
    for (const entry of sitemap())
      expect(Object.keys(entry)).toEqual(
        /\/gd\/halls\/(?!editor$)[^/]+$|\/kabbalah\/angel\/[^/]+$|\/astrology\/kamea\/(?!sigils$)[^/]+$|\/astrology\/(?:intelligence|spirit)\/[^/]+$/.test(
          entry.url,
        )
          ? ["url", "images"]
          : publicAlternates(new URL(entry.url).pathname)
            ? ["url", "alternates"]
            : ["url"],
      );
  });

  it("lists each hall's PNG and SVG, absolute and safe to write unescaped", () => {
    const halls = sitemap().filter(
      (entry) => entry.images && entry.url.includes("/gd/halls/"),
    );
    expect(halls).toHaveLength(14);
    expect(halls[1]).toEqual({
      url: "https://magick.ly/gd/halls/zelator-1",
      images: [
        "https://magick.ly/gd/halls/zelator-1/golden-dawn-zelator-1-temple.png",
        "https://magick.ly/gd/halls/zelator-1/golden-dawn-zelator-1-temple.svg",
      ],
    });
    for (const entry of halls)
      for (const image of entry.images ?? [])
        expect(image).toMatch(
          /^https:\/\/magick\.ly\/gd\/halls\/[a-z0-9/.-]+$/,
        );
  });

  it("lists each angel's sigils, the band's PNG first (plan 096, decision 4)", () => {
    const angels = sitemap().filter((entry) =>
      entry.url.includes("/kabbalah/angel/"),
    );
    expect(angels).toHaveLength(72);
    const page = "https://magick.ly/kabbalah/angel/vehuiah";
    expect(angels[0]).toEqual({
      url: page,
      images: [
        `${page}/vehuiah-rose-cross-sigil-band.png`,
        `${page}/vehuiah-rose-cross-sigil-band.svg`,
        `${page}/vehuiah-rose-cross-sigil-bare.png`,
        `${page}/vehuiah-rose-cross-sigil-bare.svg`,
        // The rose's, plan 088's files.
        `${page}/vehuiah-rose-cross-sigil.png`,
        `${page}/vehuiah-rose-cross-sigil.svg`,
        `${page}/vehuiah-rose-cross-sigil-talisman.png`,
        `${page}/vehuiah-rose-cross-sigil-talisman.svg`,
      ],
    });
    for (const entry of angels) {
      const page = entry.url;
      expect(entry.images).toEqual(
        ["-band.png", "-band.svg", "-bare.png", "-bare.svg", ".png", ".svg"]
          .concat(["-talisman.png", "-talisman.svg"])
          .map(
            (end) => `${page}/${page.split("/").at(-1)}-rose-cross-sigil${end}`,
          ),
      );
      for (const image of entry.images ?? [])
        expect(image).toMatch(
          /^https:\/\/magick\.ly\/kabbalah\/angel\/[a-z0-9-]+\/[a-z0-9-]+\.(?:png|svg)$/,
        );
    }
    expect(sitemap().filter((entry) => entry.images)).toHaveLength(
      14 + 72 + 7 + 16,
    );
  });

  it("lists each kamea's square, the PNG then the SVG (plan 093, K4)", () => {
    const kameas = sitemap().filter((entry) =>
      /\/astrology\/kamea\/(?!sigils$)[^/]+$/.test(entry.url),
    );
    expect(kameas.map((entry) => entry.url)).toEqual(
      ["saturn", "jupiter", "mars", "sol", "venus", "mercury", "luna"].map(
        (planet) => `https://magick.ly/astrology/kamea/${planet}`,
      ),
    );
    expect(kameas[3]).toEqual({
      url: "https://magick.ly/astrology/kamea/sol",
      images: [
        "https://magick.ly/astrology/kamea/sol/kamea-of-the-sun-magic-square.png",
        "https://magick.ly/astrology/kamea/sol/kamea-of-the-sun-magic-square.svg",
      ],
    });
    // The hub and the generator have no image files of their own.
    for (const path of ["/astrology/kamea", "/astrology/kamea/sigils"])
      expect(
        sitemap().find((entry) => entry.url === `https://magick.ly${path}`),
      ).toEqual({ url: `https://magick.ly${path}` });
  });

  it("lists each planetary name's sigil, the PNG then the SVG (plan 093, K4)", () => {
    const names = sitemap().filter((entry) =>
      /\/astrology\/(?:intelligence|spirit)\//.test(entry.url),
    );
    expect(names).toHaveLength(16);
    expect(names[1]).toEqual({
      url: "https://magick.ly/astrology/spirit/zazel",
      images: [
        "https://magick.ly/astrology/spirit/zazel/sigil-of-zazel.png",
        "https://magick.ly/astrology/spirit/zazel/sigil-of-zazel.svg",
      ],
    });
  });

  it("writes XML that parses, with the image namespace", () => {
    const xml = resolveSitemap(sitemap());
    const { DOMParser } = new JSDOM().window;
    const document = new DOMParser().parseFromString(xml, "application/xml");
    expect(document.getElementsByTagName("parsererror")).toHaveLength(0);
    const urls = document.getElementsByTagName("url");
    expect(urls).toHaveLength(sitemap().length);
    const images = document.getElementsByTagNameNS(
      "http://www.google.com/schemas/sitemap-image/1.1",
      "loc",
    );
    // The kameas' come first, with the public pages; then the angels' and
    // the planetary names', with the entity pages; then the halls'.
    expect(images).toHaveLength(14 + 576 + 32 + 28);
    expect(images[0].textContent).toBe(
      "https://magick.ly/astrology/kamea/saturn/kamea-of-saturn-magic-square.png",
    );
    expect(images[14].textContent).toBe(
      "https://magick.ly/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-band.png",
    );
    expect(images[14 + 576].textContent).toBe(
      "https://magick.ly/astrology/intelligence/agiel/sigil-of-agiel.png",
    );
    expect(images[14 + 576 + 32].textContent).toBe(
      "https://magick.ly/gd/halls/neophyte/golden-dawn-neophyte-temple.png",
    );
  });
});

describe("robots", () => {
  it("keeps APIs out of the crawl except the public renderers", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: ["/", "/api/render/", "/api/treeOfLife"],
        disallow: ["/api/", "/chat/api/"],
      },
      sitemap: "https://magick.ly/sitemap.xml",
    });
  });
});
