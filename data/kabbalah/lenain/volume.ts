import pages from "../../dist/kabbalah/lenain/pages.json";

/**
 * The volume's own divisions, derived from its headings rather than listed by
 * hand, so that a re-transcription cannot leave the table of contents behind.
 *
 * The book is not evenly divided and the routes should not pretend otherwise.
 * Chapter VI holds all seventy-two genii and is 38 % of the text; Chapter IV
 * is a heading and four fold-out tables. Chapter VIII carries the Table of
 * Cycles and the Twenty-Eight Mansions of the Moon inside it, as Lenain set
 * them, rather than promoting them to siblings.
 *
 * pdf 7 to 16 are the preliminaries: the half-title, the 1823 title page, the
 * Paris and Brussels imprint, Papus's preface for the reissue, and Lenain's
 * own Avertissement. pdf 170 onwards are blanks and the 1909 publisher's
 * advertisements for Paracelsus and Lancelin, which are not his and are left
 * out. See plan 033.
 */

export type PageSequence = "reissue" | "author" | "body" | "unnumbered";
export type PageStyle = "arabic" | "roman-upper" | "roman-lower" | "none";
export type BlockKind =
  | "heading"
  | "paragraph"
  | "footnote"
  | "table"
  | "furniture";

export interface PrintedPage {
  number: number;
  style: PageStyle;
  sequence: PageSequence;
  label: string;
  anchor: string;
}

export interface Block {
  kind: BlockKind;
  text: string;
  rows: string[][];
  continuesPrevious: boolean;
  marker: string;
}

export interface Leaf {
  pdfPage: number;
  page: PrintedPage;
  blocks: Block[];
  uncertain: string[];
}

export const leaves = pages as Leaf[];

export interface Division {
  /** The URL segment: "preliminaires", "chapitre-6". */
  slug: string;
  /** Lenain's own heading, as he prints it. */
  heading: string;
  /** Lenain's own subtitle, as printed, where the division has one. */
  subtitle: string;
  /**
   * A short English name for a reader who has no French, rendered from his
   * subtitle rather than from a guess at the contents. Three of these were
   * guesses once, and three were wrong: Chapter V is the sacred calendar and
   * not invocation, VII the genii of the third class and not talismans, IX
   * the influences for composing them and not perfumes.
   */
  title: string;
  /** The first PDF page of the division, and the last. */
  from: number;
  to: number;
}

/**
 * Where each division begins, by the PDF page its heading falls on. The end of
 * one is the leaf before the next begins.
 */
const OPENS: { pdfPage: number; slug: string; title: string }[] = [
  { pdfPage: 7, slug: "preliminaires", title: "Preliminaries" },
  {
    pdfPage: 17,
    slug: "chapitre-1",
    title: "The Name of God and its Attributes",
  },
  { pdfPage: 23, slug: "chapitre-2", title: "The Origin of the Divine Names" },
  { pdfPage: 36, slug: "chapitre-3", title: "The 72 Attributes of God" },
  { pdfPage: 41, slug: "chapitre-4", title: "The Four Cabalistic Tables" },
  { pdfPage: 57, slug: "chapitre-5", title: "The Sacred Calendar" },
  { pdfPage: 61, slug: "chapitre-6", title: "The 72 Genii" },
  { pdfPage: 115, slug: "chapitre-7", title: "The Genii of the Third Class" },
  { pdfPage: 129, slug: "chapitre-8", title: "Cabalistic Astrology" },
  { pdfPage: 157, slug: "chapitre-9", title: "Composing the Talismans" },
  { pdfPage: 165, slug: "chapitre-10", title: "The Name Jehovah" },
];

/** The last leaf of the book proper; what follows is the reissue's adverts. */
export const LAST_LEAF = 169;

/** The headings a division opens with: Lenain's chapter line and his subtitle. */
function headingAt(pdfPage: number) {
  const leaf = leaves.find((page) => page.pdfPage === pdfPage);
  const headings = (leaf?.blocks ?? [])
    .filter((block) => block.kind === "heading")
    .map((block) => block.text);
  // The first leaf of the body repeats the book's own title above Chapter I.
  const at = headings.findIndex((text) => /^CHAPITRE/i.test(text));
  if (at < 0) return { heading: headings[0] ?? "", subtitle: "" };
  // A subtitle is the line under the chapter line, unless that line is itself
  // a table's title — Chapter IV's content is its four tables.
  const next = headings[at + 1] ?? "";
  return {
    heading: headings[at],
    subtitle: /TABLE/i.test(next) ? "" : next,
  };
}

export const divisions: Division[] = OPENS.map((open, index) => ({
  slug: open.slug,
  ...headingAt(open.pdfPage),
  title: open.title,
  from: open.pdfPage,
  to: (OPENS[index + 1]?.pdfPage ?? LAST_LEAF + 1) - 1,
}));

export function divisionBySlug(slug: string) {
  return divisions.find((division) => division.slug === slug);
}

/** The leaves of one division, in order. */
export function leavesOf(division: Division) {
  return leaves.filter(
    (leaf) => leaf.pdfPage >= division.from && leaf.pdfPage <= division.to,
  );
}

/** Every leaf of the book proper, the reissue's advertisements excluded. */
export function bookLeaves() {
  return leaves.filter((leaf) => leaf.pdfPage <= LAST_LEAF);
}

/** Which division a leaf belongs to, for a permalink that names both. */
export function divisionOfLeaf(pdfPage: number) {
  return divisions.find(
    (division) => pdfPage >= division.from && pdfPage <= division.to,
  );
}
