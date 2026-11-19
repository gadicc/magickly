import angels, { type Angel } from "magick-data/kabbalah/seventyTwoAngels";
import { angelSlug } from "@/lib/angelSlugs";
import {
  canonicalSigilText,
  sigilRasterDefault,
  sigilWordCount,
} from "@/render/contracts/roseSigil";

/**
 * The 72 angels' Rose Cross sigils (plan 088, S4): two static files under
 * each angel's page, drawn at build time from the site's spelling of the
 * name on the Golden Dawn's rose, as the temple halls' files are drawn
 * (plan 062, decisions 3, 7, 10 and 13). The files are the canonical,
 * indexable copies; `/api/render/rose-sigil` keeps its own out of the index.
 */

/** Where an angel's page is. */
const angelPath = (angel: Angel) => `/kabbalah/angel/${angelSlug(angel.no)}`;

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

/** Every angel's files, in the angels' order, as the route prerenders them. */
export function allAngelSigilFiles(): {
  slug: string;
  angel: Angel;
  file: AngelSigilFile;
}[] {
  return angels.flatMap((angel) =>
    Object.values(angelSigilFiles(angel)).map((file) => ({
      slug: angelSlug(angel.no),
      angel,
      file,
    })),
  );
}

/**
 * The image request a file is drawn from: the name, the default rose
 * (`gd`) and the rose shown, which the contract leaves out of the query
 * as defaults, and `fmt=png` for the PNG at the raster default.
 */
export function angelSigilQuery(angel: Angel, file: AngelSigilFile) {
  const query = new URLSearchParams({ text: angelSigilText(angel) });
  if (file.format === "png") query.set("fmt", "png");
  return query;
}

/**
 * The sigil's alt text, in our own words, for Lingui: the page translates
 * it where it is shown.
 */
export const ANGEL_SIGIL_ALT =
  /*i18n*/ "The Rose Cross sigil of {name}, {hebrew}, traced on the Golden Dawn's rose of 22 letters";

/** The values the alt text names. */
export const angelSigilAltValues = (angel: Angel) => ({
  name: angel.name.en,
  hebrew: angelSigilText(angel),
});
