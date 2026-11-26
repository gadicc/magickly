import {
  TABLET_PAGE_IDS,
  type TabletPageId,
  tabletPath,
} from "@/app/enochian/tablets/tabletPages";
import {
  type ComponentImageLink,
  componentImageQuery,
} from "@/render/componentImageUrl";
import { TABLET_RASTER_DEFAULTS } from "@/render/contracts/enochianTablet";

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
 * symbols facing out, as *Symbols on the sides* draws them.
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
