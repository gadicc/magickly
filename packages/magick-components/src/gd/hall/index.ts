/**
 * Golden Dawn temple halls (plan 061): `GdHall`, which draws a hall from
 * a hall description, and what a page needs to draw, check or describe
 * one: the types of the description (`HallNode`, and strict ones per tag
 * such as `GdHallNode`), `validateHall`, `describeHall`,
 * `estimateHallAspect`, the layout `GdHallSvg` draws from, the default
 * art and the fonts. The presets are `magick-components/gd/hall/presets`;
 * the tags, for writing a hall as JSX, `magick-components/gd/hall/tags`;
 * magick.ly's editor's toolkit is `magick-components/gd/hall/editor`,
 * which is not stable. MIT; see ../../LICENSE.txt.
 */
export { DEFAULT_HALL_ART } from "./art/index.ts";
export { tabletArt } from "./art/symbols.tsx";
export { estimateHallAspect } from "./aspect.ts";
export {
  describeHall,
  type HallDescription,
  type HallStation,
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
  GdHall as default,
  type GdHallProps,
  GdHallSvg,
  type GdHallSvgProps,
  type HallArtDefinition,
  type HallDrawings,
  hallRoot,
  hallViewBox,
} from "./GdHall.tsx";
export {
  type HallRect,
  type HallResolvedCompassLabel,
  type HallResolvedCuts,
  type HallResolvedDoor,
  type HallResolvedLabel,
  type HallResolvedObject,
  type ResolvedHall,
  type ResolveHallOptions,
  resolveHall,
} from "./layout.ts";
export type * from "./nodes.ts";
export type * from "./types.ts";
export { type ValidateHallOptions, validateHall } from "./validate.ts";
