import { setupI18n } from "@lingui/core";
import angels, { type Angel } from "magick-data/kabbalah/seventyTwoAngels";
import { angelNameShared, angelSlug } from "@/lib/angelSlugs";
import { messages as english } from "@/locales/en/messages.js";
import {
  ANGEL_SIGIL_STYLES,
  type AngelSigilStyle,
} from "@/render/contracts/angelSigil";
import { GD_HALL_LICENCE } from "@/render/contracts/gdHall";
import { citeUrl } from "@/sources/works";
import {
  ANGEL_SIGIL_STYLE_LABELS,
  type AngelSigilFile,
  angelPath,
  angelSigilEveryStyle,
  angelSigilStyleAltMessage,
  angelSigilStyleAltValues,
  angelSigilStyleFiles,
  angelSigilText,
} from "./angelSigilFiles";
import { breadcrumbList, entityTrail } from "./Breadcrumbs";
import type { SocialImage } from "./pages";
import { SITE_ORGANIZATION, SITE_URL } from "./site";

/**
 * The 72 angels' Rose Cross sigils (plan 088, S4), in four styles (plan
 * 096): a PNG and an SVG of each under each angel's page, the rose's and
 * the band's drawn at build time, as the temple halls' files are drawn
 * (plan 062, decisions 3, 7, 10 and 13), the bare and talisman files on
 * their first request. The files are the canonical, indexable copies;
 * `/api/render/` keeps its own out of the index. The files' names and
 * paths are in `angelSigilFiles.ts`, re-exported here.
 */

export {
  ANGEL_SIGIL_ALT,
  ANGEL_SIGIL_ALT_NUMBERED,
  ANGEL_SIGIL_STYLE_LABELS,
  type AngelSigilFile,
  type AngelSigilSection,
  angelSigilAltMessage,
  angelSigilEveryStyle,
  angelSigilFiles,
  angelSigilGeneratorHref,
  angelSigilSection,
  angelSigilStyleAltMessage,
  angelSigilStyleFiles,
  angelSigilText,
} from "./angelSigilFiles";

/**
 * When a style's files are drawn (plan 096, decision 3): the rose's and
 * the band's when the site is built, the bare and talisman files on their
 * first request, then kept.
 */
export const ANGEL_SIGIL_BUILT_STYLES: readonly AngelSigilStyle[] = [
  "rose",
  "band",
];

/** One of the files the angels' `[file]` route serves. */
export interface AngelSigilRouteFile {
  slug: string;
  angel: Angel;
  file: AngelSigilFile;
}

/**
 * Every style's files for every angel, in the angels' order and each
 * angel's in the styles' order, the band's PNG first (576): everything the
 * route serves, and what the angels' pages link and the sitemap lists
 * (plan 096, decision 4).
 */
export function allAngelSigilStyleFiles(): AngelSigilRouteFile[] {
  return angels.flatMap((angel) =>
    ANGEL_SIGIL_STYLES.flatMap((style) =>
      Object.values(angelSigilStyleFiles(angel, style)).map((file) => ({
        slug: angelSlug(angel.no),
        angel,
        file,
      })),
    ),
  );
}

let byPath: Map<string, AngelSigilRouteFile> | undefined;

/**
 * The file an angel's slug and file name name, or `undefined`: a lookup of
 * the 576, so nothing a request spells reaches a renderer first.
 */
export function angelSigilRouteFile(
  slug: string,
  name: string,
): AngelSigilRouteFile | undefined {
  byPath ??= new Map(
    allAngelSigilStyleFiles().map((entry) => [
      `${entry.slug}/${entry.file.name}`,
      entry,
    ]),
  );
  return byPath.get(`${slug}/${name}`);
}

/**
 * The image request a file is drawn from. The rose's: `rose-sigil` with the
 * name, the default rose (`gd`) and the rose shown, which the contract
 * leaves out of the query as defaults. Every other style's: `angel-sigil`
 * with the angel's slug and the style (the band, the default, left out).
 * `fmt=png` for the PNG at the raster default.
 */
export function angelSigilRequest(
  angel: Angel,
  file: AngelSigilFile,
): { slug: "rose-sigil" | "angel-sigil"; query: URLSearchParams } {
  const query =
    file.style === "rose"
      ? new URLSearchParams({ text: angelSigilText(angel) })
      : new URLSearchParams({ angel: angelSlug(angel.no) });
  if (file.style !== "rose" && file.style !== "band")
    query.set("style", file.style);
  if (file.format === "png") query.set("fmt", "png");
  return {
    slug: file.style === "rose" ? "rose-sigil" : "angel-sigil",
    query,
  };
}

// The English catalog, never activated: the captions must read exactly as
// the English page's alt texts do.
const englishI18n = setupI18n({ locale: "en", messages: { en: english } });

/** A style's alt text in English, as the structured data's caption. */
export const angelSigilStyleAlt = (
  angel: Angel,
  style: AngelSigilStyle,
): string =>
  englishI18n._(
    angelSigilStyleAltMessage(angel, style),
    angelSigilStyleAltValues(angel),
  );

/** The rose's alt text in English (plan 088, S4). */
export const angelSigilAlt = (angel: Angel) =>
  angelSigilStyleAlt(angel, "rose");

/**
 * The band's PNG as an angel page's second Open Graph image, after the
 * page's card, as the temple halls add theirs (plan 062, decision 11; plan
 * 096, decision 4).
 */
