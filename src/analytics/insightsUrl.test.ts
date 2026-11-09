import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import {
  insightsPath,
  insightsUrl,
  isPublicPath,
  PRIVATE_SECTIONS,
  PUBLIC_SECTIONS,
} from "./insightsUrl";

const at = (path: string) => `https://magick.ly${path}`;
const APP = join(__dirname, "../app");

/** Every `page.tsx` under the app directory, as a path relative to it. */
function pages(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return pages(full);
    return entry.name === "page.tsx" ? [relative(APP, full)] : [];
  });
}

describe("insightsUrl", () => {
  it("reports every sitemap page by its own path", () => {
    for (const { url } of sitemap()) {
      const { origin, pathname } = new URL(url);
      expect(isPublicPath(pathname), pathname).toBe(true);
      expect(insightsUrl(url)).toBe(origin + pathname);
    }
  });

  it("keeps a temple invite's password out", () => {
    for (const pass of ["s3cret-pass", "rose+cross", "a%c3%a9", "x=1;y@z"])
      expect(insightsPath(`/temples/join/hermes/${pass}`)).toBe("/temples/*");
  });

  it("reports private pages by their section", () => {
    expect(insightsUrl(at("/doc/0192f0aa-1111-7222-8333-444455556666"))).toBe(
      at("/doc/*"),
    );
    expect(insightsPath("/doc/0192f0aa/edit/semantic")).toBe("/doc/*");
    expect(insightsPath("/temples/admin/42/membership/7")).toBe("/temples/*");
    expect(insightsPath("/study/my-set")).toBe("/study/*");
    expect(insightsPath("/temples")).toBe("/temples");
    expect(insightsPath("/signin")).toBe("/signin");
  });

  it("reports unknown or disguised paths as /*", () => {
    expect(insightsPath("/temples%2Fjoin%2Fhermes%2Fpass")).toBe("/*");
    expect(insightsPath("/gd%2F..%2Ftemples")).toBe("/*");
    expect(insightsPath("/kabbalah/a%5Cb")).toBe("/*");
    expect(insightsPath("//temples/join/x/y")).toBe("/*");
    expect(insightsPath("/pasted-secret-token")).toBe("/*");
  });

  it("drops query strings, fragments and trailing slashes", () => {
    expect(insightsUrl(at("/signin?callbackURL=/doc/abc#top"))).toBe(
      at("/signin"),
    );
    expect(insightsUrl(at("/kabbalah/tree/?sephirah=keter"))).toBe(
      at("/kabbalah/tree"),
    );
    expect(insightsUrl(at("/?utm_source=x"))).toBe(at("/"));
  });

  it("sends nothing for a URL that does not parse", () => {
    expect(insightsUrl("not a url")).toBeNull();
  });

  it("does not take a public name inside a private section as public", () => {
    expect(isPublicPath("/doc/neophyte/edit")).toBe(false);
    expect(isPublicPath("/gdx")).toBe(false);
    expect(isPublicPath("/studyx")).toBe(false);
  });
});

describe("the sections insightsUrl knows", () => {
  it("name every top-level section of the app", () => {
    const sections = new Set(
      pages()
        .map((page) => page.split("/"))
        .filter((parts) => parts.length > 1)
        .map(([section]) => section),
    );
    for (const section of sections)
      expect(
        PUBLIC_SECTIONS.has(section) || PRIVATE_SECTIONS.has(section),
        section,
      ).toBe(true);
  });

  // A dynamic page in a public section is reported in full, so each one is
  // reviewed here, and limited to the values it builds.
  it("hold only reviewed, static dynamic pages in public sections", () => {
    const dynamic = pages().filter(
      (page) => PUBLIC_SECTIONS.has(page.split("/")[0]) && page.includes("["),
    );
    expect(dynamic.sort()).toEqual([
      "astrology/planet/[id]/page.tsx",
      "books/la-science-cabalistique/[division]/page.tsx",
      "gd/grade/[id]/page.tsx",
      "gd/halls/[slug]/page.tsx",
      "kabbalah/angel/[slug]/page.tsx",
      "kabbalah/path/[id]/page.tsx",
      "kabbalah/sephirah/[id]/page.tsx",
    ]);
    for (const page of dynamic)
      expect(readFileSync(join(APP, page), "utf8"), page).toMatch(
        /export const dynamicParams = false;/,
      );
  });
});
