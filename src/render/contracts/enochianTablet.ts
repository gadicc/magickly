import {
  type ComponentImageContract,
  canonicalDimensions,
  choice,
  type ImageDimensions,
  parseDimensions,
} from "./types";

/**
 * The tablets an image draws: the four Watchtowers, each on the same
 * portrait page, and the Tablet of Union, on a landscape page of its own
 * (`tabletViewBox` in the component). Each id has its own viewBox, raster
 * size and dimensions (`TABLET_VIEWBOXES`, `viewBoxOf`, `rasterDefaultOf`),
 * and the Union only the versions that have it (`parse`).
 */
export const TABLET_IDS = ["earth", "air", "water", "fire", "union"] as const;

/** A tablet an image draws. */
export type TabletImageId = (typeof TABLET_IDS)[number];

/**
 * `WATCHTOWER_VIEWBOX` in the component, written out so that the contracts,
 * which much of the app imports, do not pull in `Tablet`; a test holds the
 * two equal.
 */
export const TABLET_VIEWBOX = [-105, 0, 210, 297] as const;

/** `UNION_VIEWBOX` in the component, written out for the same reason. */
export const UNION_TABLET_VIEWBOX = [0, 0, 124, 104] as const;

/** Each tablet's page, by id. */
export const TABLET_VIEWBOXES: Readonly<
  Record<TabletImageId, readonly [number, number, number, number]>
> = {
  earth: TABLET_VIEWBOX,
  air: TABLET_VIEWBOX,
  water: TABLET_VIEWBOX,
  fire: TABLET_VIEWBOX,
  union: UNION_TABLET_VIEWBOX,
};

/**
 * Each tablet's PNG size when no axis is named: the Watchtowers' 840 ×
 * 1188, which their published images have always had, and the Union's
 * page at the same scale, 4 pixels a unit: 496 × 416.
 */
export const TABLET_RASTER_DEFAULTS: Readonly<
  Record<TabletImageId, { width: number; height: number }>
> = {
  earth: { width: 840, height: 1188 },
  air: { width: 840, height: 1188 },
  water: { width: 840, height: 1188 },
  fire: { width: 840, height: 1188 },
  union: { width: 496, height: 416 },
};

export const TABLET_FONTS = ["latin", "enochian"] as const;

/**
 * The versions a tablet draws in, the Golden Dawn's (`gd`) first and by
 * default: magick-data's `TABLET_VERSIONS`, written out so that the
 * contracts do not pull in the tablets' data; a test holds the two equal.
 */
export const TABLET_IMAGE_VERSIONS = [
  "gd",
  "regardie",
  "equinox",
  "dee",
  "raphael",
] as const;

/**
 * The versions with a Tablet of Union: the Golden Dawn's three. Dee's and
 * Raphael's tables have none, so no image says there is none. A test
 * holds it to the data.
 */
export const UNION_IMAGE_VERSIONS = ["gd", "regardie", "equinox"] as const;

export interface EnochianTabletProps extends ImageDimensions {
  id: TabletImageId;
  /** Latin transliteration, or the bundled Enochian Plain glyphs. */
  font: (typeof TABLET_FONTS)[number];
  /**
   * Whose letters and sigil: the Golden Dawn's when absent, as for a link
   * made before the versions.
   */
  version?: (typeof TABLET_IMAGE_VERSIONS)[number];
}

/**
 * The grid letters are transliterations; the Enochian font maps them to
 * glyphs. Not indexed: each tablet's page publishes its Golden Dawn
 * drawing as static files, the copies to index (plan 100), and the other
 * versions differ from it in a few squares at most.
 */
export const enochianTablet: ComponentImageContract<EnochianTabletProps> = {
  slug: "enochian-tablet",
  viewBox: TABLET_VIEWBOX,
  viewBoxOf: (props) => TABLET_VIEWBOXES[props.id],
  rasterDefault: TABLET_RASTER_DEFAULTS.earth,
  rasterDefaultOf: (props) => TABLET_RASTER_DEFAULTS[props.id],
  keys: ["id", "font", "version"],
  personal: false,
  indexed: false,
  parse(searchParams) {
    const id = choice(searchParams.get("id") || "earth", TABLET_IDS);
    return {
      id,
      font: choice(searchParams.get("font") || "latin", TABLET_FONTS),
      version: choice(
        searchParams.get("version") || "gd",
        id === "union" ? UNION_IMAGE_VERSIONS : TABLET_IMAGE_VERSIONS,
      ),
      ...parseDimensions(searchParams, TABLET_VIEWBOXES[id]),
    };
  },
  canonicalize(props) {
    const pairs: Array<[string, string]> = [];
    if (props.id !== "earth") pairs.push(["id", props.id]);
    if (props.font !== "latin") pairs.push(["font", props.font]);
    if (props.version && props.version !== "gd")
      pairs.push(["version", props.version]);
    return [...pairs, ...canonicalDimensions(props)];
  },
  filename: (props) =>
    `enochian-${props.id}-tablet${props.version && props.version !== "gd" ? `-${props.version}` : ""}${props.font === "enochian" ? "-glyphs" : ""}`,
};
