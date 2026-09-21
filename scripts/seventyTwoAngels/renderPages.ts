import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import JSON5 from "json5";
import {
  firstTable,
  firstTableCounts,
  PRINTED_FROM,
} from "../../data/kabbalah/lenain/firstTable";
import {
  footnoteText,
  leafClosings,
  type Piece,
  piecesOf,
  segmentsOf,
} from "../../data/kabbalah/lenain/pieces";
import type { Note } from "./apparatus";
import { type BookPage, bookPages } from "./bookPage";
import { plateEntries } from "./plateSource";

/**
 * Renders the committed volume to Markdown.
 *
 * It reads `pages.json5` rather than `output/`, so a fresh clone can rebuild
 * the edition; gathering the transcription into that file is gatherPages.ts's
 * job and is run only after a re-transcription. The Markdown is for people,
 * and is generated — edit the JSON5, or re-read the page, never the Markdown.
 *
 *   pnpm exec tsx scripts/seventyTwoAngels/renderPages.ts
 *   … --out-dir output     where to write, for a partial run
 */

const MARKDOWN_PATH = "public/docs/Lenain - La Science Cabalistique (1823).md";

const MARKDOWN_HEADER = `# La Science Cabalistique

**Lazare Lenain**, Amiens, 1823. [Digitised by Google Books](https://www.google.co.uk/books/edition/La_science_cabalistique/ZqgpxTZ43HkC).

The scan is not of the 1823 printing itself but of a later reissue, which
reproduces Lenain's title page — *A Amiens, chez l'Auteur, au Cabinet de
lecture, place Saint-Firmin, N. 1. 1823* — and adds a preface by Papus for the
Ordre Kabbalistique de la Rose-Croix, calling it "la réédition du rarissime
opuscule de Lenain". The volume does not date itself; the first reprint is
recorded as Dujols and Thomas, 1909.

Lenain died in 1877 and Papus in 1916, so both texts are public domain and no
rights are asserted over either. This reading of it was made for [magick.ly](https://magick.ly) from the
scan, page by page, and is offered under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) along with the rest of
the site's data. It replaces an earlier OCR, which could not read the Hebrew and
rendered many of the digits as letters.

Page numbers are Lenain's own. Footnotes are given under the page they were
printed on, as he set them.

`;

/**
 * A table as Markdown, padded to its widest row so the columns line up.
 *
 * `head` is for our own tables only. Lenain's carry no header row, so his are
 * rendered with the rule above an empty one and the first row left as data —
 * giving his first row a heading it does not have would be an edit.
 */
