import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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

describe("pathnames", () => {
  it("names only paths that have a page", () => {
    expect(
      paths(pathnames).filter(
        (at) => !existsSync(path.join(appDir, at, "page.tsx")),
      ),
    ).toEqual([]);
  });
});
