import { setupI18n } from "@lingui/core";
import angels, { type Angel } from "magick-data/kabbalah/seventyTwoAngels";
import { angelNameShared, angelSlug } from "@/lib/angelSlugs";
import { messages as english } from "@/locales/en/messages.js";
import { GD_HALL_LICENCE } from "@/render/contracts/gdHall";
import { citeUrl } from "@/sources/works";
import {
  type AngelSigilFile,
  angelPath,
  angelSigilAltMessage,
  angelSigilFiles,
  angelSigilText,
} from "./angelSigilFiles";
import { breadcrumbList, entityTrail } from "./Breadcrumbs";
import type { SocialImage } from "./pages";
import { SITE_ORGANIZATION, SITE_URL } from "./site";

/**
 * The 72 angels' Rose Cross sigils (plan 088, S4): two static files under
 * each angel's page, drawn at build time from the site's spelling of the
 * name on the Golden Dawn's rose, as the temple halls' files are drawn
 * (plan 062, decisions 3, 7, 10 and 13). The files are the canonical,
 * indexable copies; `/api/render/rose-sigil` keeps its own out of the index.
 * The files' names and paths are in `angelSigilFiles.ts`, re-exported here.
 */

export {
  ANGEL_SIGIL_ALT,
  ANGEL_SIGIL_ALT_NUMBERED,
  type AngelSigilFile,
  angelSigilAltMessage,
  angelSigilFiles,
  angelSigilGeneratorHref,
  angelSigilText,
} from "./angelSigilFiles";

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

/** The values the alt text names. */
export const angelSigilAltValues = (angel: Angel) => ({
  name: angel.name.en,
  number: angel.no,
  hebrew: angelSigilText(angel),
});

// The English catalog, never activated: the caption must read exactly as
// the English page's alt text does.
const englishI18n = setupI18n({ locale: "en", messages: { en: english } });

/** The alt text in English, as the structured data's caption. */
export const angelSigilAlt = (angel: Angel) =>
  englishI18n._(angelSigilAltMessage(angel), angelSigilAltValues(angel));

/**
 * The sigil's PNG as an angel page's second Open Graph image, after the
 * page's card, as the temple halls add theirs (plan 062, decision 11).
 */
export function angelSigilSocialImage(angel: Angel): SocialImage {
  const { png } = angelSigilFiles(angel);
  return {
    url: png.path,
    width: png.width,
    height: png.height,
    alt: angelSigilAlt(angel),
  };
}

/**
 * Regardie's page of the sigil rules, as the generator cites it and the
 * package's Provenance row names it: only the rules are taken from it.
 */
const REGARDIE_RULES = {
  "@type": "Book",
  name: "The Golden Dawn, vol. 4",
  author: { "@type": "Person", name: "Israel Regardie" },
  publisher: { "@type": "Organization", name: "Aries Press" },
  datePublished: "1940",
  description: "p.57, archive.org leaf n51 (the rules of the Rose Cross sigil)",
  url: citeUrl("regardie1940", { leaf: 51 }),
} as const;

/**
 * An angel page's structured data, one graph: the trail the page shows
 * (which the page emitted on its own before the sigils), then an
 * `ImageObject` for the PNG and one for the SVG, each `contentUrl` exactly
 * the URL the page shows it at. The licence, credit and notice are those
 * the site states for every image a component draws (the About page's
 * licence, as the temple halls state it): CC BY 4.0, credited to
 * Magick.ly, drawn by magick-components (MIT).
 */
export function angelJsonLd(angel: Angel) {
  const files = angelSigilFiles(angel);
  const page = `${SITE_URL}${angelPath(angel)}`;
  const L = GD_HALL_LICENCE;
  const image = (file: AngelSigilFile, id: string) => ({
    "@type": "ImageObject",
    "@id": `${page}#sigil-${id}`,
    contentUrl: `${SITE_URL}${file.path}`,
    url: page,
    name: `Rose Cross sigil of ${angel.name.en}${angelNameShared(angel.no) ? `, angel ${angel.no}` : ""} (${angelSigilText(angel)})`,
    caption: angelSigilAlt(angel),
    encodingFormat: file.format === "png" ? "image/png" : "image/svg+xml",
    ...(file.width && { width: file.width, height: file.height }),
    license: L.url,
    acquireLicensePage: L.acquireLicensePage,
    creator: SITE_ORGANIZATION,
    creditText: L.creditText,
    copyrightNotice: L.copyrightNotice,
    isBasedOn: REGARDIE_RULES,
  });
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbList(
        entityTrail("/kabbalah/yhvh/72angels", angel.name.en, angelPath(angel)),
      ),
      {
        ...image(files.png, "png"),
        associatedMedia: { "@id": `${page}#sigil-svg` },
      },
      image(files.svg, "svg"),
    ],
  };
}
