import type { Angel } from "magick-data/kabbalah/seventyTwoAngels";
import { angelNameShared, angelSlug } from "@/lib/angelSlugs";
import {
  canonicalSigilText,
  sigilRasterDefault,
  sigilWordCount,
} from "@/render/contracts/roseSigil";

/*
 * The angels' Rose Cross sigil files (plan 088, S4) as a page links them:
 * their names, paths and sizes and the alt text's messages, with nothing
 * that draws, so that a client page (the 72 angels' list) can show them
 * without the structured data's catalogue. `angelSigils.ts` has the rest.
 */

/** Where an angel's page is. */
export const angelPath = (angel: Angel) =>
  `/kabbalah/angel/${angelSlug(angel.no)}`;

/**
 * The text an angel's sigil traces: the name as the site spells it
 * (`name.he`), as the contract keeps it. Every one of the 72 is plain rose
 * letters, so this never falls back; a test holds it so.
 */
export function angelSigilText(angel: Angel): string {
  const text = canonicalSigilText(angel.name.he ?? "");
  if (text === null)
    throw new Error(`angel ${angel.no} has no sigil text: ${angel.name.he}`);
  return text;
}

/**
 * The generator with an angel's name in it, encoded as the generator's own
 * example links encode theirs (`SigilsText.tsx`).
 */
export const angelSigilGeneratorHref = (angel: Angel) =>
  `/gd/sigils?text=${encodeURIComponent(angelSigilText(angel))}`;

/** One of an angel's static sigil files. */
export interface AngelSigilFile {
  /** The file's name in the URL: `vehuiah-rose-cross-sigil.png`. */
  name: string;
  /** Its path on the site, under the angel's page. */
  path: string;
  format: "png" | "svg";
  /** The PNG's pixels. The SVG states only its viewBox, so has none. */
  width?: number;
  height?: number;
}

/**
 * An angel's two files (plan 088, S4): the PNG at the contract's raster
 * default and the SVG, both on the Golden Dawn's rose with the rose shown.
 */
export function angelSigilFiles(angel: Angel): {
  png: AngelSigilFile & { width: number; height: number };
  svg: AngelSigilFile;
} {
  const base = `${angelSlug(angel.no)}-rose-cross-sigil`;
  const file = (format: "png" | "svg") => ({
    name: `${base}.${format}`,
    path: `${angelPath(angel)}/${base}.${format}`,
    format,
  });
  return {
    png: {
      ...file("png"),
      ...sigilRasterDefault(sigilWordCount(angelSigilText(angel))),
    },
    svg: file("svg"),
  };
}

/**
 * The sigil's alt text, in our own words, for Lingui: the page translates
 * it where it is shown, and the structured data's caption is its English.
 */
export const ANGEL_SIGIL_ALT =
  /*i18n*/ "The Rose Cross sigil of {name}, {hebrew}, traced on the Golden Dawn's rose of 22 letters";

/**
 * The alt text of a genius whose name another shares (the two Lauviahs,
 * whose names and so whose sigils are the same): with its number, as its
 * slug has it, so that the two images are not described word for word
 * alike.
 */
export const ANGEL_SIGIL_ALT_NUMBERED =
  /*i18n*/ "The Rose Cross sigil of {name}, angel {number} of the 72, {hebrew}, traced on the Golden Dawn's rose of 22 letters";

/** The alt text's message for an angel: numbered where the name is shared. */
export const angelSigilAltMessage = (angel: Angel) =>
  angelNameShared(angel.no) ? ANGEL_SIGIL_ALT_NUMBERED : ANGEL_SIGIL_ALT;
