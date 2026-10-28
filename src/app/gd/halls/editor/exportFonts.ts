import {
  GD_HALL_FONT_FILES,
  gdHallFontFaceRule,
} from "@magick-components/gd/hall";
import { SVG_NAMESPACE } from "@/export/svgExport";
import { GD_HALL_FONT_BASE } from "../fontBase";

export { GD_HALL_FONT_BASE };

let embedded: Promise<string> | undefined;

function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Chunked: spreading a whole font into one call can overflow the stack.
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function inline(file: (typeof GD_HALL_FONT_FILES)[number]) {
  const response = await fetch(`${GD_HALL_FONT_BASE}/${file.file}`);
  if (!response.ok) throw new Error(`Font ${file.file}: ${response.status}`);
  const data = base64(await response.arrayBuffer());
  return gdHallFontFaceRule(file, `data:font/woff2;base64,${data}`);
}

/**
 * The hall's `@font-face` rules with each WOFF2 subset inlined as a data
 * URI (about 23 KB of base64 in all). Fetched once per page load; a failed
 * fetch is forgotten, so the next export tries again.
 */
export function gdHallEmbeddedFontCss(): Promise<string> {
  if (!embedded) {
    embedded = Promise.all(GD_HALL_FONT_FILES.map(inline)).then((rules) =>
      rules.join("\n"),
    );
    embedded.catch(() => {
      embedded = undefined;
    });
  }
  return embedded;
}

/**
 * `ExportControls`' `prepare` for a hall (plan 061, decision 8): fonts
 * loaded by URL do not survive rasterisation, so a PNG export gets the
 * hall's subsets inline. Only the hall's own OFL subsets are embedded, and
 * only on the PNG path; the Enochian font of a tablet is not (it falls
 * back to the browser's serif in a PNG).
 */
export async function embedGdHallFonts(clone: SVGSVGElement): Promise<void> {
  const style = clone.ownerDocument.createElementNS(SVG_NAMESPACE, "style");
  style.textContent = await gdHallEmbeddedFontCss();
  clone.insertBefore(style, clone.firstChild);
}

/** Forgets the cached rules; for tests. */
export function resetGdHallEmbeddedFonts(): void {
  embedded = undefined;
}
