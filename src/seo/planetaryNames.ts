import { setupI18n } from "@lingui/core";
import {
  KAMEA_PLANET_ENGLISH,
  KAMEA_SQUARE_LABELS,
  kameaPath,
  PLANETARY_NAME_SIGIL_ALT,
} from "@/app/astrology/kamea/kameaPlanets";
import {
  agrippaRoman,
  characterOf,
  type PlanetaryName,
  type PlanetaryNameRole,
  planetaryNamePath,
  planetaryNamesWithPages,
  planetOfName,
  readingOf,
  squareNumberOf,
  tracedSpelling,
} from "@/app/astrology/kamea/planetaryNames";
import {
  AGRIPPA_LEAF_PAGES,
  leafNumbers,
  WITNESS_ITEMS,
} from "@/app/astrology/kamea/witnesses";
import { messages as english } from "@/locales/en/messages.js";
import { GD_HALL_LICENCE } from "@/render/contracts/gdHall";
import {
  sigilRasterDefault,
  sigilWordCount,
} from "@/render/contracts/roseSigil";
import { archivePageUrl } from "@/sources/mirroredPages";
import { breadcrumbList, entityTrail } from "./Breadcrumbs";
import { CARD_ART_BOX, type CardArt } from "./cards";
import type { EntityPage } from "./entities";
import type { SocialImage } from "./pages";
import { SITE_ORGANIZATION, SITE_URL } from "./site";

/**
 * The planetary intelligences' and spirits' pages (plan 093, decision 8),
 * one per name with a sigil: their search copy, and the sigil's two static
 * files under each page, drawn at build time through the `kamea-sigil`
 * contract as the angels' sigils (plan 088, S4) and the kameas' squares
 * are. The files are the canonical, indexable copies; the image route
 * keeps its own out of the index (`indexed: false`).
 */

/** Each role as the English titles and descriptions name it. */
const ROLE_ENGLISH: Record<PlanetaryNameRole, string> = {
  divineName: "divine name",
  intelligence: "intelligence",
  intelligences: "intelligences",
  intelligenceOfIntelligences: "intelligence of intelligences",
  spirit: "spirit",
  spiritOfSpirits: "spirit of spirits",
};

/** "spirit of spirits" → "Spirit of Spirits", for a title. */
const titleCase = (words: string) =>
  words.replace(/\b(?!of\b)\w/g, (letter) => letter.toUpperCase());

/** Titles a search result shows in full, without the site's suffix. */
const MAX_TITLE = 48;

/** A search snippet's bounds, as the entity pages keep them. */
const MAX_DESCRIPTION = 160;

const AND = new Intl.ListFormat("en-GB", { type: "conjunction" });

/** A name's page's path; every name passed here has one. */
function pathOf(name: PlanetaryName): string {
  const path = planetaryNamePath(name);
  if (!path) throw new Error(`${name.id} has no page`);
  return path;
}

/** The text a name's sigil traces: 1533's, divided where we divide it. */
export function planetaryNameSigilText(name: PlanetaryName): string {
  const text = tracedSpelling(name);
  if (!text) throw new Error(`${name.id} has nothing to trace`);
  return text;
}

/**
 * A name's page for search: "Sigil of Agiel, Intelligence of Saturn",
 * or the sigil and the name alone where the rest would not fit; the
 * description leads with what the page is and adds its Hebrew, Agrippa's
 * own spelling where it differs, its number and his character, as many as
 * fit a snippet.
 */
export function planetaryNamePage(name: PlanetaryName): EntityPage {
  const roman = name.name.roman;
  const planet = KAMEA_PLANET_ENGLISH[planetOfName(name)];
  const role = ROLE_ENGLISH[name.role];
  const full = `Sigil of ${roman}, ${titleCase(role)} of ${titleCase(planet).replace(/^The /, "the ")}`;
  const title = full.length <= MAX_TITLE ? full : `Sigil of ${roman}`;
  const agrippa = readingOf(name, "agrippa1533");
  const lead = `The sigil of ${roman}, the ${role} of ${planet}, traced on its kamea`;
  const parts = [
    agrippa?.he && `its Hebrew ${agrippa.he}`,
    agrippaRoman(name) && `Agrippa's spelling ${agrippaRoman(name)}`,
    agrippa?.number !== undefined && `the number ${squareNumberOf(name)}`,
    characterOf(name, "agrippa1533") && "Agrippa's own character",
  ].filter((part): part is string => Boolean(part));
  let description = `${lead}.`;
  const kept: string[] = [];
  for (const part of parts) {
    const next = `${lead}, with ${AND.format([...kept, part])}.`;
    if (next.length > MAX_DESCRIPTION) continue;
    kept.push(part);
    description = next;
  }
  return { path: pathOf(name), title, description };
}

