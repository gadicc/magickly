/**
 * Golden Dawn temple-hall diagrams (plan 061): the hall model, its
 * validator, the layout resolver and the SVG renderer, with the package's
 * original art. MIT; see ../../LICENSE.txt.
 */
export { defaultHallArt } from "./art";
export { TABLET_ELEMENTS, tabletArt } from "./art/symbols";
export { romanNumeral, TRUMPS } from "./art/tarotKey";
export {
  GD_HALL_FONT_FAMILIES,
  GD_HALL_FONT_FILES,
  GD_HALL_FONT_STACKS,
  type GdHallFontFile,
  gdHallFontFaceCss,
  gdHallFontFaceRule,
} from "./fonts";
export { GdHall, type GdHallProps } from "./GdHall";
export { labelFont, wrapText } from "./labels";
export {
  DEFAULT_SCALES,
  type Rect,
  type ResolvedHall,
  type ResolvedLabel,
  type ResolvedObject,
  type ResolveHallOptions,
  resolveHall,
} from "./layout";
export type * from "./types";
export { type ValidateHallOptions, validateHall } from "./validate";
