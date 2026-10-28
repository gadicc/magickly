import { JSDOM } from "jsdom";
import { resolveSitemap } from "next/dist/build/webpack/loaders/metadata/resolve-route-data";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
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
        hallPages().length,
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
        /\/gd\/halls\/(?!editor$)[^/]+$/.test(entry.url)
          ? ["url", "images"]
          : ["url"],
      );
  });

  it("lists each hall's PNG and SVG, absolute and safe to write unescaped", () => {
    const halls = sitemap().filter((entry) => entry.images);
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
    expect(images).toHaveLength(28);
    expect(images[0].textContent).toBe(
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