/** Every name's page, in the table's order. */
export const planetaryNamePages = (): EntityPage[] =>
  planetaryNamesWithPages().map(planetaryNamePage);

/** One of a name's static sigil files. */
export interface PlanetaryNameSigilFile {
  /** The file's name in the URL: `sigil-of-agiel.png`. */
  name: string;
  /** Its path on the site, under the name's page. */
  path: string;
  format: "png" | "svg";
  /** The PNG's pixels. The SVG states only its viewBox, so has none. */
  width?: number;
  height?: number;
}

/**
 * A name's two files: the PNG at the contract's raster default (a square
 * a word, side by side) and the SVG, named in the words a search uses.
 */
export function planetaryNameSigilFiles(name: PlanetaryName): {
  png: PlanetaryNameSigilFile & { width: number; height: number };
  svg: PlanetaryNameSigilFile;
} {
  const base = `sigil-of-${name.id}`;
  const file = (format: "png" | "svg") => ({
    name: `${base}.${format}`,
    path: `${pathOf(name)}/${base}.${format}`,
    format,
  });
  return {
    png: {
      ...file("png"),
      ...sigilRasterDefault(sigilWordCount(planetaryNameSigilText(name))),
    },
    svg: file("svg"),
  };
}

/** Every name's files, in the table's order, as the routes prerender them. */
export function allPlanetaryNameSigilFiles(): {
  name: PlanetaryName;
  file: PlanetaryNameSigilFile;
}[] {
  return planetaryNamesWithPages().flatMap((name) =>
    Object.values(planetaryNameSigilFiles(name)).map((file) => ({
      name,
      file,
    })),
  );
}

/**
 * The image request a file is drawn from: the planet and the traced text,
 * final letters at their ordinary values (the contract's default, decision
 * 3), and `fmt=png` for the PNG at the raster default.
 */
export function planetaryNameSigilQuery(
  name: PlanetaryName,
  file: PlanetaryNameSigilFile,
) {
  const query = new URLSearchParams({
    planet: planetOfName(name),
    text: planetaryNameSigilText(name),
  });
  if (file.format === "png") query.set("fmt", "png");
  return query;
}

export { PLANETARY_NAME_SIGIL_ALT };

// The English catalog, never activated: the caption must read exactly as
// the English page's alt text does.
const englishI18n = setupI18n({ locale: "en", messages: { en: english } });

/** The alt text in English, as the structured data's caption. */
export const planetaryNameSigilAlt = (name: PlanetaryName) =>
  englishI18n._(PLANETARY_NAME_SIGIL_ALT, {
    name: name.name.roman,
    hebrew: planetaryNameSigilText(name),
    square: englishI18n._(KAMEA_SQUARE_LABELS[planetOfName(name)]),
  });

/**
 * The sigil's PNG as a name page's second Open Graph image, after the
 * page's card, as the angels add theirs.
 */
export function planetaryNameSocialImage(name: PlanetaryName): SocialImage {
  const { png } = planetaryNameSigilFiles(name);
  return {
    url: png.path,
    width: png.width,
    height: png.height,
    alt: planetaryNameSigilAlt(name),
  };
}

/**
 * A name page's card art: the name's own sigil on its square, a square a
 * word in one row. Asked for by width, twice the art box's: by the box's
 * height a long name's row would be wider than any image the contract
 * draws (Malcha's five squares, 5,100 pixels at 1,020 high).
 */
export function planetaryNameCardArt(name: PlanetaryName): CardArt {
  return {
    kind: "diagram",
    slug: "kamea-sigil",
    query: new URLSearchParams({
      planet: planetOfName(name),
      text: planetaryNameSigilText(name),
      width: String(CARD_ART_BOX.width * 2),
    }).toString(),
    raster: "query",
  };
}

