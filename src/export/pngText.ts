/**
 * Text chunks for PNG files, without dependencies, for the server's
 * images and the browser's exports alike (plan 062): an uncompressed
 * `iTXt` chunk, the form the XMP specification gives an XMP packet in a
 * PNG.
 */

/** The keyword the XMP specification gives an XMP packet in a PNG. */
export const XMP_KEYWORD = "XML:com.adobe.xmp";

let table: Uint32Array | undefined;

/** CRC-32 as PNG computes it (ISO 3309, the zlib polynomial). */
export function crc32(bytes: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * The PNG with an uncompressed `iTXt` chunk (`keyword`, no language, no
 * translation) inserted right after `IHDR`, ahead of the image data, where
 * readers that stop at the data still find it; nothing else moves. Throws
 * for bytes that do not start with the signature and `IHDR`.
 */
export function pngWithText(
  png: Uint8Array,
  keyword: string,
  text: string,
): Uint8Array {
  // The signature, then IHDR: a 13-byte chunk, 25 bytes with its frame.
  const at = 8 + 12 + 13;
  const header = String.fromCharCode(...png.subarray(12, 16));
  const length =
    png.length >= at
      ? new DataView(png.buffer, png.byteOffset + 8, 4).getUint32(0)
      : -1;
  if (header !== "IHDR" || length !== 13)
    throw new Error("Unexpected PNG start");
  const encoder = new TextEncoder();
  const head = encoder.encode(keyword);
  const body = encoder.encode(text);
  // Null separator, uncompressed, method 0, empty language and translation.
  const data = new Uint8Array(head.length + 5 + body.length);
  data.set(head);
  data.set(body, head.length + 5);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(encoder.encode("iTXt"), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, at));
  out.set(chunk, at);
  out.set(png.subarray(at), at + chunk.length);
  return out;
}

/**
 * The SVG text with `markup` inserted first inside its root element, after
 * the root's own `<title>` when that comes first, so the title stays the
 * first child, where it names the image.
 */
export function svgWithMarkup(svg: string, markup: string): string {
  const root = /<svg\b[^>]*>/.exec(svg);
  if (!root || root[0].endsWith("/>")) throw new Error("Unexpected SVG root");
  let at = root.index + root[0].length;
  const title = /^<title\b[^>]*>[\s\S]*?<\/title>/.exec(svg.slice(at));
  if (title) at += title[0].length;
  return svg.slice(0, at) + markup + svg.slice(at);
}
