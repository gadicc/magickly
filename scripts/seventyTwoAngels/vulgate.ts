import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSON5 from "json5";

/**
 * The Vulgate's text of the verse Lenain prescribes for each of the 72
 * genii: seventy-one psalm verses and, for the seventieth, Genesis 1:1
 * (plan 096, stage Y0). The edition's `psalm.la` is held to it by
 * packages/magick-data/src/kabbalah/lenainVulgate.test.ts.
 *
 * The text is the Clementine Vulgate Project's, which is public domain.
 * The two files it is read from are not committed: this checks each one's
 * SHA-256 before reading it, and refuses any other bytes.
 * packages/magick-data/src/kabbalah/lenain/vulgate/README.md says where
 * that exact pair can be had.
 *
 *   node --import tsx scripts/seventyTwoAngels/vulgate.ts <dir>
 *
 * where <dir> holds `Ps.lat` and `Gn.lat`.
 */

export const OUT_PATH =
  "packages/magick-data/src/kabbalah/lenain/vulgate/verses.json5";

/** The Clementine Vulgate Project's books, as the pinned copy has them. */
export const SOURCE = {
  /** A copy of the project's text at a fixed commit (README.md says why). */
  commit: "38292f3f91e874d3db9e7e9bf7abd23da3217054",
  base: "https://raw.githubusercontent.com/jrichter/ClementineVulgateConverter/38292f3f91e874d3db9e7e9bf7abd23da3217054/latin/",
  files: {
    "Ps.lat": {
      bytes: 226_066,
      sha256:
        "dab1b3944436c35ff8dcddc158ff696b368cdb4d69f3ae223381dff3ce270896",
    },
    "Gn.lat": {
      bytes: 177_021,
      sha256:
        "c7cf051ef00775f409fbeaa0d2d641a302362308e2697cd02e8355a01b8e8881",
    },
  },
} as const;

export type SourceFile = keyof typeof SOURCE.files;

/** Hetzenauer's Clementine (Innsbruck, 1914) on archive.org, for the page links. */
export const PRINTED = {
  item: "biblia_sacra_vulgatae_etitionis_1914",
  title: "Biblia sacra vulgatae editionis, ed. M. Hetzenauer (Innsbruck, 1914)",
} as const;

/**
 * Where each genius's verse is in the Vulgate, and on which leaf of
 * Hetzenauer's edition. Found on 23 November 2026 (plan 096, Y0) by
 * matching each `psalm.la` against every verse of the Clementine Psalter,
 * and every verse with the next, and confirmed by hand where Lenain's
 * reference differs. The leaves were found by searching archive.org's
 * OCR of the edition and checked against the psalm and verse numbers in
 * each page's running head (`17, 47 – 19, 10`).
 */
export const REFERENCES: Record<
  number,
  {
    book: "Ps" | "Gn";
    chapter: number;
    verses: readonly [number] | readonly [number, number];
    leaf: number;
    page: number;
  }
