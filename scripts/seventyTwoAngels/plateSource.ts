import { existsSync } from "node:fs";
import { ANGEL_COUNT } from "../../data/kabbalah/seventyTwoAngelsDerived";
import { handReadings } from "./hebrew";
import {
  continuesParagraph,
  isNoteAt,
  type PageBlock,
  type PageTranscription,
} from "./pageSchema";
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
  /** Lenain's own footnotes, with the marker each answers to. */
  footnotes: { marker: string; text: string }[];
  /** The printed pages it runs across. */
  printedPages: number[];
}

/**
 * Adds a block to what an entry has so far. A paragraph the footnote rule or a
 * page break cut across carries on rather than starting again, and a word it
 * cut in half is made whole.
 */
function join(sofar: string, block: PageBlock) {
  if (!sofar) return block.text;
  if (!continuesParagraph(sofar, block)) return `${sofar}\n\n${block.text}`;
  return sofar.endsWith("-")
    ? sofar.slice(0, -1) + block.text
    : `${sofar} ${block.text}`;
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
    page.blocks.forEach((block, index) => {
      if (block.kind === "furniture" || block.kind === "table") return;

      // Nothing of the body follows the rule, so a paragraph down there is a
      // long note carrying on rather than the text resuming.
      // Notes are gathered a page at a time and given out afterwards.
      if (isNoteAt(page.blocks, index)) return;

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
        return;
      }

      if (!current) return;
      current.french = join(current.french, block);
      if (!current.printedPages.includes(page.printedPage))
        current.printedPages.push(page.printedPage);
    });
  }

  const missing = Array.from({ length: ANGEL_COUNT }, (_, i) => i + 1).filter(
    (no) => !entries.has(no),
  );
  if (missing.length)
    throw new Error(`No heading found for genius ${missing.join(", ")}`);

  const all = Array.from({ length: ANGEL_COUNT }, (_, i) => {
    const entry = entries.get(i + 1);
    if (!entry) throw new Error(`Missing genius ${i + 1}`);
    return entry;
  });
  return withReadHebrew(attachNotes(all, chapterPages().flatMap(notesOfPage)));
}

/**
 * Gives each note to the entry whose prose calls for it.
 *
 * A note is set at the foot of its page, which may be below the next genius's
 * heading: the fifth's note sits under the sixth's opening, so collecting them
 * as they come attaches it to the sixth, which never asked for it, and leaves
 * the fifth with a "(1)" pointing at nothing. The call in the prose says whose
 * it is.
 */
/** A stand-in so a note's text can be tested with the block rules. */
const EMPTY_BLOCK = {
  kind: "footnote" as const,
  text: "",
  rows: [],
  continuesPrevious: true,
  marker: "",
};

interface PageNote {
  marker: string;
  text: string;
  printedPage: number;
}

/**
 * The notes of one page, whole.
 *
 * A note runs to several blocks and only the first carries a marker, so
 * gathering them as the entries are walked fragments any note a heading falls
 * inside — the seventieth's ran to three pieces, two of which ended up on the
 * seventy-second. Within a page the order is plain, so they are made whole
 * here and given out afterwards.
 */
function notesOfPage(page: PageTranscription): PageNote[] {
  const notes: PageNote[] = [];
  page.blocks.forEach((block, index) => {
    if (block.kind === "furniture" || block.kind === "table") return;
    if (!isNoteAt(page.blocks, index)) return;

    const last = notes[notes.length - 1];
    if (last && (!block.marker || block.marker === last.marker)) {
      last.text = continuesParagraph(last.text, block)
        ? `${last.text} ${block.text}`
        : `${last.text}\n\n${block.text}`;
      return;
    }
    notes.push({
      marker: block.marker,
      text: block.text,
      printedPage: page.printedPage,
    });
  });
  return notes;
}

/**
 * Gives each note to the entry that calls for it. The marker names it and the
 * page narrows it: two entries may each print a note "(1)", and only one of
 * them runs across the page this one is set on.
 */
function attachNotes(entries: PlateEntry[], notes: PageNote[]) {
  for (const entry of entries) entry.footnotes = [];

  for (const note of notes) {
    const call = new RegExp(`\\(${note.marker || "\\d"}\\)`);
    const onPage = entries.filter((entry) =>
      entry.printedPages.includes(note.printedPage),
    );
    const wants = onPage.find((entry) => call.test(entry.french)) ?? onPage[0];
    if (!wants) continue;

    // A long note runs across pages, and its later pages carry no marker of
    // their own — the seventieth's fills three. Same marker, or none, joins
    // what the entry already holds.
    // A long note runs across pages, and its later pages carry no marker of
    // their own — or carry one misread from the page, as the thirty-eighth's
    // second note does, resuming "ON," where it broke off at "le mot". A note
    // that does not end in terminal punctuation has not ended.
    const held = wants.footnotes[wants.footnotes.length - 1];
    // A stop may be followed by a closing bracket: "(Voyez le Frontispice.)"
    // has ended.
    const unfinished = held && !/[.!?»][)\]"'»]?\s*$/.test(held.text);
    if (held && (unfinished || !note.marker || note.marker === held.marker))
      held.text = continuesParagraph(held.text, {
        ...EMPTY_BLOCK,
        text: note.text,
      })
        ? `${held.text} ${note.text}`
        : `${held.text}\n\n${note.text}`;
    else wants.footnotes.push({ marker: note.marker, text: note.text });
  }
  return entries;
}

/**
 * Puts the Hebrew a person read into the entry's own prose.
 *
 * The heading's Hebrew was read by a machine along with the rest of the page,
 * and where a person has since read it the two disagree — the fifty-fourth's
 * prose said one thing while the name above it said another. Only the first
 * run of Hebrew is touched, which is the name in the heading; any further
 * Hebrew belongs to the entry's argument and is left alone.
 */
function withReadHebrew(entries: PlateEntry[]) {
  const byHand = handReadings();
  for (const entry of entries) {
    const hand = byHand.get(entry.no);
    if (!hand) continue;
    entry.french = entry.french.replace(
      /[\u0590-\u05FF][\u0590-\u05FF\u0591-\u05C7]*/,
      hand.pointed,
    );
  }
  return entries;
}

/** Whether the chapter has been read, so callers can fall back to the OCR. */
export function platesAvailable() {
  return existsSync(`output/lenainPages/p-${CHAPTER_FROM}.json`);
}
