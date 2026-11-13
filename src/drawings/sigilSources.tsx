import type { PlanetarySpiritId } from "magick-components/astrology/planetarySpirits";

/**
 * The public-domain printings our redrawn sigils follow, as links to the
 * leaf of each scan on archive.org (plan 080, "The sigils' sources"). The
 * package's JSDoc cites the same pages and leaves; `sigilSources.test`
 * holds the two to each other. A leaf is archive.org's page index, the
 * `n…` of its page URLs.
 */

/** archive.org's single-page view of one leaf of an item, or of a file in it. */
const leafUrl = (item: string, leaf: number, file?: string) =>
  `https://archive.org/details/${item}${
    file ? `/${encodeURIComponent(file)}` : ""
  }/page/n${leaf}/mode/1up`;

/**
 * John Heydon, *Theomagia, or The Temple of Wisdome*, vol. 1 (London,
 * 1663/4), book I, chapter 5, the table of the figures' Rulers and Genii:
 * the Getty Research Institute's copy, `theomagiaortempl00heyd`.
 */
export const HEYDON_PAGES = {
  13: { leaf: 124, url: leafUrl("theomagiaortempl00heyd", 124) },
  15: { leaf: 126, url: leafUrl("theomagiaortempl00heyd", 126) },
} as const;

/** A page of Heydon's with Rulers' sigils on it. */
export type HeydonPage = keyof typeof HEYDON_PAGES;

/**
 * The page of Heydon's each Ruler's sigil is drawn after. Sorath's is on
 * both; the drawing cites p. 13 first.
 */
export const RULER_SIGIL_PAGE: Readonly<Record<PlanetarySpiritId, HeydonPage>> =
  {
    bartzabel: 13,
    kedemel: 13,
    taphthartharath: 13,
    chasmodai: 13,
    sorath: 13,
    hismael: 15,
    zazel: 15,
  };

/** The Heydon page a spirit's sigil is drawn after; none for another id. */
export const rulerSigilPage = (spiritId: string): HeydonPage | undefined =>
  Object.hasOwn(RULER_SIGIL_PAGE, spiritId)
    ? RULER_SIGIL_PAGE[spiritId as PlanetarySpiritId]
    : undefined;

/** "Heydon, Theomagia (1663/4), p. 13", for a link's accessible name. */
export const heydonLabel = (page: HeydonPage) =>
  `Heydon, Theomagia (1663/4), p. ${page}`;

/** The same, as a link's text: the title is a `<cite>`. */
export function HeydonCitation({ page }: { page: HeydonPage }) {
  return (
    <>
      Heydon, <cite>Theomagia</cite> (1663/4), p. {page}
    </>
  );
}

/**
 * *The Equinox* I(7) (London, 1912), "Liber Chanokh", Plate X, which has
 * the four Watchtowers' sigils: archive.org `crowley-equinox_202110`, the
 * file "The Equinox Vol. 1, No. 7". Our Equinox sigils are drawn after it,
 * and so is the form of the Air sigil in Regardie's colours.
 */
export const PLATE_X = {
  leaf: 256,
  url: leafUrl("crowley-equinox_202110", 256, "The Equinox Vol. 1, No. 7"),
} as const;

/** "The Equinox I(7) (1912), Plate X", for a link's accessible name. */
export const PLATE_X_LABEL = "The Equinox I(7) (1912), Plate X";

/** The same, as a link's text. */
export function PlateXCitation() {
  return (
    <>
      <cite>The Equinox</cite> I(7) (1912), Plate X
    </>
  );
}
