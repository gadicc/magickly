import "server-only";
// Not a module entry: magick-data publishes the file only as JSON data
// (its Sources row signed 23 November 2026, plan 096), so the app reads the
// workspace's build directly, as it reads the components' manifest.
import verses from "../../packages/magick-data/dist/kabbalah/lenain/vulgate/verses.js";

/**
 * One genius's verse as the Clementine Vulgate prints it (plan 096, Y0):
 * `packages/magick-data/src/kabbalah/lenain/vulgate/verses.json5`, whose
 * README gives the source and its hash.
 */
export interface LenainVulgateVerse {
  /** The genius's number, 1 to 72. */
  no: number;
  /** The reference as Lenain's entry gives it: "Psalm 3:3", "Genesis 1:1". */
  lenain: string;
  /** The reference in the Clementine's numbering. */
  vulgate: string;
  text: string;
  /** Hetzenauer's Clementine (Innsbruck 1914): archive.org leaf and page. */
  printed: { leaf: number; page: number };
}

/**
 * The 72 verses by the genius's number ("70" is Jabamiah's Genesis 1:1), as
 * the image inputs read them (`DATA_INPUT_TABLES.lenainVulgateVerse`).
 */
export const LENAIN_VULGATE_VERSES: Readonly<
  Record<string, LenainVulgateVerse>
> = Object.freeze(
  Object.fromEntries(
    (verses as readonly LenainVulgateVerse[]).map((verse) => [
      String(verse.no),
      verse,
    ]),
  ),
);
