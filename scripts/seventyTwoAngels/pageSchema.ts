import { z } from "zod";

/**
 * One page of Lenain as it is printed, read from the scan rather than from the
 * OCR of it.
 *
 * Structure is kept rather than flattened, because the flattening is what the
 * existing sidecar lost: its footnotes interrupt sentences mid-clause, and the
 * first cabalistic table — 72 rows of name, nation and divine name — survives
 * only for its last ten. A table that is still a table can be read against the
 * prose entries, which is worth more than any single reading of either.
 */

export const pageBlock = z.object({
  kind: z.enum([
    /** A chapter or table title. */
    "heading",
    /** Ordinary body text. */
    "paragraph",
    /** A footnote, printed below the rule at the foot of the page. */
    "footnote",
    /** A table; its contents are in `rows` and `text` is left empty. */
    "table",
    /** A running head, page number, signature mark or catchword. */
    "furniture",
  ]),
  /** The text as printed, hyphens rejoined, empty for a table. */
  text: z.string(),
  /** Rows of cells, for a table; empty otherwise. */
  rows: z.array(z.array(z.string())),
  /**
   * True where this carries on the previous block's paragraph rather than
   * beginning a new one — because the footnote rule cut across it, or because
   * the page ended mid-sentence. Without it a paragraph broken by a footnote
   * came back as two, and a word broken with it: "commence de-" was left
   * hanging and the abbé de Villars followed it.
   */
  continuesPrevious: z.boolean(),
  /**
   * For a footnote, the marker it answers to as printed — "1", "2" — so it can
   * be set against its call in the prose rather than piled at the foot. Empty
   * for every other kind.
   */
  marker: z.string(),
});

export const pageTranscription = z.object({
  /** The page of the PDF this was read from. */
  pdfPage: z.number().int().min(1),
  /** The number printed on the page, or 0 where none is. */
  printedPage: z.number().int().min(0),
  blocks: z.array(pageBlock),
  /** Anything illegible or doubtful, in the reader's own words. */
  uncertain: z.array(z.string()),
});

export type PageBlock = z.infer<typeof pageBlock>;
export type PageTranscription = z.infer<typeof pageTranscription>;

/**
 * Whether a block carries on the one before it rather than starting afresh.
 *
 * The model was asked this directly, in `continuesPrevious`, and largely did
 * not answer: three pages of seventy-two were flagged where forty-one plainly
 * begin mid-sentence. The page itself says so more reliably than any prompt —
 * a paragraph that opens in lower case, or follows a hyphen, is a continuation
 * — so its own answer is taken only as corroboration. See plan 031.
 */
export function continuesParagraph(sofar: string, block: PageBlock) {
  if (block.continuesPrevious) return true;
  if (sofar.endsWith("-")) return true;
  return /^[a-zà-öø-ÿ]/.test(block.text);
}

/**
 * Footnotes are set below a rule at the foot of the page, so nothing of the
 * body follows them. A long note runs to several paragraphs and only its first
 * was being marked as a note; the rest fell into the text, which is how the
 * abbé de Villars came to interrupt the thirty-eighth genius mid-word.
 */
export function isBelowTheRule(blocks: PageBlock[], index: number) {
  return blocks.slice(0, index).some((block) => block.kind === "footnote");
}