function table(rows: string[][], head?: string[]) {
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (!width) return "";
  const cell = (value: string) => value.replace(/\|/g, "\\|").trim();
  const line = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cell(row[i] ?? "")).join(" | ")} |`;

  return [
    head ? line(head) : `|${" |".repeat(width)}`,
    `|${" --- |".repeat(width)}`,
    ...rows.map(line),
  ].join("\n");
}

/**
 * Our notes, set apart from Lenain's own. His are blockquotes, as he printed
 * them; ours are a list under a heading that says whose they are, so a reader
 * can always tell 1823 from now. Keeping the two apparatus separate is the
 * whole point of having one.
 */
function notesToMarkdown(notes: Note[], title = "Editorial notes") {
  if (!notes.length) return "";
  const lines = notes.map((note) => {
    const change = note.printed
      ? note.used
        ? `${note.printed} → ${note.used}`
        : `${note.printed}, kept as printed`
      : note.used;
    const who = note.no ? `genius ${note.no}, ` : "";
    return `- **${who}${note.field}** (${note.kind})${change ? ` · ${change}` : ""} — ${note.why}`;
  });
  return `<small>\n\n**${title}**\n\n${lines.join("\n")}\n\n</small>`;
}

/** What the reading was unsure of, which an edition should not hide. */
function doubtsToMarkdown(doubts: string[]) {
  if (!doubts.length) return "";
  const lines = doubts.map((doubt) => `- ${doubt}`);
  return `<small>\n\n<details><summary>Reading notes</summary>\n\n${lines.join("\n")}\n\n</details>\n\n</small>`;
}

/** Which notes belong to which leaf, by its anchor. */
function notesByPage(pages: BookPage[]): Map<string, Note[]> {
  const notes: Note[] = JSON5.parse(
    readFileSync("data/kabbalah/lenain/apparatus.json5", "utf8"),
  );
  const anchorOf = new Map<number, string>();
  for (const page of pages) anchorOf.set(page.page.number, page.page.anchor);
  const entryPage = new Map(
    plateEntries().map((entry) => [entry.no, entry.printedPages[0]]),
  );

  const byPage = new Map<string, Note[]>();
  for (const note of notes) {
    // A note names its leaf, or hangs on the genius it concerns.
    const anchor =
      note.page ??
      (note.no ? anchorOf.get(entryPage.get(note.no) ?? -1) : undefined);
    if (!anchor) continue;
    byPage.set(anchor, [...(byPage.get(anchor) ?? []), note]);
  }
  return byPage;
}

/** Notes that concern no single leaf: they belong to the edition, not a page. */
function editionNotes(): Note[] {
  const notes: Note[] = JSON5.parse(
    readFileSync("data/kabbalah/lenain/apparatus.json5", "utf8"),
  );
  return notes.filter((note) => note.no === 0 && !note.page);
}

/** The leaf marker, which is also the permalink and the page-break landmark. */
function pageMarker(anchor: string, label: string) {
  return `<small id="${anchor}">**[${label ? `p. ${label}` : "unnumbered"}]**</small>`;
}

function pieceToMarkdown(piece: Piece) {
  if (piece.kind === "table") return table(piece.rows);

  // The marker for a leaf that opens inside a paragraph is set inside it,
  // where the break falls; one that opens the piece is set above it.
  const text = segmentsOf(
    piece.kind === "footnote" ? { ...piece, text: footnoteText(piece) } : piece,
  )
    .map(({ before, text: segment }, index) => {
      if (!before) return segment;
      const marker = pageMarker(before.anchor, before.label);
      return index === 0 ? `${marker}\n\n${segment}` : `${marker} ${segment}`;
    })
    .join("");

  if (piece.kind === "heading")
    return text.replace(/^((?:<small[^>]*>.*?<\/small>\n\n)?)/, "$1## ");
  if (piece.kind === "footnote") {
    const marker = piece.marker ? `**(${piece.marker})** ` : "";
    return `> ${marker}${text.replace(/\n/g, "\n> ")}`;
  }
  return text;
}

function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out-dir");
  const outDir = outAt < 0 ? "" : `${args[outAt + 1]}/`;

  const pages = bookPages();
  const byPage = notesByPage(pages);
  const doubts = new Map(
    pages.map((page) => [page.page.anchor, page.uncertain]),
  );

  // A leaf's notes are set once every piece that runs across it has been
  // rendered, so a paragraph spanning two leaves is not cut in half by them.
  const pieces = piecesOf(pages);
  const closingAt = leafClosings(pieces);

  const body: string[] = [];
  pieces.forEach((piece, index) => {
    const rendered = pieceToMarkdown(piece);
    if (rendered) body.push(rendered);
    for (const anchor of closingAt.get(index) ?? []) {
      const notes = notesToMarkdown(byPage.get(anchor) ?? []);
      if (notes) body.push(notes);
      const unsure = doubtsToMarkdown(doubts.get(anchor) ?? []);
      if (unsure) body.push(unsure);
    }
  });

  // The fold-out's lost rows, put back from the entries and marked as such.
  const counts = firstTableCounts();
  const reconstruction = [
    "## The first cabalistic table, reconstructed",
    `The plate is a fold-out and the scan caught it folded: only rows ${PRINTED_FROM} to 72 are legible. The ${counts.reconstructed} rows marked *reconstructed* below are **not from the plate** — they are put back from each genius's own entry, which gives the same three columns. Checked against the ${counts.printed} rows that survive, the method recovers the divine name and the nation for ten and the name for eight.`,
    table(
      firstTable().map((row) => [
        String(row.no),
        row.name,
        row.nation,
        row.godName,
        row.source === "printed" ? "on the plate" : "reconstructed",
      ]),
      ["#", "Genius", "Peuple", "Name of God", "Source"],
    ),
  ].join("\n\n");

  const edition = notesToMarkdown(editionNotes(), "About this edition");
  const markdownPath = `${outDir}${MARKDOWN_PATH}`;
  if (!existsSync(dirname(markdownPath)))
    mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(
    markdownPath,
    `${MARKDOWN_HEADER}${edition ? `${edition}\n\n` : ""}${body.join("\n\n")}\n\n---\n\n${reconstruction}\n`,
  );

  const blocks = pages.flatMap((page) => page.blocks);
  const hebrew = JSON.stringify(blocks).match(/[\u0590-\u05ff]/g)?.length ?? 0;
  const unsure = pages.reduce((n, page) => n + page.uncertain.length, 0);
  console.log(
    `${pages.length} pages, ${pieces.length} pieces from ${blocks.length} blocks, ` +
      `${blocks.filter((b) => b.kind === "table").length} tables, ` +
      `${blocks.filter((b) => b.kind === "footnote").length} footnotes, ` +
      `${hebrew} Hebrew letters, ${unsure} reading notes.`,
  );
  console.log(`  ${markdownPath}`);
}

if (process.argv[1]?.endsWith("renderPages.ts")) main();
