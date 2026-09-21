import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
 * public-domain book. Point LENAIN_PDF at a copy to run this.
 *
 * The OCR sidecar this once read is gone with plan 033. It was needed to find
 * which leaf each genius opened on before anything had been transcribed; the
 * committed volume answers that now, and the sidecar's last readers —
 * headingPages and angelPages — went with it.
 */

export const PDF_PATH =
  process.env.LENAIN_PDF ??
  `${process.env.HOME}/Documents/Magick/Lenain - La Science Cabalistique (1823) - Google.pdf`;

const IMAGE_DIR = "output/seventyTwoAngelsPages";

/** 200 dpi renders the Hebrew legibly without spending tokens on paper grain. */
const DPI = 200;

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
