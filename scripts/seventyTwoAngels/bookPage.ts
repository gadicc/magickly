import { readFileSync } from "node:fs";
import JSON5 from "json5";
import type { PageBlock, PageTranscription } from "./pageSchema";

/**
 * A leaf of the volume, as the volume numbers it.
 *
 * The transcription records `printedPage` as an integer, which was enough
 * while the only consumer was a Markdown file read top to bottom. It is not
 * enough for a permalink. The volume runs three numbering sequences: the 1909
 * reissue's own front matter, set in capital roman and carrying Papus's
 * preface — « ( IV ) »; Lenain's Avertissement, set in the old French lower
 * roman that writes a final i as j — « vj », « vij »; and the body, arabic 1
 * to 153. Flattened to an integer, 4, 6 and 7 each name two different leaves,
 * and the generated Markdown already prints "[p. 4]" twice.
 *
 * The printed form survives in the page's own furniture, so the sequence is
 * read back from it rather than guessed from where the leaf falls: 155 of the
 * 168 leaves re-derive their stored number this way with no disagreement, and
 * the 13 that do not are the ones that carry no number at all.
 *
 * Page 26 of the body is absent. It is the fold-out leaf, photographed folded,
 * and the apparatus has a note saying so — see plan 033.
 */

export type PageSequence = "reissue" | "author" | "body" | "unnumbered";
export type PageStyle = "arabic" | "roman-upper" | "roman-lower" | "none";

export interface PrintedPage {
  /** The number as printed, or 0 for a leaf carrying none. */
  number: number;
  style: PageStyle;
  sequence: PageSequence;
  /** As printed: "53", "vij", "IV", or "" where the leaf is unnumbered. */
  label: string;
  /**
   * The permalink fragment. Distinct across the whole volume, which is the
   * point: "p53", "p-vij", "p-IV", and "leaf-42" by scan page for the
   * unnumbered.
   */
  anchor: string;
}

/** One leaf of the committed edition: the transcription, plus where it sits. */
export interface BookPage {
  pdfPage: number;
  page: PrintedPage;
  blocks: PageBlock[];
  uncertain: string[];
}

const UPPER_ROMAN = /\(\s*([IVXLC]{1,6})\s*\)/;
const ARABIC = /\(\s*(\d{1,3})\s*\)/;
/** « vj » and « vij »: lower roman, with j for a final i. */
const LOWER_ROMAN = /(?:^|\|)\s*(v?[ij]{1,4}j?|x[ij]*)\s*(?:\||$)/;

const ROMAN_VALUES: Record<string, number> = {
  i: 1,
  j: 1,
  v: 5,
  x: 10,
  l: 50,
  c: 100,
};

/** Reads a roman numeral, counting a final j as i. */
export function romanValue(numeral: string) {
  const text = numeral.toLowerCase();
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const current = ROMAN_VALUES[text[i]];
    if (current === undefined) return 0;
    total += current < (ROMAN_VALUES[text[i + 1]] ?? 0) ? -current : current;
  }
  return total;
}

function furnitureOf(blocks: PageBlock[]) {
  return blocks
    .filter((block) => block.kind === "furniture")
    .map((block) => block.text)
    .join(" | ");
}

/**
 * Where a leaf sits, read from what is printed on it.
 *
 * The arabic test runs before the lower-roman one: "( 1 )" would otherwise be
 * taken for a roman i by a pattern that has to accept j.
 */
export function printedPageOf(transcription: PageTranscription): PrintedPage {
  const furniture = furnitureOf(transcription.blocks);
  const unnumbered = (): PrintedPage => ({
    number: 0,
    style: "none",
    sequence: "unnumbered",
    label: "",
    anchor: `leaf-${transcription.pdfPage}`,
  });

  const upper = furniture.match(UPPER_ROMAN);
  if (upper)
    return {
      number: romanValue(upper[1]),
      style: "roman-upper",
      sequence: "reissue",
      label: upper[1],
      anchor: `p-${upper[1]}`,
    };

  const arabic = furniture.match(ARABIC);
  if (arabic)
    return {
      number: Number(arabic[1]),
      style: "arabic",
      sequence: "body",
      label: arabic[1],
      anchor: `p${arabic[1]}`,
    };

  const lower = furniture.match(LOWER_ROMAN);
  if (lower)
    return {
      number: romanValue(lower[1]),
      style: "roman-lower",
      sequence: "author",
      label: lower[1],
      anchor: `p-${lower[1]}`,
    };

  return unnumbered();
}

/** How a reader is told which leaf they are on. */
export function pageLabel(page: PrintedPage) {
  return page.label ? `p. ${page.label}` : "unnumbered";
}

/**
 * The volume as committed. This is what the renderer, the entry cutter and the
 * apparatus read — not `output/`, which only `gatherPages.ts` touches.
 */
export function bookPages(
  path = "data/kabbalah/lenain/pages.json5",
): BookPage[] {
  const pages: BookPage[] = JSON5.parse(readFileSync(path, "utf8"));
  if (!pages.length) throw new Error(`No leaves in ${path}`);
  return pages;
}

/** The leaves of one run of PDF pages, in order. */
export function bookPagesBetween(from: number, to: number) {
  return bookPages().filter(
    (page) => page.pdfPage >= from && page.pdfPage <= to,
  );
}
