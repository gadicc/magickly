/**
 * Golden Dawn temple-hall diagrams (plan 061): the hall model, its
 * validator, the layout resolver and the SVG renderer, with the package's
 * original art. MIT; see ../../LICENSE.txt.
 */
export { defaultHallArt } from "./art/index.ts";
export { TABLET_ELEMENTS, tabletArt } from "./art/symbols.tsx";
export { romanNumeral, TRUMPS } from "./art/tarotKey.tsx";
export {
  describeHall,
  type HallDescription,
  type HallStation,
  hallObjectName,
  hallStation,
} from "./describe.ts";
export {
  GD_HALL_FONT_FAMILIES,
  GD_HALL_FONT_FILES,
  GD_HALL_FONT_STACKS,
  type GdHallFontFile,
  gdHallFontFaceCss,
  gdHallFontFaceRule,
} from "./fonts.ts";
export {
  GdHall,
  type GdHallProps,
  GdHallSvg,
  type GdHallSvgProps,
  type HallDrawings,
  hallRoot,
  hallViewBox,
} from "./GdHall.tsx";
export { labelFont, wrapText } from "./labels.ts";
export {
  DEFAULT_SCALES,
  type Rect,
  type ResolvedHall,
  type ResolvedLabel,
  type ResolvedObject,
  type ResolveHallOptions,
  resolveHall,
} from "./layout.ts";
export type * from "./types.ts";
export { type ValidateHallOptions, validateHall } from "./validate.ts";
