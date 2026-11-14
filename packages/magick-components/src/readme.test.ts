import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  signOffRows,
  unsignedRows,
} from "../../../scripts/provenance-sign-off.mjs";

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

  it("builds every entry it publishes, and names no other", () => {
    const file = new URL("../tsconfig.build.json", import.meta.url).pathname;
    const { config } = ts.readConfigFile(file, ts.sys.readFile);
    const sources = Object.values(manifest.exports as Record<string, string>)
      .filter((target) => target.startsWith("./src/"))
      .map((target) => target.slice(2));
    // The modules the entries import are built as tsc follows them; the
    // list names only the entries, and the types tsc needs to check them.
    const named = (config.files as string[]).filter(
      (source) => source !== "src/vendor.d.ts",
    );
    expect([...named].sort()).toEqual([...sources].sort());
  });

  it("marks the client components it names as such", () => {
    const marked = [
      ...README.matchAll(/^\| `([^`]+)` \|[^\n]*\(`"use client"`\) \|$/gm),
    ].map((match) => match[1]);
    expect(marked.sort()).toEqual([
      "astrology/MercuryWidget",
      "astrology/MoonWidget",
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

/**
 * The provenance sign-off (plan 080, stage G), as magick-data's: each row
 * of the README's Provenance table carries the date the owner signed it
 * off, and no version past 0.0.0 ships while one is empty. The smoke test
 * checks the same of the packed README.
 */
describe("the provenance sign-off", () => {
  const PROVENANCE = { section: "Provenance", firstColumn: "Drawing" };
  const rows = signOffRows(README, PROVENANCE);
  it("is complete before the version leaves 0.0.0", () => {
    const open = unsignedRows(rows).map((row) => row.item);
    expect(manifest.version === "0.0.0" ? [] : open).toEqual([]);
  });

  // Each row's first cell names the entries that draw it, as `subpath`.
  it("covers every entry, and names nothing else", () => {
    const subpaths = rows.flatMap((row) =>
      [...row.item.matchAll(/\(([^)]+)\)$/g)].flatMap((match) =>
        match[1].split(", "),
      ),
    );
    // The tablet's letters, sigils and Yods are rows of their own.
    expect([...new Set(subpaths)].sort()).toEqual(
      Object.keys(manifest.exports)
        .map((key) => key.slice(2))
        .sort(),
    );
  });

  it("says where each drawing comes from", () => {
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) expect(row.source, row.item).not.toBe("");
  });

  it("reads a sign-off as a date or nothing, and nothing else", () => {
    const table = (...lines: string[]) =>
      [
        "## Provenance",
        "",
        "| Drawing | Source | Signed off |",
        "| --- | --- | --- |",
        ...lines,
        "",
      ].join("\n");
    expect(
      signOffRows(
        table("| `a` | Ours | 2026-11-20 |", "| `b` | Not known |  |"),
        PROVENANCE,
      ).map((row) => [row.item, row.signedOff]),
    ).toEqual([
      ["a", "2026-11-20"],
      ["b", ""],
    ]);
    for (const signedOff of ["yes", "20 November 2026", "2026-02-30"])
      expect(() =>
        signOffRows(table(`| \`a\` | Ours | ${signedOff} |`), PROVENANCE),
      ).toThrow(/must be a date/);
    expect(() =>
      signOffRows(
        "## Provenance\n\n| Drawing | Source |\n| --- | --- |\n",
        PROVENANCE,
      ),
    ).toThrow(/unexpected Provenance header/);
  });
});