/** The card art of a page that is a name's, by its path; else undefined. */
export function planetaryNameCardArtAt(path: string): CardArt | undefined {
  const name = planetaryNamesWithPages().find(
    (row) => planetaryNamePath(row) === path,
  );
  return name && planetaryNameCardArt(name);
}

/**
 * Agrippa's *De occulta philosophia* (Cologne, 1533) at a leaf, as a book
 * an image is based on, saying what on the leaf it is based on.
 */
function agrippaLeaf(leaf: number, what: string) {
  const page = AGRIPPA_LEAF_PAGES[leaf];
  return {
    "@type": "Book",
    name: "De occulta philosophia libri tres",
    author: { "@type": "Person", name: "Heinrich Cornelius Agrippa" },
    publisher: { "@type": "Organization", name: "Johannes Soter" },
    datePublished: "1533",
    description: `book II, chapter 22, ${page ? `p. ${page}, ` : ""}archive.org leaf n${leaf} (${what})`,
    url: archivePageUrl({ item: WITNESS_ITEMS.agrippa1533, leaf }),
  } as const;
}

/**
 * Regardie's pages of the method of tracing a name on a kamea, as the
 * generator cites them: only the method is taken from them.
 */
const REGARDIE_METHOD = {
  "@type": "Book",
  name: "The Golden Dawn, vol. 4",
  author: { "@type": "Person", name: "Israel Regardie" },
  publisher: { "@type": "Organization", name: "Aries Press" },
  datePublished: "1940",
  description:
    "pp. 78–80, archive.org leaves n72–n74 (the method of tracing a name on a kamea)",
  url: archivePageUrl({ item: WITNESS_ITEMS.regardie1940, leaf: 72 }),
} as const;

/**
 * What a name's sigil is based on: Agrippa's leaf of the name (its letters
 * and number), his leaf of its character, and Regardie's method.
 */
export function planetaryNameSources(name: PlanetaryName) {
  const named = readingOf(name, "agrippa1533")?.leaf;
  const character = characterOf(name, "agrippa1533")?.leaf;
  return [
    ...(named
      ? [agrippaLeaf(leafNumbers(named)[0], `the name ${name.name.roman}`)]
      : []),
    ...(character
      ? [
          agrippaLeaf(
            leafNumbers(character)[0],
            `the character of ${name.name.roman}`,
          ),
        ]
      : []),
    REGARDIE_METHOD,
  ];
}

/**
 * A name page's structured data, one graph: the trail the page shows
 * (the site, Astrology, the kameas, the planet's kamea, the name), then an
 * `ImageObject` for the PNG and one for the SVG, each `contentUrl` exactly
 * the URL the page shows it at. The licence, credit and notice are those
 * the site states for every image a component draws, as the angels' and
 * the kameas' are.
 */
export function planetaryNameJsonLd(name: PlanetaryName) {
  const files = planetaryNameSigilFiles(name);
  const path = pathOf(name);
  const page = `${SITE_URL}${path}`;
  const planet = planetOfName(name);
  const L = GD_HALL_LICENCE;
  const text = planetaryNameSigilText(name);
  const image = (file: PlanetaryNameSigilFile, id: string) => ({
    "@type": "ImageObject",
    "@id": `${page}#sigil-${id}`,
    contentUrl: `${SITE_URL}${file.path}`,
    url: page,
    name: `Sigil of ${name.name.roman} (${text}) on the ${englishI18n._(KAMEA_SQUARE_LABELS[planet])}`,
    caption: planetaryNameSigilAlt(name),
    encodingFormat: file.format === "png" ? "image/png" : "image/svg+xml",
    ...(file.width && { width: file.width, height: file.height }),
    license: L.url,
    acquireLicensePage: L.acquireLicensePage,
    creator: SITE_ORGANIZATION,
    creditText: L.creditText,
    copyrightNotice: L.copyrightNotice,
    isBasedOn: planetaryNameSources(name),
  });
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbList(entityTrail(kameaPath(planet), name.name.roman, path)),
      {
        ...image(files.png, "png"),
        associatedMedia: { "@id": `${page}#sigil-svg` },
      },
      image(files.svg, "svg"),
    ],
  };
}
