import { describe, expect, it } from "vitest";
import { componentMetadata, componentPage, componentPages } from "./components";
import { SITE_NAME } from "./site";

describe("component pages", () => {
  const pages = componentPages();

  it("has one per component, at its own path", () => {
    expect(pages).toHaveLength(14);
    expect(pages[0]).toMatchObject({
      path: "/open-source/components/tree-of-life",
      title: "Tree of Life React Component",
    });
    expect(new Set(pages.map((page) => page.path)).size).toBe(pages.length);
    for (const page of pages)
      expect(page.path).toMatch(/^\/open-source\/components\/[a-z-]+$/);
  });

  it("keeps titles and snippets within search result lengths", () => {
    for (const page of pages) {
      expect(
        `${page.title} | ${SITE_NAME}`.length,
        page.path,
      ).toBeLessThanOrEqual(60);
      // Bing reports a description under 110 characters as too short.
      expect(page.description.length, page.path).toBeGreaterThanOrEqual(110);
      expect(page.description.length, page.path).toBeLessThanOrEqual(160);
    }
    expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length);
    expect(new Set(pages.map((page) => page.description)).size).toBe(
      pages.length,
    );
  });

  it("knows no other slug", () => {
    expect(componentPage("TreeOfLife")).toBeNull();
    expect(componentPage("constructor")).toBeNull();
    expect(componentMetadata("nope")).toBeNull();
  });

  it("gives each page its canonical and card", () => {
    expect(componentMetadata("rose-sigil")).toMatchObject({
      title: "Rose Cross Sigil React Component",
      alternates: { canonical: "/open-source/components/rose-sigil" },
    });
  });
});
