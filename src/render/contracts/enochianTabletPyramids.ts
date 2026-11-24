import {
  enochianTablet,
  TABLET_FONTS,
  TABLET_IDS,
  TABLET_RASTER_DEFAULTS,
  TABLET_VIEWBOX,
  TABLET_VIEWBOXES,
  type TabletImageId,
} from "./enochianTablet";
import {
  type ComponentImageContract,
  canonicalDimensions,
  choice,
  type ImageDimensions,
  parseDimensions,
} from "./types";

/**
 * The versions whose squares are pyramids: the Golden Dawn's three
 * (magick-data's `CALVARY_BARS`, which has none for Dee's and Raphael's,
 * written out so that the contracts do not pull in the pyramids' rules; a
 * test holds the two equal). Every one has a Tablet of Union.
 */
export const TABLET_PYRAMID_IMAGE_VERSIONS = [
  "gd",
  "regardie",
  "equinox",
] as const;

/** A version whose tablets an image can draw as pyramids. */
export type TabletPyramidImageVersion =
  (typeof TABLET_PYRAMID_IMAGE_VERSIONS)[number];

/** Whether an image can draw a version's tablets as pyramids. */
export const isTabletPyramidImageVersion = (
  version: string,
): version is TabletPyramidImageVersion =>
  (TABLET_PYRAMID_IMAGE_VERSIONS as readonly string[]).includes(version);

/**
 * The symbols on the pyramids' sides: none (the default), facing out from
 * the top as the Order painted them, or upright.
 */
export const TABLET_PYRAMID_SYMBOLS = ["none", "outward", "upright"] as const;

/** One of `TABLET_PYRAMID_SYMBOLS`. */
export type TabletPyramidSymbols = (typeof TABLET_PYRAMID_SYMBOLS)[number];

export interface EnochianTabletPyramidsProps extends ImageDimensions {
  id: TabletImageId;
  /** Latin transliteration, or the bundled Enochian Plain glyphs. */
  font: (typeof TABLET_FONTS)[number];
  /** Whose letters: the Golden Dawn's when absent from the query. */
  version: TabletPyramidImageVersion;
  /**
   * Each side's symbol drawn on it, facing out or upright, on a top a
   * third of the square; none, on a top half the square, when absent.
   */
  symbols: TabletPyramidSymbols;
}

/** What the symbols add to an image's file name. */
const SYMBOLS_NAMES: Readonly<Record<TabletPyramidSymbols, string>> = {
  none: "",
  outward: "-symbols",
  upright: "-symbols-upright",
};

/**
 * What a pyramids image's file name adds to the flat tablet's:
 * "-pyramids", then "-symbols" or "-symbols-upright".
 */
export const tabletPyramidsSuffix = (symbols: TabletPyramidSymbols) =>
  `-pyramids${SYMBOLS_NAMES[symbols]}`;

/**
 * A tablet drawn as the Golden Dawn's truncated pyramids (plan 095,
 * decision 5): each square's four sides in their elements' colours round
 * a white top, half the square, with the letter; with `symbols`, each
 * side's symbol on it, facing out (`outward`) or upright, round a top a
 * third of the square. A slug of its own, so
 * that the flat tablets' images keep their identity and a change to the
 * pyramids' drawing moves only these. The same pages and raster sizes as
 * the flat tablets; Dee's and Raphael's versions, which have no pyramids,
 * are refused.
 *
 * Every key is omitted at its default, so `symbols`, which came later
 * and whose default draws what was drawn before it, left every existing
 * query, and so every existing image, as it was.
 */
export const enochianTabletPyramids: ComponentImageContract<EnochianTabletPyramidsProps> =
  {
    slug: "enochian-tablet-pyramids",
    viewBox: TABLET_VIEWBOX,
    viewBoxOf: (props) => TABLET_VIEWBOXES[props.id],
    rasterDefault: TABLET_RASTER_DEFAULTS.earth,
    rasterDefaultOf: (props) => TABLET_RASTER_DEFAULTS[props.id],
    keys: ["id", "font", "version", "symbols"],
    personal: false,
    parse(searchParams) {
      const id = choice(searchParams.get("id") || "earth", TABLET_IDS);
      return {
        id,
        font: choice(searchParams.get("font") || "latin", TABLET_FONTS),
        version: choice(
          searchParams.get("version") || "gd",
          TABLET_PYRAMID_IMAGE_VERSIONS,
        ),
        symbols: choice(
          searchParams.get("symbols") || "none",
          TABLET_PYRAMID_SYMBOLS,
        ),
        ...parseDimensions(searchParams, TABLET_VIEWBOXES[id]),
      };
    },
    canonicalize(props) {
      const pairs: Array<[string, string]> = [];
      if (props.id !== "earth") pairs.push(["id", props.id]);
      if (props.font !== "latin") pairs.push(["font", props.font]);
      if (props.version !== "gd") pairs.push(["version", props.version]);
      if (props.symbols !== "none") pairs.push(["symbols", props.symbols]);
      return [...pairs, ...canonicalDimensions(props)];
    },
    // The flat image's name with `-pyramids` after it, as the tablets
    // page names its downloads of the same drawing, and the symbols after
    // that: "-symbols", facing out, or "-symbols-upright".
    filename: (props) =>
      `${enochianTablet.filename(props)}${tabletPyramidsSuffix(props.symbols)}`,
  };
