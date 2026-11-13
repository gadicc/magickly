import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GD_HALL_FONT_FILES, gdHallFontFaceCss } from "./gd/hall/fonts.ts";

/**
 * The hall fonts the package ships in fonts/ (plan 080, decision 7): the
 * same bytes as the app serves from public/fonts, since fontMetrics.json
 * measures exactly these files; their notices and sources; and gd-hall.css,
 * written from GD_HALL_FONT_FILES by scripts/gdHallCss.mjs.
 */
const fonts = new URL("../fonts/", import.meta.url);
const publicFonts = new URL("../../../public/fonts/", import.meta.url);
const read = (base: URL, name: string) => readFileSync(new URL(name, base));
const NOTICES = ["NotoSerif-OFL.txt", "FrankRuhlLibre-OFL.txt"];

describe("the package's hall fonts", () => {
  it("holds the subsets, their notices and sources, and the stylesheet", () => {
    expect(readdirSync(fonts).sort()).toEqual(
      [
        ...GD_HALL_FONT_FILES.map((font) => font.file),
        ...NOTICES,
        "SOURCES.md",
        "gd-hall.css",
      ].sort(),
    );
  });

  it("ships the app's files byte for byte", () => {
    for (const name of [...GD_HALL_FONT_FILES.map((f) => f.file), ...NOTICES])
      expect(read(fonts, name).equals(read(publicFonts, name)), name).toBe(
        true,
      );
  });

  it("lists each subset's size and hash in SOURCES.md", () => {
    const sources = read(fonts, "SOURCES.md").toString("utf8");
    for (const { file } of GD_HALL_FONT_FILES) {
      const bytes = read(fonts, file);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      expect(sources, file).toContain(`| ${bytes.length} | ${sha256} |`);
    }
  });

  it("declares them in gd-hall.css, as scripts/gdHallCss.mjs writes it", () => {
    expect(read(fonts, "gd-hall.css").toString("utf8")).toBe(
      `${gdHallFontFaceCss(".")}\n`,
    );
  });
});
