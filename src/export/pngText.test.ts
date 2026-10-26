import { crc32 as zlibCrc32 } from "node:zlib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { crc32, pngWithText, svgWithMarkup, XMP_KEYWORD } from "./pngText";

/** A PNG's chunks: type, data and whether the CRC holds. */
function chunks(png: Uint8Array) {
  const buffer = Buffer.from(png);
  const out: { type: string; data: Buffer; crcOk: boolean }[] = [];
  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    out.push({
      type: buffer.toString("latin1", offset + 4, offset + 8),
      data: buffer.subarray(offset + 8, offset + 8 + length),
      crcOk:
        zlibCrc32(buffer.subarray(offset + 4, offset + 8 + length)) ===
        buffer.readUInt32BE(offset + 8 + length),
    });
    offset += 12 + length;
  }
  return out;
}

describe("PNG text chunks", () => {
  it("computes PNG's CRC-32, as zlib does", () => {
    for (const text of ["", "IEND", "iTXtXML:com.adobe.xmp", "✡ שלום"]) {
      const bytes = new TextEncoder().encode(text);
      expect(crc32(bytes)).toBe(zlibCrc32(bytes));
    }
  });

  it("inserts an uncompressed iTXt chunk after IHDR, the image untouched", async () => {
    const png = await sharp({
      create: { width: 3, height: 2, channels: 3, background: "#f80" },
    })
      .png()
      .toBuffer();
    const text = "<x:xmpmeta>Hall art: Magick.ly ✡</x:xmpmeta>";
    const tagged = pngWithText(png, XMP_KEYWORD, text);
    const parts = chunks(tagged);
    const types = parts.map((part) => part.type);
    expect(types.slice(0, 2)).toEqual(["IHDR", "iTXt"]);
    expect(types.indexOf("iTXt")).toBeLessThan(types.indexOf("IDAT"));
    for (const part of parts) expect(part.crcOk).toBe(true);
    const itxt = parts.find((part) => part.type === "iTXt")?.data;
    expect(itxt?.subarray(0, XMP_KEYWORD.length + 5).toString("latin1")).toBe(
      `${XMP_KEYWORD}\0\0\0\0\0`,
    );
    expect(itxt?.subarray(XMP_KEYWORD.length + 5).toString("utf8")).toBe(text);
    expect(await sharp(tagged).raw().toBuffer()).toEqual(
      await sharp(png).raw().toBuffer(),
    );
    expect(() => pngWithText(png.subarray(1), XMP_KEYWORD, text)).toThrow(
      "Unexpected PNG start",
    );
    expect(() => pngWithText(new Uint8Array(4), XMP_KEYWORD, text)).toThrow(
      "Unexpected PNG start",
    );
  });

  it("puts markup after an SVG root's leading title", () => {
    expect(
      svgWithMarkup(
        '<svg viewBox="0 0 1 1"><title>Hall</title><path/></svg>',
        "<metadata/>",
      ),
    ).toBe(
      '<svg viewBox="0 0 1 1"><title>Hall</title><metadata/><path/></svg>',
    );
  });

  it("puts markup first inside an SVG's root", () => {
    expect(
      svgWithMarkup(
        '<?xml version="1.0"?>\n<svg viewBox="0 0 1 1"><path/></svg>',
        "<metadata/>",
      ),
    ).toBe(
      '<?xml version="1.0"?>\n<svg viewBox="0 0 1 1"><metadata/><path/></svg>',
    );
    expect(() => svgWithMarkup("<p/>", "<metadata/>")).toThrow(
      "Unexpected SVG root",
    );
    expect(() => svgWithMarkup("<svg/>", "<metadata/>")).toThrow(
      "Unexpected SVG root",
    );
  });
});
