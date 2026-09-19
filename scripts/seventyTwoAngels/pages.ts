import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ANGEL_COUNT } from "../../data/kabbalah/seventyTwoAngelsDerived";
import { findRegions, readSource } from "./source";

/**
 * The genii chapter as page images, rather than as the OCR of it.
 *
 * The OCR reads Lenain's Hebrew as scrambled Latin and his digits as letters,
 * and neither is recoverable from the text it produced. The scan behind it is
 * clean: at 200 dpi the Hebrew is plainly legible, "inclusivement" is plainly
 * "inclusivement", and the twenty-second's heading — which the OCR lost
 * entirely at a page break — is simply there on the page. See plan 031.
 *
 * The PDF is not in the repository: it is 3.9 MB of somebody else's scan of a
 * public-domain book, and the OCR sidecar in public/docs is what the site
 * ships. Point LENAIN_PDF at a copy to run this.
 */

export const PDF_PATH =
  process.env.LENAIN_PDF ??
  `${process.env.HOME}/Documents/Magick/Lenain - La Science Cabalistique (1823) - Google.pdf`;

const IMAGE_DIR = "output/seventyTwoAngelsPages";

/** 200 dpi renders the Hebrew legibly without spending tokens on paper grain. */
const DPI = 200;

/**
 * The sidecar is in page order and one page behind the PDF, which opens on a
 * cover the OCR did not count. Checked at both ends of the chapter: the first
 * genius is on PDF page 62, printed 46, and the seventy-second on 112,
 * printed 96.
 */
const SIDECAR_TO_PDF = 4;

/** Where the sidecar's own copy of the book stops and repeats itself. */
const FIRST_COPY_LINES = 6503;

/**
 * The PDF page each genius's entry opens on. findRegions knows the heading's
 * line; the page is how many of the sidecar's form feeds come before it.
 */
function headingPages(): Map<number, number> {
  const lines = readSource().slice(0, FIRST_COPY_LINES);
  const feedsBefore: number[] = [];
  let feeds = 0;
  for (const line of lines) {
    feedsBefore.push(feeds);
    if (line.includes("\f")) feeds++;
  }

  const pages = new Map<number, number>();
  for (const region of findRegions()) {
    if (!region.headingFound) continue;
    pages.set(region.no, feedsBefore[region.from] + 1 + SIDECAR_TO_PDF);
  }
  return pages;
}

export interface AngelPages {
  no: number;
  /** Inclusive PDF page numbers, 1-based, that the entry can be read from. */
  from: number;
  to: number;
}

/**
 * Which pages to read each genius from: its own opening page through the one
 * the next genius opens on, since two entries commonly share a page.
 */
export function angelPages(): AngelPages[] {
  const pages = headingPages();
  const openingOf = (no: number) => {
    for (let at = no; at >= 1; at--) {
      const page = pages.get(at);
      if (page !== undefined) return page;
    }
    throw new Error(`No page known for genius ${no}`);
  };
  const nextOpening = (no: number) => {
    for (let at = no + 1; at <= ANGEL_COUNT; at++) {
      const page = pages.get(at);
      if (page !== undefined) return page;
    }
    return openingOf(no) + 2;
  };

  return Array.from({ length: ANGEL_COUNT }, (_, i) => {
    const no = i + 1;
    return { no, from: openingOf(no), to: nextOpening(no) };
  });
}

/** Renders a page once and keeps it, since rendering is slower than reading. */
export function pageImage(page: number): Buffer {
  mkdirSync(IMAGE_DIR, { recursive: true });
  const path = join(IMAGE_DIR, `p-${String(page).padStart(3, "0")}.png`);
  if (!existsSync(path)) {
    if (!existsSync(PDF_PATH))
      throw new Error(
        `No scan at ${PDF_PATH}. Set LENAIN_PDF to a copy of the 1823 Google Books scan.`,
      );
    execFileSync("pdftoppm", [
      "-f",
      String(page),
      "-l",
      String(page),
      "-r",
      String(DPI),
      "-png",
      "-singlefile",
      PDF_PATH,
      path.replace(/\.png$/, ""),
    ]);
  }
  return readFileSync(path);
}
