import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { SITE_TITLE, siteNav } from "./siteNav";

const at = (pathname: string, segment: string | null = null) =>
  siteNav(pathname, segment);
const urls = (links: { url: string }[]) => links.map((link) => link.url);

describe("siteNav", () => {
  it("places a page under its sections, beside its siblings", () => {
    const nav = at("/kabbalah/tree");
    expect(nav).toMatchObject({
      title: "Tree of Life",
      known: true,
      topSection: "kabbalah",
    });
    expect(nav.ancestors).toEqual([{ title: "Kabbalah", url: "/kabbalah" }]);
    expect(urls(nav.sectionPages)).toEqual(["/kabbalah/yhvh"]);
  });

  it("lists a section page's own pages", () => {
    const nav = at("/kabbalah");
    expect(nav.ancestors).toEqual([]);
    expect(urls(nav.sectionPages)).toEqual([
      "/kabbalah/yhvh",
      "/kabbalah/tree",
    ]);
  });

  it("walks nested sections", () => {
    const nav = at("/kabbalah/yhvh/72angels");
    expect(urls(nav.ancestors)).toEqual(["/kabbalah", "/kabbalah/yhvh"]);
    expect(nav.sectionPages).toEqual([]);
  });

  it("leaves a page below a section untitled, in that section", () => {
    const nav = at("/kabbalah/angel/vehuiah");
    expect(nav).toMatchObject({ title: SITE_TITLE, known: false });
    expect(urls(nav.ancestors)).toEqual(["/kabbalah"]);
    expect(urls(nav.sectionPages)).toEqual([
      "/kabbalah/yhvh",
      "/kabbalah/tree",
    ]);
  });

  it("gives top-level pages, unknown paths and the 404 nothing around them", () => {
    for (const nav of [
      at("/about"),
      at("/constructor"),
      at("/about/more"),
      at("/gd/nope", "_not-found"),
      at("/_not-found", "/_not-found"),
    ]) {
      expect(nav.ancestors).toEqual([]);
      expect(nav.sectionPages).toEqual([]);
    }
    expect(at("/gd/nope", "_not-found").topSection).toBe("");
    expect(at("/about").known).toBe(true);
    expect(at("/constructor").known).toBe(false);
  });

  it("names a page below a titled entry after that entry", () => {
    expect(at("/books/la-science-cabalistique/chapitre-1")).toMatchObject({
      title: "La Science Cabalistique",
      known: true,
      titleUrl: "/books/la-science-cabalistique",
      sectionPages: [],
    });
    expect(
      urls(at("/books/la-science-cabalistique/chapitre-1").ancestors),
    ).toEqual(["/books"]);
    expect(at("/study/some-set")).toMatchObject({
      title: "Study",
      known: true,
    });
  });

  it("marks whether a menu's pages are the page's own", () => {
    expect(at("/kabbalah").childPages).toBe(true);
    expect(at("/kabbalah/tree").childPages).toBe(false);
    expect(at("/kabbalah/angel/vehuiah").childPages).toBe(true);
  });

  it("leaves members' pages out", () => {
    expect(urls(at("/gd/rituals").sectionPages)).toEqual([]);
    expect(urls(at("/temples").sectionPages)).toEqual([]);
    expect(urls(at("/gd").sectionPages)).not.toContain("/gd/rituals/deleted");
  });

  it("names the open-source section, and Data and Components under it", () => {
    expect(at("/open-source")).toMatchObject({
      title: "Open source",
      known: true,
      ancestors: [],
      sectionPages: [
        { title: "Data", url: "/open-source/data" },
        { title: "Components", url: "/open-source/components" },
      ],
      topSection: "open-source",
    });
    expect(at("/open-source/data")).toMatchObject({
      title: "Data",
      known: true,
      ancestors: [{ title: "Open source", url: "/open-source" }],
    });
  });

  it("lets a data table's page name itself, under Open source › Data", () => {
    expect(at("/open-source/data/sephirah")).toMatchObject({
      known: false,
      ancestors: [
        { title: "Open source", url: "/open-source" },
        { title: "Data", url: "/open-source/data" },
      ],
      topSection: "open-source",
    });
  });

  it("lets a component's page name itself, under Open source › Components", () => {
    expect(at("/open-source/components/tree-of-life")).toMatchObject({
      known: false,
      ancestors: [
        { title: "Open source", url: "/open-source" },
        { title: "Components", url: "/open-source/components" },
      ],
      topSection: "open-source",
    });
    expect(at("/open-source/components")).toMatchObject({
      title: "Components",
      known: true,
      ancestors: [{ title: "Open source", url: "/open-source" }],
    });
  });

  it("titles the home page and the ritual editor", () => {
    expect(at("/")).toMatchObject({ title: SITE_TITLE, known: true });
    expect(at("/doc/abc/edit/semantic")).toMatchObject({
      title: "Ritual editor",
      known: true,
      ancestors: [],
    });
  });

  it("never lists a page among its own section's pages", () => {
    for (const { url } of sitemap()) {
      const { pathname } = new URL(url);
      const nav = at(pathname);
      expect(urls(nav.sectionPages), pathname).not.toContain(pathname);
      for (const link of [...nav.ancestors, ...nav.sectionPages])
        expect(link.title, link.url).toBeTruthy();
    }
  });
});
