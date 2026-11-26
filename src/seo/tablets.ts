import { setupI18n } from "@lingui/core";
import tabletNotes, { sourceUrl } from "magick-data/enochian/tabletNotes";
import {
  drawingSources,
  tabletLedeValues,
} from "@/app/enochian/tablets/tabletPageData";
import {
  TABLET_PAGE_IDS,
  TABLET_PAGE_LABELS,
  type TabletPageId,
  tabletAlt,
  tabletPath,
} from "@/app/enochian/tablets/tabletPages";
import { messages as english } from "@/locales/en/messages.js";
import {
  type ComponentImageLink,
  componentImageQuery,
} from "@/render/componentImageUrl";
import { TABLET_RASTER_DEFAULTS } from "@/render/contracts/enochianTablet";
import { GD_HALL_LICENCE } from "@/render/contracts/gdHall";
import type { SocialImage } from "./pages";
import { SITE_ORGANIZATION, SITE_URL } from "./site";

/**
 * The Enochian tablets' static images (plan 100): each of the five
 * tablets flat and as pyramids with their symbols, a PNG and an SVG of
 * each under the tablet's page, drawn at build time through the
 * `enochian-tablet` and `enochian-tablet-pyramids` contracts in the
 * Golden Dawn's version, as the kameas' squares (plan 093, K4) and the
 * temple halls' drawings (plan 062) are. These are the canonical,
 * indexable copies; `/api/render` keeps its own out of the index
 * (`indexed: false`). The other versions and switches stay views of the
 * tool: as pictures they differ from these in a few squares at most.
 */

/** A tablet's two drawings: flat, and as pyramids with their symbols. */
export type TabletDrawing = "flat" | "pyramids";

/**
 * The files' names, by tablet, as the tool names its downloads
 * ("enochian-earth-tablet"), except the Union's, which takes the words a
 * search uses: "tablet of union".
 */
const FILE_BASE: Record<TabletPageId, string> = {
  earth: "enochian-earth-tablet",
  air: "enochian-air-tablet",
  water: "enochian-water-tablet",
  fire: "enochian-fire-tablet",
  union: "enochian-tablet-of-union",
};

/** One of a tablet's static files. */
export interface TabletFile {
  /** The file's name in the URL: `enochian-fire-tablet-pyramids.png`. */
  name: string;
  /** Its path on the site, under the tablet's page. */
  path: string;
  drawing: TabletDrawing;
  format: "png" | "svg";
  /** The PNG's pixels. The SVG states only its viewBox, so has none. */
  width?: number;
  height?: number;
}

/** A tablet's PNG file, which always has its pixels. */
export type TabletPngFile = TabletFile & { width: number; height: number };

/** One drawing's two files: the PNG at the contract's default, and the SVG. */
export interface TabletDrawingFiles {
  png: TabletPngFile;
  svg: TabletFile;
}

/** A tablet's four files, by drawing. */
export function tabletFiles(
  id: TabletPageId,
): Record<TabletDrawing, TabletDrawingFiles> {
  const files = (drawing: TabletDrawing): TabletDrawingFiles => {
    const base = `${FILE_BASE[id]}${drawing === "pyramids" ? "-pyramids" : ""}`;
    const file = (format: "png" | "svg") => ({
      name: `${base}.${format}`,
      path: `${tabletPath(id)}/${base}.${format}`,
      drawing,
      format,
    });
    return {
      png: { ...file("png"), ...TABLET_RASTER_DEFAULTS[id] },
      svg: file("svg"),
    };
  };
  return { flat: files("flat"), pyramids: files("pyramids") };
}

/**
 * Every tablet's files, as the route prerenders them and the sitemap
 * lists them: for each tablet, its PNGs first (flat, then pyramids), then
 * its SVGs.
 */
export function allTabletFiles(): { tablet: TabletPageId; file: TabletFile }[] {
  return TABLET_PAGE_IDS.flatMap((tablet) => {
    const { flat, pyramids } = tabletFiles(tablet);
    return [flat.png, pyramids.png, flat.svg, pyramids.svg].map((file) => ({
      tablet,
      file,
    }));
  });
}

/**
 * The image a file is drawn from, as the tool links it: the tablet in the
 * Golden Dawn's version in Latin letters, and as pyramids with the
 * symbols outward, as *Symbols on the sides* draws them.
 */
