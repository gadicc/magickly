import apparatus from "../../dist/kabbalah/lenain/apparatus.json";

/**
 * The editorial apparatus: everywhere this edition departs from the book, or
 * cannot follow it.
 *
 * Lenain is published as he set it. Where he is wrong the text keeps his words
 * and a note says what is wrong and what it should be; our own tables use the
 * corrected value. Where the scan cannot answer, the note says that too.
 *
 * Built by scripts/seventyTwoAngels/apparatus.ts, which derives what it can
 * from his own four tables and folds in the notes no rule can see. This module
 * is the reading side of it. See plan 033.
 */

export interface Note {
  /** The genius it concerns, or 0 for a note about the book at large. */
  no: number;
  kind: "correction" | "reading" | "reconstruction";
  field: string;
  /** The leaf it concerns, as that leaf's anchor. */
  page?: string;
  printed: string;
  used: string;
  why: string;
}

export const notes = apparatus as Note[];

/**
 * Which notes belong to which leaf.
 *
 * Every note that concerns a genius is stamped with that genius's leaf when
 * the apparatus is built, so this is a grouping and not a search. Notes about
 * the book at large belong to no leaf and are rendered with the edition
 * instead — three of them reached no reader at all until plan 033, including
 * the one that explains why leaf 26 is missing.
 */
export function notesByPage(): Map<string, Note[]> {
  const byPage = new Map<string, Note[]>();
  for (const note of notes) {
    if (!note.page) continue;
    byPage.set(note.page, [...(byPage.get(note.page) ?? []), note]);
  }
  return byPage;
}

/** Notes that concern no single leaf: they belong to the edition, not a page. */
export function editionNotes() {
  return notes.filter((note) => note.no === 0 && !note.page);
}
