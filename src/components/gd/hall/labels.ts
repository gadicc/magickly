import fontMetrics from "./fontMetrics.json";

/**
 * Text measurement for hall labels (plan 061, decision 6). Widths come from
 * a generated table of the label font's advances and GPOS kern pairs
 * (`scripts/gd-hall-fonts/build.py`), never from the DOM, so the server, the
 * browser and an exported image break lines alike. The spike measured
 * advances plus kerning against Chromium to within 0.0092 %.
 */

/** One font's metrics as `fontMetrics.json` stores them, in font units. */
export interface FontMetricsTable {
  upem: number;
  capHeight: number;
  /** Top of the tallest unaccented letter or digit. */
  letterTop: number;
  /** Bottom of the deepest descender (negative). */
  letterBottom: number;
  /** `[codepoint, advance, …]`. */
  advances: readonly number[];
  /** `[codepoint, left kern class, …]`. */
  kernLeft: readonly number[];
  /** `[codepoint, right kern class, …]`. */
  kernRight: readonly number[];
  /** `[left class, right class, adjustment, …]`. */
  kern: readonly number[];
}

/** Measures text set in one font. */
export interface TextMeasure {
  /** Advance width of `text` at `size`, in the size's units. */
  width(text: string, size: number): number;
  /** Kerning between two characters, in font units. */
  kerning(left: string, right: string): number;
  /** Height of letters above the baseline, as a fraction of the size. */
  top: number;
  /** Depth of descenders below the baseline, as a positive fraction. */
  bottom: number;
}

const pairs = (flat: readonly number[]) => {
  const map = new Map<number, number>();
  for (let i = 0; i + 1 < flat.length; i += 2) map.set(flat[i], flat[i + 1]);
  return map;
};

/** A measurer over a metrics table. */
export function textMeasure(table: FontMetricsTable): TextMeasure {
  const advances = pairs(table.advances);
  const left = pairs(table.kernLeft);
  const right = pairs(table.kernRight);
  const kern = new Map<number, number>();
  // Class numbers stay far below 4096, so one number keys a class pair.
  for (let i = 0; i + 2 < table.kern.length; i += 3)
    kern.set(table.kern[i] * 4096 + table.kern[i + 1], table.kern[i + 2]);
  // Characters outside the subset fall back to another font in the browser;
  // an average advance keeps line breaking reasonable for them.
  const fallback = Math.round(table.upem * 0.55);
  const pairKern = (a: number, b: number) =>
    kern.get((left.get(a) ?? 0) * 4096 + (right.get(b) ?? 0)) ?? 0;
  return {
    width(text, size) {
      let units = 0;
      let previous: number | undefined;
      for (const char of text) {
        const code = char.codePointAt(0) as number;
        const advance = advances.get(code) ?? fallback;
        // A zero-advance character (the soft hyphen) draws nothing, and
        // HarfBuzz kerns its neighbours as if it were not there.
        if (advance === 0) continue;
        units += advance;
        if (previous !== undefined) units += pairKern(previous, code);
        previous = code;
      }
      return (units / table.upem) * size;
    },
    kerning(a, b) {
      return pairKern(a.codePointAt(0) as number, b.codePointAt(0) as number);
    },
    top: table.letterTop / table.upem,
    bottom: -table.letterBottom / table.upem,
  };
}

/** Noto Serif Italic: labels and captions. */
export const labelFont = textMeasure(fontMetrics.label);
/** Noto Serif Bold Italic: the compass labels. */
export const compassFont = textMeasure(fontMetrics.compass);
/** Noto Serif Hebrew Bold's letter body, as fractions of the size. */
export const hebrewLetterBody = {
  top: fontMetrics.hebrew.bodyTop / fontMetrics.hebrew.upem,
  bottom: fontMetrics.hebrew.bodyBottom / fontMetrics.hebrew.upem,
};

/** The default label size, in squares: the drawings' 2.82 mm on 6.62 mm squares. */
export const LABEL_SIZE = 0.43;
/** Line advance as a multiple of the size. */
export const LINE_HEIGHT = 1.15;

/**
 * The most lines one label or caption draws; the last of them ends in an
 * ellipsis when the text is cut. Content is untrusted, and a 200-character
 * label of one-letter words would otherwise draw a hundred lines.
 */
export const MAX_LABEL_LINES = 6;

/** One wrapped line and its width. */
export interface TextLine {
  text: string;
  width: number;
  /** Set on the last line when the text was cut to the line limit. */
  truncated?: boolean;
}

/**
 * Breaks text into lines no wider than `width` at spaces, but not at
 * no-break spaces; `\n` forces a break. A single word wider than the box stays on one line and overflows,
 * as "Praemonstrator" does over a dais lamen. At most `maxLines` lines are
 * returned; the last ends in "…" when more were cut.
 */
export function wrapText(
  text: string,
  width: number,
  size: number,
  font: TextMeasure = labelFont,
  maxLines = MAX_LABEL_LINES,
): TextLine[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    // No-break spaces join words: split at every other white space.
    const words = paragraph.split(/[^\S\u00a0\u2007\u202f]+/).filter(Boolean);
    let line: string | undefined;
    for (const word of words) {
      const joined = line === undefined ? word : `${line} ${word}`;
      if (line === undefined || font.width(joined, size) <= width)
        line = joined;
      else {
        lines.push(line);
        line = word;
        if (lines.length > maxLines) break;
      }
    }
    if (line !== undefined) lines.push(line);
    if (lines.length > maxLines) break;
  }
  const kept = lines.slice(0, Math.max(0, maxLines));
  const result: TextLine[] = kept.map((line) => ({
    text: line,
    width: font.width(line, size),
  }));
  if (lines.length > kept.length && result.length > 0) {
    const last = `${kept[kept.length - 1]}…`;
    result[result.length - 1] = {
      text: last,
      width: font.width(last, size),
      truncated: true,
    };
  }
  return result;
}
