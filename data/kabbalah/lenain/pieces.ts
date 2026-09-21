import { leaves as allLeaves, type Block, type Leaf } from "./volume";

/**
 * The book as a reader meets it, rather than as the scanner found it.
 *
 * A paragraph does not stop at the foot of a page. Eighty-four of the hundred
 * and sixty-eight leaves open mid-sentence, so rendering each leaf alone began
 * a broken paragraph on every one of them. The volume is folded into pieces
 * that run across leaves, and each piece records where its page breaks fall so
 * that a renderer can set the marker inside the paragraph, at the point the
 * break actually happens, as EPUB does.
 *
 * This is shared deliberately. There are two renderers — the Markdown edition
 * and the HTML routes — and the one thing they must not do is disagree about
 * where a paragraph ends or which leaf a sentence is on. Both fold here; each
 * draws its own marker. See plan 033.
 */

/** Where a leaf begins inside a piece's text. */
export interface PageBreak {
  anchor: string;
  label: string;
  /** Offset into `text`; 0 means the piece opens the leaf. */
  at: number;
}

export interface Piece {
  kind: Block["kind"];
  text: string;
  rows: string[][];
  /** For a footnote, the marker it answers to, as printed. */
  marker: string;
  /** Every leaf this piece runs across, in order. */
  breaks: PageBreak[];
}

/**
 * Whether a block carries on the one before it rather than starting afresh.
 *
 * The transcription was asked this directly and largely did not answer: three
 * leaves of seventy-two were flagged where forty-one plainly begin mid-
 * sentence. The page says so more reliably — a paragraph opening in lower case,
 * or following a hyphen, is a continuation — so its own answer is taken only
 * as corroboration.
 */
export function continuesParagraph(sofar: string, block: Block) {
  if (block.continuesPrevious) return true;
  if (sofar.endsWith("-")) return true;
  return /^[a-zà-öø-ÿ]/.test(block.text);
}

/**
 * Folds the leaves into pieces.
 *
 * A word the leaf broke in half is made whole and the break recorded after it:
 * the break falls mid-word, but "ministère" is a word and "mi… nistère" is
 * not, and a reader searching for it should find it.
 */
export function piecesOf(leaves: Leaf[] = allLeaves): Piece[] {
  const pieces: Piece[] = [];

  for (const leaf of leaves) {
    const { anchor, label } = leaf.page;
    let opened = false;

    for (const block of leaf.blocks) {
      if (block.kind === "furniture") continue;
      // A footnote set below the rule interrupts the paragraph it belongs to
      // without ending it: the text resumes above the rule on the next leaf,
      // often mid-word. Looking only at the piece immediately before would
      // find the note and start afresh, stranding "de-" with its hyphen. The
      // paragraph to carry on is the last one, whatever notes came between.
      const last =
        block.kind === "paragraph"
          ? [...pieces].reverse().find((piece) => piece.kind === "paragraph")
          : pieces[pieces.length - 1];
      const carriesOn =
        last !== undefined &&
        last.kind === block.kind &&
        block.kind === "paragraph" &&
        continuesParagraph(last.text, block);

      // A footnote interrupting a paragraph is not folded into it: the
      // resumption after the rule becomes its own piece, and a word the rule
      // cut is left with its hyphen. Rare, and less wrong than gluing a note
      // into the sentence it interrupts. Recorded in plan 033's follow-ups.
      if (carriesOn) {
        if (last.text.endsWith("-")) {
          const [, word, rest] = block.text.match(/^(\S*)([\s\S]*)$/) ?? [
            "",
            block.text,
            "",
          ];
          const joined = last.text.slice(0, -1) + word;
          if (!opened) last.breaks.push({ anchor, label, at: joined.length });
          last.text = joined + rest;
        } else {
          const joined = `${last.text} `;
          if (!opened) last.breaks.push({ anchor, label, at: joined.length });
          last.text = joined + block.text;
        }
        opened = true;
        continue;
      }

      pieces.push({
        kind: block.kind,
        text: block.text,
        rows: block.rows,
        marker: block.marker,
        breaks: opened ? [] : [{ anchor, label, at: 0 }],
      });
      opened = true;
    }

    // A leaf of nothing but furniture — a blank, a plate — still exists, and a
    // permalink to it should land somewhere.
    if (!opened)
      pieces.push({
        kind: "paragraph",
        text: "",
        rows: [],
        marker: "",
        breaks: [{ anchor, label, at: 0 }],
      });
  }

  return pieces;
}

/**
 * A piece cut at its page breaks: each segment is the marker for a leaf, if
 * one falls there, and the text that runs until the next. A piece that
 * continues a leaf already open has no marker of its own.
 */
export function segmentsOf(piece: Piece): {
  before?: PageBreak;
  text: string;
}[] {
  const breaks = [...piece.breaks].sort((a, b) => a.at - b.at);
  if (!breaks.length) return [{ text: piece.text }];

  // A paragraph that carries on from the leaf before has no break at 0, and
  // the text before its first break belongs to that earlier leaf. Slicing
  // straight from the first break threw it away: 52 pieces lost their opening
  // words that way, and only a word count against the source caught it.
  const segments =
    breaks[0].at > 0 ? [{ text: piece.text.slice(0, breaks[0].at) }] : [];

  return segments.concat(
    breaks.map((before, index) => ({
      before,
      text: piece.text.slice(
        before.at,
        breaks[index + 1]?.at ?? piece.text.length,
      ),
    })),
  );
}

/**
 * A footnote's text without the marker the page prints at its head.
 *
 * Lenain sets the marker at the start of the note, and a renderer that sets
 * another in front of it gives "(1) (1) Les premiers Égyptiens…" — which the
 * Markdown edition did 51 times. The marker is the renderer's to draw, so the
 * text hands it over.
 */
export function footnoteText(piece: Piece) {
  if (piece.kind !== "footnote" || !piece.marker) return piece.text;
  const marker = piece.marker.replace(/[()]/g, "");
  return piece.text.replace(new RegExp(`^\\s*\\(${marker}\\)\\s*`), "");
}

/**
 * Which leaf is in effect at each piece, and where each leaf's last piece is.
 *
 * Only the first piece of a leaf carries that leaf's break, so asking which
 * pieces carry a break answers where a leaf *opens*, not where it ends. Notes
 * set at the opening landed between a chapter's heading and its first
 * paragraph. This walks the pieces keeping the current leaf, so a leaf closes
 * at the last piece actually belonging to it.
 */
export function leafClosings(pieces: Piece[]) {
  const lastOf = new Map<string, number>();
  let current: string | undefined;
  pieces.forEach((piece, index) => {
    const opens = piece.breaks[piece.breaks.length - 1];
    if (opens) current = opens.anchor;
    if (current) lastOf.set(current, index);
  });

  const closesAt = new Map<number, string[]>();
  for (const [anchor, index] of lastOf)
    closesAt.set(index, [...(closesAt.get(index) ?? []), anchor]);
  return closesAt;
}
