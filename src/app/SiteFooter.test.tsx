import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_PAGES } from "@/seo/pages";
import { ENTITY_ROUTES, PRIVATE_ROUTES } from "@/seo/routeClasses";
import SiteFooter from "./SiteFooter";
import { footerSections, showsFooter } from "./siteNav";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  segment: null as string | null,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSelectedLayoutSegment: () => navigation.segment,
}));

afterEach(() => {
  navigation.pathname = "/";
  navigation.segment = null;
});

function render(pathname: string, segment: string | null = null) {
  navigation.pathname = pathname;
  navigation.segment = segment;
  return renderToString(<SiteFooter />);
}

const hrefs = (html: string) =>
  [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map(([, href]) => href);

/** A concrete path for a route pattern such as `/doc/[_id]`. */
const sample = (route: string) => route.replace(/\[[^\]]+\]/g, "x");

/** Full-screen screens: public, but the footer would sit under them. */
const FULL_SCREEN = [
  "/doc/[_id]",
  "/doc/neophyte",
  "/doc/theoricus",
  "/doc/zelator",
  "/gd/halls/editor",
  "/chat",
];

describe("SiteFooter", () => {
  it("shows on the pages search is for, and only there", () => {
    for (const route of [...Object.keys(PUBLIC_PAGES), ...ENTITY_ROUTES])
      expect(showsFooter(sample(route)), route).toBe(
        !FULL_SCREEN.includes(route),
      );
    for (const route of PRIVATE_ROUTES)
      expect(showsFooter(sample(route)), route).toBe(
        // A public reading copy, kept out of search as a duplicate only.
        route === "/books/la-science-cabalistique/texte-integral",
      );
  });

  it("links every section and its public pages, and marks where you are", () => {
    const html = render("/kabbalah/tree");
    const links = hrefs(html);
    for (const section of footerSections()) {
      expect(links).toContain(section.url);
      for (const page of section.pages) expect(links).toContain(page.url);
    }
    expect(html).toMatch(/aria-current="page"[^>]*>Tree of Life</);
    expect(html).toMatch(/aria-current="true"[^>]*>Kabbalah</);
    // Members' pages are linked from their own sections, not from here.
    expect(links).not.toContain("/gd/rituals/deleted");
    expect(links).not.toContain("/temples/admin");
  });

  it("links only public pages within the site", () => {
    const internal = hrefs(render("/")).filter((href) => href.startsWith("/"));
    for (const href of internal)
      expect(PUBLIC_PAGES, href).toHaveProperty([href]);
  });

  it("renders nothing on full-screen and members' pages", () => {
    for (const path of [
      "/doc/abc",
      "/doc/abc/edit/semantic",
      "/gd/halls/editor",
      "/temples",
      "/chat",
      "/chat/train",
      "/study/some-set",
      "/offline/ritual",
    ])
      expect(render(path), path).toBe("");
  });

  it("is one labelled navigation landmark, hidden in print", () => {
    const html = render("/kabbalah/tree");
    expect(html.match(/<nav\b/g)).toHaveLength(1);
    expect(html).toMatch(/<nav[^>]*aria-label="Site"/);
    expect(html).toContain("@media print");
  });

  it("marks the entry a deep page sits under", () => {
    // The footer lists a section's own pages, not theirs.
    const html = render("/gd/symbols/candlestick");
    expect(html).not.toContain('aria-current="page"');
    expect(html).toMatch(/aria-current="true"[^>]*>Symbols</);
    expect(html).toMatch(/aria-current="true"[^>]*>Golden Dawn</);
  });

  it("gives open source a column, with Data and the repository in it", () => {
    const section = footerSections().find(({ url }) => url === "/open-source");
    expect(section).toMatchObject({
      title: "Open source",
      pages: [
        { title: "Data", url: "/open-source/data" },
        { title: "Source code", url: "https://github.com/gadicc/magickly" },
      ],
    });
    const html = render("/open-source");
    expect(html).toMatch(/aria-current="page"[^>]*>Open source</);
    // Once, in that column, not again under Magick.ly.
    expect(
      hrefs(html).filter(
        (href) => href === "https://github.com/gadicc/magickly",
      ),
    ).toHaveLength(1);
  });

  it("links other sites plainly", () => {
    const html = render("/");
    expect(html).toMatch(/<a href="https:\/\/forums\.magick\.ly"[^>]*>Forum</);
    expect(html).not.toMatch(/<a href="https:[^"]*"[^>]*aria-current/);
  });

  it("decides the static 404 the same on the server and in the browser", () => {
    // Prerendered at /_not-found, served at any unknown path.
    const server = render("/_not-found", "/_not-found");
    expect(render("/doc/nope", "_not-found")).toBe(server);
    expect(server).not.toBe("");
    expect(server).not.toContain("aria-current");
  });
});
