import { setupI18n } from "@lingui/core";
import {
  AGRIPPA_SQUARE_LEAVES,
  KAMEA_ALT,
  KAMEA_PLANETS,
  KAMEA_SQUARE_LABELS,
  type KameaConstants,
  type KameaPlanetId,
  kameaAltMessage,
  kameaConstants,
  kameaPath,
} from "@/app/astrology/kamea/kameaPlanets";
import { messages as english } from "@/locales/en/messages.js";
import { GD_HALL_LICENCE } from "@/render/contracts/gdHall";
import { archivePageUrl } from "@/sources/mirroredPages";
import type { SocialImage } from "./pages";
import { SITE_ORGANIZATION, SITE_URL } from "./site";

/**
 * The seven kameas' static images (plan 093, K4): a PNG and an SVG of each
 * bare square under its page, drawn at build time through the `kamea`
 * image contract, as the angels' sigils (plan 088, S4) and the temple
 * halls' drawings (plan 062, decisions 3, 7, 10 and 13) are. The files are
 * the canonical, indexable copies; `/api/render/kamea` keeps its own out of
 * the index (`indexed: false`).
 */

export { KAMEA_ALT, KAMEA_PLANETS, type KameaPlanetId };

/** The PNG's size: the `kamea` contract's raster default, square. */
export const KAMEA_PNG_SIZE = { width: 1024, height: 1024 } as const;

/**
 * The files' names, by planet, in the words a search uses: "kamea of
 * the sun", not "kamea of sol".
 */
const FILE_BASE: Record<KameaPlanetId, string> = {
  saturn: "kamea-of-saturn-magic-square",
  jupiter: "kamea-of-jupiter-magic-square",
  mars: "kamea-of-mars-magic-square",
  sol: "kamea-of-the-sun-magic-square",
  venus: "kamea-of-venus-magic-square",
  mercury: "kamea-of-mercury-magic-square",
  luna: "kamea-of-the-moon-magic-square",
};

/** One of a kamea's static files. */
export interface KameaFile {
  /** The file's name in the URL: `kamea-of-saturn-magic-square.png`. */
  name: string;
  /** Its path on the site, under the kamea's page. */
  path: string;
  format: "png" | "svg";
  /** The PNG's pixels. The SVG states only its viewBox, so has none. */
  width?: number;
  height?: number;
}

/** A kamea's two files: the PNG at the contract's default, and the SVG. */
export function kameaFiles(planet: KameaPlanetId): {
  png: KameaFile & { width: number; height: number };
  svg: KameaFile;
} {
  const base = FILE_BASE[planet];
  const file = (format: "png" | "svg") => ({
    name: `${base}.${format}`,
    path: `${kameaPath(planet)}/${base}.${format}`,
    format,
  });
  return { png: { ...file("png"), ...KAMEA_PNG_SIZE }, svg: file("svg") };
}

/** Every kamea's files, in the Chaldean order, as the route prerenders them. */
export function allKameaFiles(): {
  planet: KameaPlanetId;
  file: KameaFile;
}[] {
  return KAMEA_PLANETS.flatMap((planet) =>
    Object.values(kameaFiles(planet)).map((file) => ({ planet, file })),
  );
}

/**
 * The image request a file is drawn from: the planet, and `fmt=png` for
 * the PNG at the contract's raster default.
 */
export function kameaQuery(planet: KameaPlanetId, file: KameaFile) {
  const query = new URLSearchParams({ planet });
  if (file.format === "png") query.set("fmt", "png");
  return query;
}

/** The alt text's values, but for the square's name. */
export const kameaAltValues = (planet: KameaPlanetId): KameaConstants =>
  kameaConstants(planet);

// The English catalog, never activated: the caption must read exactly as
// the English page's alt text does.
const englishI18n = setupI18n({ locale: "en", messages: { en: english } });

/** The alt text in English, as the structured data's caption. */
export const kameaAlt = (planet: KameaPlanetId) =>
  englishI18n._(kameaAltMessage(planet), {
    square: englishI18n._(KAMEA_SQUARE_LABELS[planet]),
    ...kameaAltValues(planet),
  });

/**
 * The square's PNG as a kamea page's second Open Graph image, after the
 * page's card, as the angels and the temple halls add theirs.
 */
export function kameaSocialImage(planet: KameaPlanetId): SocialImage {
  const { png } = kameaFiles(planet);
  return {
    url: png.path,
    width: png.width,
    height: png.height,
    alt: kameaAlt(planet),
  };
}

/** Agrippa's *De occulta philosophia* (Cologne, 1533) on archive.org. */
const AGRIPPA_ITEM = "DeOccultaPhilosophiaLoc1533";

/**
 * Agrippa's leaf of a square, as the book it is based on: the work the
 * squares, their seals and their names come from (plan 093, "Pages").
 */
export function agrippaSquareBook(planet: KameaPlanetId) {
  const { leaf, page } = AGRIPPA_SQUARE_LEAVES[planet];
  return {
    "@type": "Book",
    name: "De occulta philosophia libri tres",
    author: { "@type": "Person", name: "Heinrich Cornelius Agrippa" },
    publisher: { "@type": "Organization", name: "Johannes Soter" },
    datePublished: "1533",
    description: `book II, chapter 22, p. ${page}, archive.org leaf n${leaf} (${englishI18n._(KAMEA_SQUARE_LABELS[planet])})`,
    url: archivePageUrl({ item: AGRIPPA_ITEM, leaf }),
  } as const;
}

/**
 * A kamea page's images as structured data: an `ImageObject` for the PNG
 * and one for the SVG, each `contentUrl` exactly the URL the page shows it
 * at, based on Agrippa's leaf of the square. The licence, credit and
 * notice are those the site states for every image a component draws (CC
 * BY 4.0, credited to Magick.ly, drawn by magick-components, MIT), as the
 * halls and the angels state them. The page's trail is its own script
 * (`PageBreadcrumbs`).
 */
export function kameaJsonLd(planet: KameaPlanetId) {
  const files = kameaFiles(planet);
  const page = `${SITE_URL}${kameaPath(planet)}`;
  const L = GD_HALL_LICENCE;
  const name = `${englishI18n._(KAMEA_SQUARE_LABELS[planet])}, magic square`;
  const image = (file: KameaFile, id: string) => ({
    "@type": "ImageObject",
    "@id": `${page}#square-${id}`,
    contentUrl: `${SITE_URL}${file.path}`,
    url: page,
    name,
    caption: kameaAlt(planet),
    encodingFormat: file.format === "png" ? "image/png" : "image/svg+xml",
    ...(file.width && { width: file.width, height: file.height }),
    license: L.url,
    acquireLicensePage: L.acquireLicensePage,
    creator: SITE_ORGANIZATION,
    creditText: L.creditText,
    copyrightNotice: L.copyrightNotice,
    isBasedOn: agrippaSquareBook(planet),
  });
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        ...image(files.png, "png"),
        associatedMedia: { "@id": `${page}#square-svg` },
      },
      image(files.svg, "svg"),
    ],
  };
}
