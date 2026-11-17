import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import * as publications from "@/i18n/publications";
import { pageMetadata, seoMetadata } from "./metadata";
import { SITE_URL } from "./site";

const homeLanguages = { en: "/", he: "/he", "x-default": "/" };
const aboutLanguages = {
  en: "/about",
  he: "/he/about",
  "x-default": "/about",
};

/** Exercise consumers of the future publication registry without switching on production SEO. */
function publishedEditions() {
  vi.spyOn(publications, "indexableLocalizedPaths").mockReturnValue([
    "/he",
    "/he/about",
  ]);
  vi.spyOn(publications, "publicAlternates").mockImplementation((path) => {
    if (path === "/" || path === "/he") return homeLanguages;
    if (path === "/about" || path === "/he/about") return aboutLanguages;
    return undefined;
  });
}

afterEach(() => vi.restoreAllMocks());

describe("localized SEO publication consumers", () => {
  it("keeps each edition's own canonical and sharing URL alongside reciprocal language alternates", () => {
    publishedEditions();
    for (const path of ["/about", "/he/about"]) {
      const metadata = seoMetadata(path, {
        title: "About",
        description: "About this app.",
      });
      expect(metadata.alternates).toEqual({
        canonical: path,
        languages: aboutLanguages,
      });
      expect(metadata.openGraph).toMatchObject({ url: path });
    }
    expect(pageMetadata("/").alternates).toEqual({
      canonical: "/",
      languages: homeLanguages,
    });
    expect(
      seoMetadata("/astrology", {
        title: "Astrology",
        description: "Tools and tables.",
      }).alternates,
    ).toEqual({
      canonical: "/astrology",
    });
    expect(publications.LOCALIZED_SEO_ENABLED).toBe(false);
  });

  it("includes published editions once and expands root and non-root language URLs in the sitemap", () => {
    publishedEditions();
    const entries = sitemap();
    for (const [path, languages] of [
      ["/", { en: SITE_URL, he: `${SITE_URL}/he`, "x-default": SITE_URL }],
      ["/he", { en: SITE_URL, he: `${SITE_URL}/he`, "x-default": SITE_URL }],
      [
        "/about",
        {
          en: `${SITE_URL}/about`,
          he: `${SITE_URL}/he/about`,
          "x-default": `${SITE_URL}/about`,
        },
      ],
      [
        "/he/about",
        {
          en: `${SITE_URL}/about`,
          he: `${SITE_URL}/he/about`,
          "x-default": `${SITE_URL}/about`,
        },
      ],
    ] as const) {
      const url = path === "/" ? SITE_URL : SITE_URL + path;
      expect(entries.filter((entry) => entry.url === url)).toEqual([
        { url, alternates: { languages } },
      ]);
    }
    expect(entries.filter((entry) => entry.alternates)).toHaveLength(4);
    expect(
      entries.find((entry) => entry.url === `${SITE_URL}/astrology`),
    ).toEqual({
      url: `${SITE_URL}/astrology`,
    });
    expect(publications.LOCALIZED_SEO_ENABLED).toBe(false);
  });
});
