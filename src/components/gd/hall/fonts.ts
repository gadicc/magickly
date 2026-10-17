/**
 * The hall's fonts (plan 061, decision 7). The WOFF2 subsets live in the
 * app's `public/fonts` and `scripts/gd-hall-fonts/build.py` makes them; this
 * package never hard-codes where they are served, so the caller passes the
 * base URL. The family names are the package's own, so a locally installed
 * Noto Serif with other metrics never stands in for the subset the labels
 * were measured with; the stacks fall back to it only when the subset fails.
 */

/** The `@font-face` family names the hall draws with. */
export const GD_HALL_FONT_FAMILIES = {
  serif: "GdHall Noto Serif",
  hebrew: "GdHall Noto Serif Hebrew",
} as const;

/** CSS `font-family` values, each falling back to the installed font. */
export const GD_HALL_FONT_STACKS = {
  serif: `"${GD_HALL_FONT_FAMILIES.serif}", "Noto Serif", serif`,
  hebrew: `"${GD_HALL_FONT_FAMILIES.hebrew}", "Noto Serif Hebrew", serif`,
} as const;

/** One subset file and the faces it provides. */
export interface GdHallFontFile {
  family: string;
  style: "normal" | "italic";
  weight: 400 | 700;
  /** The file name under the caller's base URL. */
  file: string;
  unicodeRange: string;
}

/** The subsets, as `scripts/gd-hall-fonts/build.py` names them. */
export const GD_HALL_FONT_FILES: readonly GdHallFontFile[] = [
  {
    family: GD_HALL_FONT_FAMILIES.serif,
    style: "italic",
    weight: 400,
    file: "NotoSerif-Italic-latin1.woff2",
    unicodeRange:
      "U+20-7E, U+A0-FF, U+2013-2014, U+2018-2019, U+201C-201D, U+2026",
  },
  {
    // Only the letters of East, West, North and South.
    family: GD_HALL_FONT_FAMILIES.serif,
    style: "italic",
    weight: 700,
    file: "NotoSerif-BoldItalic-compass.woff2",
    unicodeRange:
      "U+20, U+45, U+4E, U+53, U+57, U+61, U+65, U+68, U+6F, U+72-75",
  },
  {
    family: GD_HALL_FONT_FAMILIES.hebrew,
    style: "normal",
    weight: 700,
    file: "NotoSerifHebrew-Bold-letters.woff2",
    unicodeRange: "U+5D0-5EA",
  },
];

/**
 * What a font source may not contain: the rules go into a `<style>`
 * inside the SVG, where neither HTML nor XML escapes them.
 */
const UNSAFE_FONT_SRC = /["'()\\<>&\s]/;

/**
 * One subset's `@font-face` rule with `src` as its WOFF2 source: a URL, or
 * a `data:` URI when an export inlines the font (`data:font/woff2;base64,…`
 * is safe). Throws for a `src` with a quote, bracket, backslash, space or
 * markup character.
 */
export function gdHallFontFaceRule(font: GdHallFontFile, src: string): string {
  if (UNSAFE_FONT_SRC.test(src))
    throw new Error(`Unsafe font source: ${JSON.stringify(src.slice(0, 80))}`);
  return `@font-face{font-family:"${font.family}";font-style:${font.style};font-weight:${font.weight};font-display:swap;src:url("${src}") format("woff2");unicode-range:${font.unicodeRange}}`;
}

/**
 * `@font-face` rules for the hall fonts served under `baseUrl` (such as
 * `/fonts`). The rules go into a `<style>` inside the SVG, where neither
 * HTML nor XML escapes them, so the URL may not contain quotes, brackets,
 * spaces, backslashes or markup characters.
 */
export function gdHallFontFaceCss(baseUrl: string): string {
  if (UNSAFE_FONT_SRC.test(baseUrl))
    throw new Error(`Unsafe font base URL: ${JSON.stringify(baseUrl)}`);
  const base = baseUrl.replace(/\/+$/, "");
  return GD_HALL_FONT_FILES.map((font) =>
    gdHallFontFaceRule(font, `${base}/${font.file}`),
  ).join("\n");
}