export function tabletFileLink(
  id: TabletPageId,
  drawing: TabletDrawing,
):
  | ComponentImageLink<"enochian-tablet">
  | ComponentImageLink<"enochian-tablet-pyramids"> {
  return drawing === "flat"
    ? {
        slug: "enochian-tablet",
        props: { id, font: "latin", version: "gd" },
      }
    : {
        slug: "enochian-tablet-pyramids",
        props: { id, font: "latin", version: "gd", symbols: "outward" },
      };
}

/**
 * The image request a file is drawn from: its link's canonical query,
 * with `fmt=png` for the PNG at the contract's raster default, as the
 * tool's export asks for it.
 */
export function tabletFileQuery(id: TabletPageId, file: TabletFile) {
  return componentImageQuery(tabletFileLink(id, file.drawing), {
    format: file.format,
  });
}

// The English catalog, never activated: the caption must read exactly as
// the English page's alt text does.
const englishI18n = setupI18n({ locale: "en", messages: { en: english } });
const englishT = (message: string, values?: Record<string, string | number>) =>
  englishI18n._(message, values);

/** A drawing's alt text in English, as the structured data's caption. */
export const tabletAltEnglish = (id: TabletPageId, drawing: TabletDrawing) =>
  tabletAlt(id, drawing, tabletLedeValues(id), englishT);

/**
 * The flat tablet's PNG as a tablet page's second Open Graph image, after
 * the page's card, as the kameas and the temple halls add theirs.
 */
export function tabletSocialImage(id: TabletPageId): SocialImage {
  const { png } = tabletFiles(id).flat;
  return {
    url: png.path,
    width: png.width,
    height: png.height,
    alt: tabletAltEnglish(id, "flat"),
  };
}

/**
 * The Regardie pages the Golden Dawn's drawing follows, each as its book
 * with the page and leaf in its description, as the halls cite theirs.
 */
function drawingBooks(id: TabletPageId) {
  return drawingSources(id).map((source) => {
    const work = tabletNotes.works[source.work];
    return {
      "@type": "Book",
      name: work.title,
      author: { "@type": "Person", name: "Israel Regardie" },
      ...(work.year && { datePublished: String(work.year) }),
      description: `p.${source.page}, archive.org leaf n${source.leaf}`,
      url: sourceUrl(source),
    } as const;
  });
}

/**
 * A tablet page's images as structured data: an `ImageObject` for each of
 * its four files, the flat tablet's PNG first, each `contentUrl` exactly
 * the URL the page shows it at, each PNG with its SVG as associated
 * media, based on the Regardie pages the drawing follows. The licence,
 * credit and notice are those the site states for every image a
 * component draws (CC BY 4.0, credited to Magick.ly, drawn by
 * magick-components, MIT), as the kameas and the halls state them. The
 * page's trail is its own script (`PageBreadcrumbs`).
 */
export function tabletJsonLd(id: TabletPageId) {
  const files = tabletFiles(id);
  const page = `${SITE_URL}${tabletPath(id)}`;
  const L = GD_HALL_LICENCE;
  const label = `Enochian ${englishT(TABLET_PAGE_LABELS[id])}`;
  const isBasedOn = drawingBooks(id);
  const image = (file: TabletFile) => ({
    "@type": "ImageObject",
    "@id": `${page}#${file.drawing}-${file.format}`,
    contentUrl: `${SITE_URL}${file.path}`,
    url: page,
    name: file.drawing === "flat" ? label : `${label} as pyramids`,
    caption: tabletAltEnglish(id, file.drawing),
    encodingFormat: file.format === "png" ? "image/png" : "image/svg+xml",
    ...(file.width && { width: file.width, height: file.height }),
    license: L.url,
    acquireLicensePage: L.acquireLicensePage,
    creator: SITE_ORGANIZATION,
    creditText: L.creditText,
    copyrightNotice: L.copyrightNotice,
    isBasedOn,
  });
  return {
    "@context": "https://schema.org",
    "@graph": (["flat", "pyramids"] as const).flatMap((drawing) => {
      const { png, svg } = files[drawing];
      return [
        { ...image(png), associatedMedia: { "@id": image(svg)["@id"] } },
        image(svg),
      ];
    }),
  };
}
