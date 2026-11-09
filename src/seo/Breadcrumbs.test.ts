import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { breadcrumbList, entityTrail, pageTrail } from "./Breadcrumbs";
import { PUBLIC_PAGES } from "./pages";

describe("breadcrumbs", () => {
  it("trails a page below a section from the site down", () => {
    expect(pageTrail("/kabbalah/yhvh/72angels")).toEqual([
      { title: "Magick.ly", url: "/" },
      { title: "Kabbalah", url: "/kabbalah" },
      { title: "Shem HaMephorash", url: "/kabbalah/yhvh" },
      { title: "72 Angels", url: "/kabbalah/yhvh/72angels" },
    ]);
  });

  it("gives top-level pages no trail", () => {
    for (const path of ["/", "/about", "/study", "/chat", "/kabbalah"])
      expect(pageTrail(path), path).toBeNull();
    for (const path of ["/doc/neophyte", "/help/temples"])
      expect(pageTrail(path), path).toBeNull();
  });

  it("puts an entity under its list page", () => {
    expect(
      entityTrail(
        "/kabbalah/yhvh/72angels",
        "Sealiah",
        "/kabbalah/angel/sealiah",
      ).map((crumb) => crumb.url),
    ).toEqual([
      "/",
      "/kabbalah",
      "/kabbalah/yhvh",
      "/kabbalah/yhvh/72angels",
      "/kabbalah/angel/sealiah",
    ]);
  });

  it("names and links every item, as Google requires", () => {
    const trail = pageTrail("/gd/symbols/shewbread");
    expect(trail).not.toBeNull();
    const list = breadcrumbList(trail ?? []);
    expect(list["@type"]).toBe("BreadcrumbList");
    list.itemListElement.forEach((item, index) => {
      expect(item.position).toBe(index + 1);
      expect(item.name).toBeTruthy();
      expect(item.item).toMatch(/^https:\/\/magick\.ly(\/|$)/);
    });
  });

  it("trails every public sitemap page below a section, to its canonical", () => {
    const urls = new Set(sitemap().map(({ url }) => url));
    for (const path of Object.keys(PUBLIC_PAGES)) {
      const trail = pageTrail(path);
      if (!trail) continue;
      for (const { item } of breadcrumbList(trail).itemListElement)
        expect(urls, `${path}: ${item}`).toContain(item);
    }
  });
});
