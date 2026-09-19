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
