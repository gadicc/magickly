import { existsSync } from "node:fs";
import { ANGEL_COUNT } from "../../data/kabbalah/seventyTwoAngelsDerived";
import type { PageTranscription } from "./pageSchema";
import { readPage } from "./transcribe";

/**
 * Each genius's entry, taken from the pages read off the scan rather than from
 * the OCR of them.
 *
 * The OCR needed a tolerant parser, an ordinal-repair table and a widened
 * window for the entry whose heading it dropped. None of that is needed here:
 * the headings are legible, so the entries can simply be cut on them. What the
 * OCR could not give at all — the Hebrew, the twenty-second's heading, the
 * psalm numbers — is on the page. See plan 031.
 */

/** The genii chapter, as pages of the PDF. */
export const CHAPTER_FROM = 61;
export const CHAPTER_TO = 113;

/** "1er. génie, Vehuiah", "22e. Ieiaiel", "72e Mumiah" — an ordinal, a name. */
const HEADING =
  /^\s*(\d{1,2})\s*(?:e|er|re|ᵉ|ᵉʳ|°)?\s*\.?\s*(?:génie\s*,?\s*)?([A-ZÉÈÎÏ][^\s.,]*)/;

/** What an entry's opening line says after the name, in one form or another. */
const OPENS_AN_ENTRY = /Son attribut|attribut\s*\(|Les cabalistes lui donnent/;

export interface PlateEntry {
  no: number;
  /** The romanised name as the heading prints it. */
  name: string;
  /**
   * The ordinal the heading prints, where it is not the entry's place in the
   * sequence. Lenain sets "36e" over the forty-sixth.
   */
  printedOrdinal?: number;
  /** The entry's French, as printed, paragraphs separated by blank lines. */
  french: string;
  /** Lenain's own footnotes from the pages the entry spans. */
  footnotes: string[];
  /** The printed pages it runs across. */
  printedPages: number[];
}

function chapterPages(): PageTranscription[] {
  const pages: PageTranscription[] = [];
  for (let page = CHAPTER_FROM; page <= CHAPTER_TO; page++) {
    try {
      pages.push(readPage(page));
    } catch {
      // A page that has not been read is simply absent.
    }
  }
  if (!pages.length)
    throw new Error(
      "No pages have been read. Run transcribe.ts over the genii chapter first.",
    );
  return pages;
}

/**
 * Cuts the chapter's paragraphs into entries on their headings. A paragraph
 * whose ordinal is the one the sequence is due opens the next entry; anything
 * before the first heading belongs to the chapter's preamble and is dropped.
 */
export function plateEntries(): PlateEntry[] {
  const entries = new Map<number, PlateEntry>();
  let current: PlateEntry | undefined;
  let expected = 1;

  for (const page of chapterPages()) {
    for (const block of page.blocks) {
      if (block.kind === "furniture" || block.kind === "table") continue;

      if (block.kind === "footnote") {
        current?.footnotes.push(block.text);
        continue;
      }

      // An entry is recognised by its shape and taken in sequence, because the
      // ordinal it prints is not always the one it is: the forty-sixth is set
      // as "36e". Position decides; the printed ordinal is recorded.
      const heading = block.text.match(HEADING);
      if (heading && OPENS_AN_ENTRY.test(block.text.slice(0, 120))) {
        const printed = Number(heading[1]);
        current = {
          no: expected,
          name: heading[2].replace(/[.,;:]$/, ""),
          ...(printed === expected ? {} : { printedOrdinal: printed }),
          french: block.text,
          footnotes: [],
          printedPages: [page.printedPage],
        };
        entries.set(expected, current);
        expected += 1;
        continue;
      }

      if (!current) continue;
      current.french += `\n\n${block.text}`;
      if (!current.printedPages.includes(page.printedPage))
        current.printedPages.push(page.printedPage);
    }
  }

  const missing = Array.from({ length: ANGEL_COUNT }, (_, i) => i + 1).filter(
    (no) => !entries.has(no),
  );
  if (missing.length)
    throw new Error(`No heading found for genius ${missing.join(", ")}`);

  return Array.from({ length: ANGEL_COUNT }, (_, i) => {
    const entry = entries.get(i + 1);
    if (!entry) throw new Error(`Missing genius ${i + 1}`);
    return entry;
  });
}

/** Whether the chapter has been read, so callers can fall back to the OCR. */
export function platesAvailable() {
  return existsSync(`output/lenainPages/p-${CHAPTER_FROM}.json`);
}
