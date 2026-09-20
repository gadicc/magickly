import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import JSON5 from "json5";
import type { Note } from "./apparatus";
import { type BookPage, bookPages, pageLabel } from "./bookPage";
import { continuesParagraph, type PageBlock } from "./pageSchema";
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

/** A table as Markdown, padded to its widest row so the columns line up. */
function table(rows: string[][]) {
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (!width) return "";
  const cell = (value: string) => value.replace(/\|/g, "\\|").trim();
  const line = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cell(row[i] ?? "")).join(" | ")} |`;

  // Lenain's tables carry no header row, so the first row is left as data and
  // the rule sits above it.
  return [
    `|${" |".repeat(width)}`,
    `|${" --- |".repeat(width)}`,
    ...rows.map(line),
  ].join("\n");
}

function blockToMarkdown(block: PageBlock) {
  if (block.kind === "furniture") return "";
  if (block.kind === "table") return table(block.rows);
  if (block.kind === "heading") return `## ${block.text}`;
  // Lenain's own notes, set as he set them and marked as his. Our editorial
  // notes are a separate apparatus and must never be mistaken for these.
  if (block.kind === "footnote") {
    const marker = block.marker ? `**(${block.marker})** ` : "";
    return `> ${marker}${block.text.replace(/\n/g, "\n> ")}`;
  }
  return block.text;
}

/**
 * A paragraph the footnote rule or the page end cut across is one paragraph,
 * so its continuation is folded back into it rather than set as a new one.
 */
function fold(blocks: PageBlock[]) {
  const folded: PageBlock[] = [];
  for (const block of blocks) {
    const last = folded[folded.length - 1];
    if (
      last &&
      last.kind === block.kind &&
      continuesParagraph(last.text, block)
    ) {
      last.text = last.text.endsWith("-")
        ? last.text.slice(0, -1) + block.text
        : `${last.text} ${block.text}`;
      continue;
    }
    folded.push({ ...block });
  }
  return folded;
}

/**
 * Our notes, set apart from Lenain's own. His are blockquotes, as he printed
 * them; ours are a list under a heading that says whose they are, so a reader
 * can always tell 1823 from now. Keeping the two apparatus separate is the
 * whole point of having one.
 */
function notesToMarkdown(notes: Note[]) {
  if (!notes.length) return "";
  const lines = notes.map((note) => {
    const change = note.printed
      ? note.used
        ? `${note.printed} → ${note.used}`
        : `${note.printed}, kept as printed`
      : note.used;
    return `- **${note.field}**${change ? ` · ${change}` : ""} — ${note.why}`;
  });
  return `<small>\n\n**Editorial notes**\n\n${lines.join("\n")}\n\n</small>`;
}

function pageToMarkdown(page: BookPage, notes: Note[]) {
  const body = fold(page.blocks)
    .map(blockToMarkdown)
    .filter(Boolean)
    .join("\n\n");
  const apparatus = notesToMarkdown(notes);
  // The anchor is the permalink, and is in the data so that this file and the
  // routes cannot drift into naming the same leaf differently.
  const marker = `<small id="${page.page.anchor}">**[${pageLabel(page.page)}]**</small>`;
  return `---\n\n${marker}\n\n${body}${apparatus ? `\n\n${apparatus}` : ""}`;
}

/** Which notes belong to which printed page, by way of the genius they concern. */
function notesByPage(): Map<number, Note[]> {
  const notes: Note[] = JSON5.parse(
    readFileSync("data/kabbalah/lenain/apparatus.json5", "utf8"),
  );
  const pageOf = new Map(
    plateEntries().map((entry) => [entry.no, entry.printedPages[0]]),
  );

  const byPage = new Map<number, Note[]>();
  for (const note of notes) {
    // A note about the book at large belongs to no single page.
    const page = note.no === 0 ? undefined : pageOf.get(note.no);
    if (page === undefined) continue;
    byPage.set(page, [...(byPage.get(page) ?? []), note]);
  }
  return byPage;
}

function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out-dir");
  const outDir = outAt < 0 ? "" : `${args[outAt + 1]}/`;

  const pages = bookPages();
  const byPage = notesByPage();
  const markdownPath = `${outDir}${MARKDOWN_PATH}`;
  if (!existsSync(dirname(markdownPath)))
    mkdirSync(dirname(markdownPath), { recursive: true });

  writeFileSync(
    markdownPath,
    `${MARKDOWN_HEADER}${pages
      .map((page) => pageToMarkdown(page, byPage.get(page.page.number) ?? []))
      .join("\n\n")}\n`,
  );

  const blocks = pages.flatMap((page) => page.blocks);
  const hebrew = JSON.stringify(blocks).match(/[\u0590-\u05ff]/g)?.length ?? 0;
  console.log(
    `${pages.length} pages, ${blocks.length} blocks, ` +
      `${blocks.filter((b) => b.kind === "table").length} tables, ` +
      `${blocks.filter((b) => b.kind === "footnote").length} footnotes, ` +
      `${hebrew} Hebrew letters.`,
  );
  console.log(`  ${markdownPath}`);
}

if (process.argv[1]?.endsWith("renderPages.ts")) main();
