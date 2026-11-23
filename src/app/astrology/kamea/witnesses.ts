import {
  PLANETARY_NAME_WITNESSES,
  type PlanetaryNameReading,
  type PlanetaryNameWitness,
} from "magick-data/astrology/planetaryNames";
import {
  archivePageUrl,
  MIRRORED_PAGES,
  type MirroredPageKey,
} from "@/sources/mirroredPages";
import { WORKS } from "@/sources/works";

/**
 * The witnesses to the planetary names and squares (plan 093, Sources), and
 * links to the leaves their readings are on: archive.org's page view, or,
 * for a leaf the site mirrors, our copy in the lightbox. Shared by the
 * kamea pages and the names' pages.
 */

export { PLANETARY_NAME_WITNESSES, type PlanetaryNameWitness };

/** Each witness as a table or a list labels it: "Agrippa 1533". */
export const WITNESS_LABELS: Record<PlanetaryNameWitness, string> = {
  agrippa1533: /*i18n*/ "Agrippa 1533",
  agrippa1651: /*i18n*/ "Agrippa 1651",
  barrett1801: /*i18n*/ "Barrett 1801",
  crowley777: /*i18n*/ "777",
  regardie1940: /*i18n*/ "Regardie 1940",
};

/**
 * The archive.org item each witness's `leaf` is in, unless a reading names
 * another copy in its `item` (planetaryNames.json5's header): the Library
 * of Congress's 1533, the Wellcome's 1651 and Barrett, Celephaïs Press's
 * e-text of *777 Revised*, and Regardie's vol. 4.
 */
export const WITNESS_ITEMS: Record<PlanetaryNameWitness, string> = {
  agrippa1533: WORKS.agrippa1533.scan.item,
  agrippa1651: WORKS.agrippa1651.scan.item,
  barrett1801: WORKS.barrett1801.scan.item,
  crowley777: WORKS.crowley777.scan.item,
  regardie1940: WORKS.regardie1940.scan.item,
};

/**
 * The pages of Agrippa's 1533 chapter (book II, chapter 22) by archive.org
 * leaf, as printed at the head of each: the chapter opens on n160, the
 * names are on n163 and n164, the squares and characters on n164 to n168.
 * Read off the leaves, 21 November 2026.
 */
export const AGRIPPA_LEAF_PAGES: Readonly<Record<number, string>> = {
  160: "CXLV",
  161: "CXLVI",
  162: "CXLVII",
  163: "CXLVIII",
  164: "CXLIX",
  165: "CL",
  166: "CLI",
  167: "CLII",
  168: "CLIII",
};

/** The other copy of 1651 some readings were made in (`item`). */
export const EEBO_1651 =
  "bim_early-english-books-1641-1700_three-books-of-occult-ph_agrippa-henricus-cornel_1651";

/**
 * The leaves a reading's `leaf` names, as numbers: "n163" is [163], and a
 * reading across two, "n181–n182", is [181, 182]. Anything else is an
 * error, so that a malformed leaf in the data fails a test rather than a
 * link.
 */
export function leafNumbers(leaf: string): number[] {
  const match = /^n(\d+)(?:–n(\d+))?$/.exec(leaf);
  if (!match) throw new Error(`Not a leaf: ${JSON.stringify(leaf)}`);
  const first = Number(match[1]);
  const last = match[2] === undefined ? first : Number(match[2]);
  if (last < first) throw new Error(`Leaves out of order: ${leaf}`);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/** One leaf of a scan, linked: archive.org's view, and our mirror if any. */
export interface LeafRef {
  /** The archive.org item. */
  item: string;
  /** The leaf, archive.org's `n…`. */
  leaf: number;
  /** archive.org's single-page view of the leaf. */
  href: string;
  /**
   * The mirrored page of the leaf, which a link opens in the lightbox, and
   * the region of it the link cites, where the page has one by that name.
   */
  mirror?: { page: MirroredPageKey; region?: string };
}

/** The mirrored page of a leaf of an archive.org item, if the site has one. */
export function mirroredLeaf(
  item: string,
  leaf: number,
): MirroredPageKey | undefined {
  return (Object.keys(MIRRORED_PAGES) as MirroredPageKey[]).find((key) => {
    const { scan } = MIRRORED_PAGES[key];
    return (
      scan.site === "archive.org" && scan.item === item && scan.leaf === leaf
    );
  });
}

/**
 * A leaf of an item as a `LeafRef`. `region` names the passage cited where
 * the leaf is mirrored and its page has a region of that name (a planet's
 * names on Agrippa's leaves are keyed by the planet); otherwise the
 * mirror's own outline stands.
 */
export function leafRef(item: string, leaf: number, region?: string): LeafRef {
  const page = mirroredLeaf(item, leaf);
  const regions = page
    ? (MIRRORED_PAGES[page] as { regions?: Record<string, unknown> }).regions
    : undefined;
  return {
    item,
    leaf,
    href: archivePageUrl({ item, leaf }),
    ...(page && {
      mirror: {
        page,
        ...(region && regions && Object.hasOwn(regions, region)
          ? { region }
          : {}),
      },
    }),
  };
}

/**
 * The leaves a witness's reading of a name is on, each linked: in the
 * reading's own `item` where it names one (1651's EEBO copy), otherwise in
 * the witness's. `region`, a planet's id, outlines that planet's names
 * where the leaf is one of Agrippa's mirrored names leaves.
 */
export function readingLeaves(
  witness: PlanetaryNameWitness,
  reading: Pick<PlanetaryNameReading, "leaf" | "item">,
  region?: string,
): LeafRef[] {
  if (!reading.leaf) return [];
  const item = reading.item ?? WITNESS_ITEMS[witness];
  return leafNumbers(reading.leaf).map((leaf) => leafRef(item, leaf, region));
}
