import {
  type ComponentImageContract,
  canonicalDimensions,
  choice,
  type ImageDimensions,
  parseDimensions,
} from "./types";

export const CANDLESTICK_VIEWBOX = [-50, -50, 100, 100] as const;

/**
 * The candlestick's versions, the figure of *The Equinox* I(2) (1909)
 * first and by default: the package's `CANDLESTICK_VERSIONS`, written out
 * so that the contracts do not pull in the drawing; a test holds the two
 * equal.
 */
export const CANDLESTICK_IMAGE_VERSIONS = ["equinox1909", "modern"] as const;

export interface SevenBranchedCandlestickProps extends ImageDimensions {
  /**
   * Which candlestick: the 1909 figure when absent. A link made before
   * the versions drew the modern one, and now draws the 1909 figure.
   */
  version?: (typeof CANDLESTICK_IMAGE_VERSIONS)[number];
}

/** Fixed artwork in a version: the rest is output format and size. */
export const sevenBranchedCandlestick: ComponentImageContract<SevenBranchedCandlestickProps> =
  {
    slug: "seven-branched-candlestick",
    viewBox: CANDLESTICK_VIEWBOX,
    rasterDefault: { width: 1024, height: 1024 },
    keys: ["version"],
    personal: false,
    parse: (searchParams) => ({
      version: choice(
        searchParams.get("version") || "equinox1909",
        CANDLESTICK_IMAGE_VERSIONS,
      ),
      ...parseDimensions(searchParams, CANDLESTICK_VIEWBOX),
    }),
    canonicalize: (props) => [
      ...(props.version && props.version !== "equinox1909"
        ? [["version", props.version] as [string, string]]
        : []),
      ...canonicalDimensions(props),
    ],
    filename: (props) =>
      `seven-branched-candlestick${props.version && props.version !== "equinox1909" ? `-${props.version}` : ""}`,
  };