> = {
  1: { book: "Ps", chapter: 3, verses: [4], leaf: 509, page: 487 },
  2: { book: "Ps", chapter: 21, verses: [20], leaf: 519, page: 497 },
  3: { book: "Ps", chapter: 90, verses: [2], leaf: 557, page: 535 },
  4: { book: "Ps", chapter: 6, verses: [5], leaf: 510, page: 488 },
  5: { book: "Ps", chapter: 33, verses: [5], leaf: 524, page: 502 },
  6: { book: "Ps", chapter: 9, verses: [12], leaf: 511, page: 489 },
  7: { book: "Ps", chapter: 102, verses: [8], leaf: 562, page: 540 },
  8: { book: "Ps", chapter: 94, verses: [6], leaf: 559, page: 537 },
  9: { book: "Ps", chapter: 24, verses: [6], leaf: 520, page: 498 },
  10: { book: "Ps", chapter: 32, verses: [22], leaf: 524, page: 502 },
  11: { book: "Ps", chapter: 17, verses: [47], leaf: 517, page: 495 },
  12: { book: "Ps", chapter: 9, verses: [22], leaf: 512, page: 490 },
  13: { book: "Ps", chapter: 97, verses: [4], leaf: 560, page: 538 },
  14: { book: "Ps", chapter: 9, verses: [10], leaf: 511, page: 489 },
  15: { book: "Ps", chapter: 93, verses: [22], leaf: 559, page: 537 },
  16: { book: "Ps", chapter: 87, verses: [2], leaf: 554, page: 532 },
  17: { book: "Ps", chapter: 8, verses: [2], leaf: 511, page: 489 },
  18: { book: "Ps", chapter: 7, verses: [9], leaf: 510, page: 488 },
  19: { book: "Ps", chapter: 39, verses: [2], leaf: 529, page: 507 },
  20: { book: "Ps", chapter: 119, verses: [2], leaf: 576, page: 554 },
  21: { book: "Ps", chapter: 30, verses: [15, 16], leaf: 523, page: 501 },
  22: { book: "Ps", chapter: 120, verses: [5], leaf: 576, page: 554 },
  23: { book: "Ps", chapter: 120, verses: [8], leaf: 576, page: 554 },
  24: { book: "Ps", chapter: 32, verses: [18], leaf: 524, page: 502 },
  25: { book: "Ps", chapter: 9, verses: [2], leaf: 511, page: 489 },
  26: { book: "Ps", chapter: 118, verses: [145], leaf: 575, page: 553 },
  27: { book: "Ps", chapter: 139, verses: [2], leaf: 582, page: 560 },
  28: { book: "Ps", chapter: 70, verses: [12], leaf: 544, page: 522 },
  29: { book: "Ps", chapter: 53, verses: [6], leaf: 536, page: 514 },
  30: { book: "Ps", chapter: 70, verses: [5], leaf: 544, page: 522 },
  31: { book: "Ps", chapter: 70, verses: [15, 16], leaf: 545, page: 523 },
  32: { book: "Ps", chapter: 32, verses: [4], leaf: 524, page: 502 },
  33: { book: "Ps", chapter: 93, verses: [11], leaf: 558, page: 536 },
  34: { book: "Ps", chapter: 130, verses: [3], leaf: 579, page: 557 },
  35: { book: "Ps", chapter: 114, verses: [1], leaf: 570, page: 548 },
  36: { book: "Ps", chapter: 25, verses: [8], leaf: 520, page: 498 },
  37: { book: "Ps", chapter: 79, verses: [8], leaf: 551, page: 529 },
  38: { book: "Ps", chapter: 90, verses: [9], leaf: 557, page: 535 },
  39: { book: "Ps", chapter: 29, verses: [11], leaf: 522, page: 500 },
  40: { book: "Ps", chapter: 87, verses: [15], leaf: 555, page: 533 },
  41: { book: "Ps", chapter: 119, verses: [2], leaf: 576, page: 554 },
  42: { book: "Ps", chapter: 120, verses: [7], leaf: 576, page: 554 },
  43: { book: "Ps", chapter: 87, verses: [14], leaf: 555, page: 533 },
  44: { book: "Ps", chapter: 118, verses: [108], leaf: 574, page: 552 },
  45: { book: "Ps", chapter: 93, verses: [18], leaf: 559, page: 537 },
  46: { book: "Ps", chapter: 144, verses: [9], leaf: 585, page: 563 },
  47: { book: "Ps", chapter: 103, verses: [24], leaf: 563, page: 541 },
  48: { book: "Ps", chapter: 97, verses: [2], leaf: 560, page: 538 },
  49: { book: "Ps", chapter: 144, verses: [3], leaf: 585, page: 563 },
  50: { book: "Ps", chapter: 102, verses: [8], leaf: 562, page: 540 },
  51: { book: "Ps", chapter: 103, verses: [31], leaf: 563, page: 541 },
  52: { book: "Ps", chapter: 7, verses: [18], leaf: 511, page: 489 },
  53: { book: "Ps", chapter: 118, verses: [75], leaf: 574, page: 552 },
  54: { book: "Ps", chapter: 102, verses: [19], leaf: 562, page: 540 },
  55: { book: "Ps", chapter: 101, verses: [13], leaf: 562, page: 540 },
  56: { book: "Ps", chapter: 144, verses: [14], leaf: 585, page: 563 },
  57: { book: "Ps", chapter: 113, verses: [19], leaf: 570, page: 548 },
  58: { book: "Ps", chapter: 6, verses: [4], leaf: 510, page: 488 },
  59: { book: "Ps", chapter: 112, verses: [3], leaf: 569, page: 547 },
  60: { book: "Ps", chapter: 144, verses: [17], leaf: 585, page: 563 },
  61: { book: "Ps", chapter: 112, verses: [2], leaf: 569, page: 547 },
  62: { book: "Ps", chapter: 118, verses: [159], leaf: 576, page: 554 },
  63: { book: "Ps", chapter: 2, verses: [11], leaf: 508, page: 486 },
  64: { book: "Ps", chapter: 32, verses: [18], leaf: 524, page: 502 },
  65: { book: "Ps", chapter: 89, verses: [13], leaf: 557, page: 535 },
  66: { book: "Ps", chapter: 37, verses: [22], leaf: 528, page: 506 },
  67: { book: "Ps", chapter: 36, verses: [4], leaf: 526, page: 504 },
  68: { book: "Ps", chapter: 105, verses: [1], leaf: 565, page: 543 },
  69: { book: "Ps", chapter: 15, verses: [5], leaf: 514, page: 492 },
  70: { book: "Gn", chapter: 1, verses: [1], leaf: 23, page: 1 },
  71: { book: "Ps", chapter: 108, verses: [30], leaf: 568, page: 546 },
  72: { book: "Ps", chapter: 114, verses: [7], leaf: 570, page: 548 },
};

