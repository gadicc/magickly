import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Code from elsewhere carries its notice (plan 080, "Before publishing").
 * The Moon's paths adapt moon-phase's phase_junk(), which is BSD 3-Clause:
 * its notice must stay with the source and with what is built from it.
 */
const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const MOON_PHASE =
  "https://github.com/tingletech/moon-phase/blob/643015a83509ca6a662d1af6e1ac14661852cedb/moon-phase.js";
const BSD_FILES = ["src/astrology/moonPath.ts", "src/astrology/Moon.tsx"];

/** Every source file under src/, as package-relative paths. */
const sources = readdirSync(new URL("../src/", import.meta.url), {
  recursive: true,
})
  .map((file) => `src/${String(file)}`)
  .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."));

describe("moon-phase's BSD notice", () => {
  it("is in LICENSE.txt in full, and named in the package's licence", () => {
    const licence = read("LICENSE.txt");
    expect(licence).toContain(MOON_PHASE);
    expect(licence).toContain(
      "Copyright © 2012, Regents of the University of California",
    );
    for (const clause of [
      "Redistributions of source code must retain the above copyright notice,",
      "Redistributions in binary form must reproduce the above copyright notice,",
      "Neither the name of the University of California nor the names of its",
      "POSSIBILITY OF SUCH DAMAGE.",
    ])
      expect(licence).toContain(clause);
    for (const file of BSD_FILES) expect(licence).toContain(file);
    expect(JSON.parse(read("package.json")).license).toBe(
      "(MIT AND OFL-1.1 AND BSD-3-Clause)",
    );
  });

  it("heads each file that adapts it, in a comment the build keeps", () => {
    // tsc keeps comments; a bundler's minifier keeps /*! ones.
    for (const file of BSD_FILES) {
      const header = read(file).match(/\/\*![\s\S]*?\*\//)?.[0] ?? "";
      expect(header, file).toContain(MOON_PHASE);
      expect(header, file).toContain(
        "Copyright (c) 2012, Regents of the University of California.",
      );
    }
  });

  it("is named by those files alone", () => {
    const naming = sources.filter((file) =>
      read(file).includes("tingletech/moon-phase"),
    );
    expect(naming.sort()).toEqual([...BSD_FILES].sort());
  });
});

describe("the package's source", () => {
  it("holds code, the hall's metrics and test snapshots, nothing else", () => {
    // Two Inkscape trees of unrecorded provenance sat here unused until
    // plan 080's "Before publishing"; an asset needs its source recorded
    // before it joins the MIT package.
    const src = fileURLToPath(new URL("../src/", import.meta.url));
    const others = readdirSync(src, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(src, join(entry.parentPath, entry.name)))
      .filter(
        (file) =>
          !/\.tsx?$/.test(file) &&
          !file.includes("/__snapshots__/") &&
          file !== "gd/hall/fontMetrics.json",
      );
    expect(others).toEqual([]);
  });
});