export function angelSigilSocialImage(angel: Angel): SocialImage {
  const { png } = angelSigilStyleFiles(angel, "band");
  return {
    url: png.path,
    width: png.width,
    height: png.height,
    alt: angelSigilStyleAlt(angel, "band"),
  };
}

const REGARDIE_4 = {
  "@type": "Book",
  name: "The Golden Dawn, vol. 4",
  author: { "@type": "Person", name: "Israel Regardie" },
  publisher: { "@type": "Organization", name: "Aries Press" },
  datePublished: "1940",
} as const;

/**
 * Regardie's page of the sigil rules, as the generator cites it and the
 * package's Provenance row names it: only the rules are taken from it.
 */
const REGARDIE_RULES = {
  ...REGARDIE_4,
  description: "p.57, archive.org leaf n51 (the rules of the Rose Cross sigil)",
  url: citeUrl("regardie1940", { leaf: 51 }),
} as const;

/** Regardie's page of the sigils of Metatron and Elohim, drawn alone. */
const REGARDIE_SIGILS = {
  ...REGARDIE_4,
  description:
    "p.58, archive.org leaf n52 (the sigils of Metatron and Elohim, each drawn alone with its name beneath)",
  url: citeUrl("regardie1940", { leaf: 52 }),
} as const;

const MATHERS = {
  "@type": "Book",
  name: "The Key of Solomon the King",
  author: { "@type": "Person", name: "S. Liddell MacGregor Mathers" },
  publisher: { "@type": "Organization", name: "George Redway" },
  datePublished: "1889",
  url: citeUrl("mathers1889", { leaf: 79 }),
} as const;

/** The pentacle with angels' names round its band. */
const MATHERS_FIG_18 = {
  ...MATHERS,
  description:
    "Plate IV, Fig. 18, archive.org leaf n79 (the First Pentacle of Jupiter, four angels' names round its band)",
} as const;

/** The pentacles with a verse round the band, one with names inside. */
const MATHERS_FIGS_20_21 = {
  ...MATHERS,
  description:
    "Plate IV, Figs. 20 and 21, archive.org leaf n79 (the Third and Fourth Pentacles of Jupiter, each with a verse round its band, the Fourth with angels' names inside)",
} as const;

/** Lenain's page on the verses written round the genii's talismans. */
const LENAIN_TALISMANS = {
  "@type": "Book",
  name: "La Science cabalistique",
  author: { "@type": "Person", name: "Lazare Lenain" },
  datePublished: "1823",
  inLanguage: "fr",
  description:
    "p.45 (the 72 verses written round the genii's talismans), Google Books qt9SAAAAcAAJ",
  url: citeUrl("lenain1823", { page: 45 }),
} as const;

/** What each style's drawing is based on (plan 096, decision 4). */
const BASED_ON: Record<
  AngelSigilStyle,
  readonly { "@type": string; url: string }[]
> = {
  band: [MATHERS_FIG_18, REGARDIE_RULES],
  bare: [REGARDIE_RULES, REGARDIE_SIGILS],
  rose: [REGARDIE_RULES],
  talisman: [LENAIN_TALISMANS, MATHERS_FIGS_20_21, REGARDIE_RULES],
};

/** Each style's works, the URLs its `isBasedOn` cites. */
export const angelSigilBasedOn = (style: AngelSigilStyle) =>
  BASED_ON[style].map((work) => work.url);

/**
 * An angel page's structured data, one graph: the trail the page shows
 * (which the page emitted on its own before the sigils), then an
 * `ImageObject` for each style's PNG and one for its SVG, the band's
 * first (plan 096, decision 4), each `contentUrl` exactly the URL the page
 * links it at and each caption its alt text. The licence, credit and
 * notice are those the site states for every image a component draws (the
 * About page's licence, as the temple halls state it): CC BY 4.0,
 * credited to Magick.ly, drawn by magick-components (MIT).
 */
export function angelJsonLd(angel: Angel) {
  const page = `${SITE_URL}${angelPath(angel)}`;
  const L = GD_HALL_LICENCE;
  const named = `Rose Cross sigil of ${angel.name.en}${angelNameShared(angel.no) ? `, angel ${angel.no}` : ""} (${angelSigilText(angel)})`;
  const image = (file: AngelSigilFile) => {
    const basedOn = BASED_ON[file.style];
    return {
      "@type": "ImageObject",
      "@id": `${page}#sigil-${file.style}-${file.format}`,
      contentUrl: `${SITE_URL}${file.path}`,
      url: page,
      name: `${named}, ${englishI18n._(ANGEL_SIGIL_STYLE_LABELS[file.style]).toLowerCase()}`,
      caption: angelSigilStyleAlt(angel, file.style),
      encodingFormat: file.format === "png" ? "image/png" : "image/svg+xml",
      ...(file.width && { width: file.width, height: file.height }),
      license: L.url,
      acquireLicensePage: L.acquireLicensePage,
      creator: SITE_ORGANIZATION,
      creditText: L.creditText,
      copyrightNotice: L.copyrightNotice,
      isBasedOn: basedOn.length === 1 ? basedOn[0] : basedOn,
    };
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbList(
        entityTrail("/kabbalah/yhvh/72angels", angel.name.en, angelPath(angel)),
      ),
      ...angelSigilEveryStyle(angel).flatMap(({ png, svg }) => [
        {
          ...image(png),
          associatedMedia: { "@id": `${page}#sigil-${svg.style}-svg` },
        },
        image(svg),
      ]),
    ],
  };
}
