import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import godForms from "magick-data/gd/godForms";
import { describe, expect, it } from "vitest";

/**
 * The Coptic names of the gods are drawn in Noto Sans Coptic, subset by
 * `scripts/coptic-font/build.py` to their letters and sou (plan 095). The
 * stylesheet's `unicode-range` decides which letters the browser asks the
 * font for, so it must cover every letter of every name; and the file in
 * `public/fonts` must be the one its sources page records.
 */

const FONTS = path.join(process.cwd(), "public/fonts");
const read = (file: string) => readFileSync(path.join(FONTS, file));

/** The code points a `unicode-range` covers. */
function covered(css: string): Set<number> {
  const range = /unicode-range:([^;]*);/.exec(css)?.[1] ?? "";
  const points = new Set<number>();
  for (const part of range.split(",")) {
    const [from, to = from] = part.trim().replace(/^U\+/, "").split("-");
    for (
      let code = Number.parseInt(from, 16);
      code <= Number.parseInt(to, 16);
      code++
    )
      points.add(code);
  }
  return points;
}

describe("the gods' Coptic font", () => {
  const css = read("NotoSansCoptic.css").toString();
  const letters = new Set(
    Object.values(godForms).flatMap((god) =>
      [...god.coptic].map((letter) => letter.codePointAt(0) as number),
    ),
  );

  it("covers every letter of the gods' names and sou, and no more", () => {
    expect(letters.size).toBeGreaterThan(20);
    const range = covered(css);
    expect([...range].sort((a, b) => a - b)).toEqual(
      [...letters, 0x2c8b].sort((a, b) => a - b),
    );
  });

  it("is the font its sources page records, with its licence", () => {
    const sources = read("coptic-font-sources.md").toString();
    for (const file of [
      "NotoSansCoptic-gods.woff2",
      "NotoSansCoptic-OFL.txt",
    ]) {
      const bytes = read(file);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      expect(sources, file).toContain(`| ${file} |`);
      expect(sources, file).toContain(`| ${bytes.length} | ${sha256} |`);
    }
    expect(css).toContain('src: url("NotoSansCoptic-gods.woff2")');
    expect(read("NotoSansCoptic-OFL.txt").toString()).toMatch(
      /^Copyright 2022 The Noto Project Authors/,
    );
  });
});
