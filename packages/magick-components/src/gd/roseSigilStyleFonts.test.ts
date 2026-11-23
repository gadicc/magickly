import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fontMetrics from "./hall/fontMetrics.json" with { type: "json" };
import { SIGIL_STYLE_FONTS } from "./roseSigilStyles.tsx";

/**
 * The faces the sigil styles' markup asks for are the ones they were
 * measured in (plan 096, decision 13). resvg matches `font-family` against
 * a font's own family name and then the weight and style, so the markup's
 * family, weight and style must be the subset's name ID 1, its OS/2 weight
 * and its italic bit. Y1 found the trap: a weight-500 cut is named "… Medium",
 * and markup asking for weight 500 of "Frank Ruhl Libre" silently fell back
 * to another font. The app renders with the TrueType subsets in
 * assets/fonts, which scripts/gd-hall-fonts/build.py writes with
 * fontMetrics.json; which face resvg then picks is the image contract's to
 * pin (plan 096, Y3).
 */

const assets = new URL("../../../../assets/fonts/", import.meta.url);

/** What a TrueType file says of itself, read from its tables. */
function face(file: string) {
  const bytes = readFileSync(new URL(file, assets));
  const tables = new Map<string, number>();
  for (let i = 0; i < bytes.readUInt16BE(4); i++) {
    const at = 12 + 16 * i;
    tables.set(
      bytes.toString("latin1", at, at + 4),
      bytes.readUInt32BE(at + 8),
    );
  }
  const name = tables.get("name") as number;
  const count = bytes.readUInt16BE(name + 2);
  const strings = name + bytes.readUInt16BE(name + 4);
  const names = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const at = name + 6 + 12 * i;
    // Windows, Unicode BMP, US English: UTF-16BE.
    if (
      bytes.readUInt16BE(at) !== 3 ||
      bytes.readUInt16BE(at + 2) !== 1 ||
      bytes.readUInt16BE(at + 4) !== 0x409
    )
      continue;
    const length = bytes.readUInt16BE(at + 8);
    const offset = strings + bytes.readUInt16BE(at + 10);
    const utf16 = Buffer.from(bytes.subarray(offset, offset + length));
    names.set(bytes.readUInt16BE(at + 6), utf16.swap16().toString("utf16le"));
  }
  const os2 = tables.get("OS/2") as number;
  const head = tables.get("head") as number;
  return {
    family: names.get(16) ?? names.get(1),
    subfamily: names.get(17) ?? names.get(2),
    weight: bytes.readUInt16BE(os2 + 4),
    italic: (bytes.readUInt16BE(os2 + 62) & 1) === 1,
    capHeight: bytes.readInt16BE(os2 + 88),
    upem: bytes.readUInt16BE(head + 18),
  };
}

describe("the sigil styles' faces", () => {
  it("asks for upright Noto Serif Regular, as the subset names itself", () => {
    const roman = face("NotoSerif-Regular-latin1.ttf");
    expect(roman).toMatchObject({
      family: SIGIL_STYLE_FONTS.roman.family,
      subfamily: "Regular",
      weight: SIGIL_STYLE_FONTS.roman.weight,
      // SIGIL_STYLE_FONTS.roman.style is "normal".
      italic: false,
    });
    expect(roman.upem).toBe(fontMetrics.roman.upem);
    expect(roman.capHeight).toBe(fontMetrics.roman.capHeight);
  });

  it("asks for the halls' Frank Ruhl Libre Bold, as the subset names itself", () => {
    const hebrew = face("FrankRuhlLibre-Bold-letters.ttf");
    expect(hebrew).toMatchObject({
      family: SIGIL_STYLE_FONTS.hebrew.family,
      subfamily: "Bold",
      weight: SIGIL_STYLE_FONTS.hebrew.weight,
      italic: false,
    });
    expect(hebrew.upem).toBe(fontMetrics.hebrew.upem);
    expect(hebrew.capHeight).toBe(fontMetrics.hebrew.capHeight);
  });
});
