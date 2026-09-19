/**
 * Decimal places kept in SVG output, as in SVGO's default. On the 100-unit
 * canvas that is about 0.02 px of error even at the 4096 px raster limit.
 */
export const SVG_COORDINATE_DECIMALS = 3;
const SVG_COORDINATE_SCALE = 10 ** SVG_COORDINATE_DECIMALS;

/**
 * A number as written to SVG. Node and the browser can disagree in the last
 * bit of `Math.sin`/`Math.cos` (30.310889132455348 against …344), and React
 * reports any such attribute difference as a hydration mismatch; rounding
 * gives both the same digits.
 */
export function svgCoordinate(value: number): number {
  // `+ 0` turns the -0 that tiny negative values round to into 0.
  return Math.round(value * SVG_COORDINATE_SCALE) / SVG_COORDINATE_SCALE + 0;
}
