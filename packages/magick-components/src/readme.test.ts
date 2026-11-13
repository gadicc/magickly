import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The README's table of entry points, held to the package's exports (plan
 * 080, decision 7), as magick-data's README is held to its tables.
 */
const README = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const tableRows = (heading: string) => {
  const section = README.split(`\n## ${heading}\n`)[1]?.split("\n## ")[0];
  return [...(section ?? "").matchAll(/^\| `([^`]+)` \|/gm)].map(
    (match) => match[1],
  );
};

describe("the README", () => {
  it("lists every entry point once, and nothing else", () => {
    const rows = tableRows("The entry points");
    const subpaths = Object.keys(manifest.exports).map((key) => key.slice(2));
    expect(rows.length).toBe(new Set(rows).size);
    expect([...rows].sort()).toEqual([...subpaths].sort());
  });

  it("publishes the same entry points it develops with", () => {
    expect(Object.keys(manifest.publishConfig.exports).sort()).toEqual(
      Object.keys(manifest.exports).sort(),
    );
  });

  it("marks the client components it names as such", () => {
    const marked = [
      ...README.matchAll(/^\| `([^`]+)` \|[^\n]*\(`"use client"`\) \|$/gm),
    ].map((match) => match[1]);
    expect(marked.sort()).toEqual([
      "astrology/Mercury",
      "astrology/Moon",
      "gd/RoseSigil",
    ]);
  });

  it("links only to files the package has", () => {
    const local = [...README.matchAll(/\]\(\.\/([^)#]+)\)/g)].map(
      (match) => match[1],
    );
    expect(local.length).toBeGreaterThan(0);
    for (const file of local)
      expect(existsSync(new URL(`../${file}`, import.meta.url)), file).toBe(
        true,
      );
  });
});
