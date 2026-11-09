import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_PAGES } from "@/seo/pages";
import pathnames, { type Pathnames } from "./pathnames";

/**
 * Every path the titles name is a page.
 *
 * The drawer links each entry and the bar takes an entry's title for the
 * heading of the page at that path, so an entry with no page is a link to a
 * 404 and a heading for a page that is not there. `/kabbalah/angel` was one:
 * the seventy-two have pages below it and nothing at it (plan 036).
 */
const appDir = import.meta.dirname;

/** Every path an entry names, a section by its own path. */
function paths(section: Pathnames, prefix = ""): string[] {
  return Object.entries(section).flatMap(([key, value]) => {
    if (key === "/") return [prefix || "/"];
    const at = `${prefix}/${key}`;
    return typeof value === "string" ? [at] : paths(value, at);
  });
}

/** The title an entry gives the page at a path. */
function titleAt(at: string): string {
  let value: Pathnames | string = pathnames;
  for (const key of at.split("/").filter(Boolean))
    value = (value as Pathnames)[key];
  return typeof value === "string" ? value : value["/"];
}

describe("pathnames", () => {
  it("names only paths that have a page", () => {
    expect(
      paths(pathnames).filter(
        (at) => !existsSync(path.join(appDir, at, "page.tsx")),
      ),
    ).toEqual([]);
  });
  it("heads each public page with words from its search title", () => {
    // The bar's heading and the title in search results name the same
    // page, so a heading says nothing its title does not (plan 071).
    const words = (text: string) =>
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .map((word) => word.replace(/s$/, ""));
    // App screens, headed by what they do rather than by what they are.
    const screens = new Set(["/chat", "/study"]);
    for (const at of paths(pathnames)) {
      const page = PUBLIC_PAGES[at as keyof typeof PUBLIC_PAGES];
      if (!page || screens.has(at)) continue;
      const title = new Set(words(page.title));
      const heading = titleAt(at);
      expect(
        words(heading).filter((word) => !title.has(word)),
        `${at}: "${heading}" in "${page.title}"`,
      ).toEqual([]);
    }
  });
});
