/**
 * The toolkit of magick.ly's hall editor: what the editor reads of the
 * hall vocabulary, the attributes and the layout, beyond what
 * `magick-components/gd/hall` gives every page. It serves that editor,
 * and may change in any release, a patch included; draw, check and
 * describe halls with `magick-components/gd/hall`. MIT; see
 * ../../LICENSE.txt.
 */
export {
  enumAttr,
  numberAttr,
  placedByAt,
  readBoolean,
  readNumber,
} from "./attributes.ts";
export {
  compassBox,
  DEFAULT_SCALES,
  FLOOR_SIZE,
  FLOOR_STROKE,
  WALL_GAP,
} from "./layout.ts";
export { HALL_PLANET_NAMES, HALL_PLANETS, type HallPlanet } from "./planets.ts";
export { hallArtKey, hallTagSpec } from "./spec.ts";
export {
  BANNER_SIDES,
  BOARD_KINDS,
  BOARD_NAMES,
  type BoardKind,
  CARD_KINDS,
  CARD_LABELS,
  CARD_TITLES,
  type CardKind,
  COORDINATE_RANGE,
  CORE_ITEM_KINDS,
  HALL_POINT_OFFSETS,
  HALL_ROLES,
  hallColor,
  hallPoint,
  hallSpellingAlias,
  LIGHT_KINDS,
  PLACEABLE_ATTRIBUTES,
  RESERVED_ATTRIBUTES,
  RESERVED_TAGS,
  roleName,
  SCALE_RANGE,
} from "./vocabulary.ts";