/** Throws unless `bytes` is the pinned file, byte for byte. */
export function verifySource(name: SourceFile, bytes: Buffer): void {
  const pin = SOURCE.files[name];
  if (bytes.length !== pin.bytes)
    throw new Error(
      `${name}: ${bytes.length} bytes, not the pinned ${pin.bytes}; download ${SOURCE.base}${name}`,
    );
  const found = createHash("sha256").update(bytes).digest("hex");
  if (found !== pin.sha256)
    throw new Error(
      `${name}: SHA-256 ${found}, not the pinned ${pin.sha256}; refusing it`,
    );
}

/**
 * A book's verses by "chapter:verse", from the project's plain-text
 * markup (code page 1252, one verse a line, "3:4 text"), with the markup
 * taken out: the slashes that end lines of verse, the brackets round a
 * passage set as verse and the backslashes that mark paragraphs. Its
 * spelling, capitals and punctuation, spaces before `: ; ? !` included,
 * are kept.
 */
export function parseBook(bytes: Buffer): Map<string, string> {
  const text = new TextDecoder("windows-1252").decode(bytes);
  const verses = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(\d+):(\d+) (.*)$/);
    if (!match) continue;
    const [, chapter, verse, body] = match;
    verses.set(
      `${chapter}:${verse}`,
      body
        .replace(/[[\]\\]/g, " ")
        .replace(/\//g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return verses;
}

/** One genius's verse, as the committed file records it. */
export interface VulgateVerse {
  no: number;
  /** Lenain's reference, as the entry gives it. */
  lenain: string;
  /** The Vulgate's, in the Clementine numbering. */
  vulgate: string;
  /** The Clementine Vulgate Project's text of it. */
  text: string;
  /** The leaf and printed page of Hetzenauer's edition that has it. */
  printed: { leaf: number; page: number };
}

const BOOK_NAMES = { Ps: "Psalm", Gn: "Genesis" } as const;

function referenceOf({ book, chapter, verses }: (typeof REFERENCES)[number]) {
  return `${BOOK_NAMES[book]} ${chapter}:${verses.join("–")}`;
}

/** The 72 verses, from the two books and the edition's own references. */
export function buildVerses(
  books: Record<"Ps" | "Gn", Map<string, string>>,
  angels: { no: number; psalm: { psalm: number; verse: number } }[],
): VulgateVerse[] {
  return angels.map((angel) => {
    const ref = REFERENCES[angel.no];
    if (!ref) throw new Error(`Genius ${angel.no}: no reference`);
    const text = ref.verses
      .map((verse) => {
        const found = books[ref.book].get(`${ref.chapter}:${verse}`);
        if (!found)
          throw new Error(
            `Genius ${angel.no}: ${ref.book} ${ref.chapter}:${verse} not found`,
          );
        return found;
      })
      .join(" ");
    return {
      no: angel.no,
      // The seventieth's entry has no psalm: it prescribes "le 1er verset
      // de la Genèse", which it gives only in French.
      lenain:
        angel.psalm.psalm === 0
          ? "Genesis 1:1"
          : `Psalm ${angel.psalm.psalm}:${angel.psalm.verse}`,
      vulgate: referenceOf(ref),
      text,
      printed: { leaf: ref.leaf, page: ref.page },
    };
  });
}

const HEADER = `// The Vulgate's text of the verse Lenain prescribes for each genius:
// seventy-one psalm verses and, for the seventieth, Genesis 1:1 (plan 096,
// stage Y0). Generated by scripts/seventyTwoAngels/vulgate.ts from the
// Clementine Vulgate Project's text, which is public domain, checked by
// SHA-256; README.md beside this file gives the source and what was
// changed. \`lenain\` is the reference as his entry gives it, \`vulgate\` the
// Clementine numbering, which often differs by a verse; \`printed\` is the
// archive.org leaf and printed page of Hetzenauer's Clementine (Innsbruck,
// 1914), https://archive.org/details/${PRINTED.item}/page/n<leaf>.
// Do not hand-edit: run the script.
`;

function main() {
  const dir = process.argv[2];
  if (!dir)
    throw new Error("usage: vulgate.ts <dir holding Ps.lat and Gn.lat>");
  const read = (name: SourceFile) => {
    const bytes = readFileSync(join(dir, name));
    verifySource(name, bytes);
    return parseBook(bytes);
  };
  const angels = JSON5.parse(
    readFileSync(
      "packages/magick-data/src/kabbalah/seventyTwoAngels.json5",
      "utf8",
    ),
  );
  const verses = buildVerses(
    { Ps: read("Ps.lat"), Gn: read("Gn.lat") },
    angels,
  );
  writeFileSync(OUT_PATH, `${HEADER}${JSON5.stringify(verses, null, 2)}\n`);
  console.log(`${verses.length} verses\n  ${OUT_PATH}`);
}

if (process.argv[1]?.endsWith("vulgate.ts")) main();
