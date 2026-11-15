/**
 * Hall tags (plan 084): a Golden Dawn temple hall written as JSX, for
 * `import * as Hall from "magick-components/gd/hall/tags"`. Each tag
 * stands for one node of a hall description (`<Hall.Pillar kind="white"
 * x={12} />` for `{type: "pillar", kind: "white", x: 12}`) and renders
 * nothing: `GdHall`, from `magick-components/gd/hall`, reads them as its
 * children and draws the hall. Only tags and Fragments may stand in a
 * hall; a piece shared between halls is a function called in braces
 * (`{pillars()}`), not a component. TypeScript checks each tag's props,
 * not where a tag stands: `validateHall()` checks that. MIT; see
 * ../../LICENSE.txt.
 */
import type { ReactElement } from "react";
import type {
  AltarAttributes,
  BannerAttributes,
  BannersAttributes,
  BoardAttributes,
  CandlestickAttributes,
  CaptionAttributes,
  CardAttributes,
  DaisAttributes,
  DoorAttributes,
  FloorAttributes,
  HallPlaced,
  HebrewLetterAttributes,
  ItemAttributes,
  KameaAttributes,
  LabelAttributes,
  LamenAttributes,
  MarkerAttributes,
  OfficerAttributes,
  PillarAttributes,
  PlatformAttributes,
  SealAttributes,
  ShewbreadAttributes,
  TabletAttributes,
  TarotKeyAttributes,
  ThroneAttributes,
  VeilAttributes,
} from "./nodes.ts";
import { HALL_TAG, HALL_TAG_ATTRIBUTES, warnInDevelopment } from "./walk.ts";

export type { HallPlaced } from "./nodes.ts";
export { type HallFromTags, hallFromTags } from "./walk.ts";

/**
 * What a tag holds: tags, Fragments, and the `null`, `undefined` and
 * booleans that conditionals leave, in arrays as `.map()` makes them.
 * Text and numbers are compile errors; a node's text is a prop.
 */
export type HallChildren =
  | ReactElement
  | boolean
  | null
  | undefined
  | readonly HallChildren[];

/** The props of a tag that holds other tags. */
type Holds = { children?: HallChildren };
/** The props of a tag that holds nothing. */
type Empty = { children?: never };

/**
 * A hall tag: a component that renders nothing, which `GdHall` reads as
 * a node of the type it was made for.
 */
export type HallTag<P> = ((props: P) => null) & {
  readonly displayName: string;
};

/** A tag's name as warnings give it: `Hall.Pillar`, `SerpentTree`. */
const pascal = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);

/** A tag, marked with its type and any attributes of its own. */
function makeTag<P>(
  type: string,
  displayName: string,
  attributes?: Readonly<Record<string, unknown>>,
): HallTag<P> {
  const message = `${displayName} rendered outside GdHall: tags are read by GdHall, not rendered; across a client boundary, pass hallFromTags(…).hall instead`;
  const tag = (_props: P): null => {
    warnInDevelopment(message);
    return null;
  };
  Object.defineProperty(tag, HALL_TAG, { value: type });
  if (attributes)
    Object.defineProperty(tag, HALL_TAG_ATTRIBUTES, {
      value: Object.freeze({ ...attributes }),
    });
  Object.defineProperty(tag, "displayName", { value: displayName });
  return tag as HallTag<P>;
}

/**
 * A tag for a node type your own art draws, typed by its props (each a
 * string, number or boolean): `const SerpentTree =
 * defineHallTag<HallPlaced & { coils?: number }>("serpentTree")`. A hall
 * that uses it is a `HallNode`, not a strict `GdHallNode`. It refuses
 * `gdHall`, the root, which is `GdHall`, and `item`, whose kinds
 * `defineHallItem` makes tags for.
 */
export function defineHallTag<P extends object = HallPlaced>(
  type: string,
): HallTag<P & Holds> {
  if (type === "gdHall" || type === "item")
    throw new Error(
      `defineHallTag cannot make a "${type}" tag: ${type === "item" ? "use defineHallItem(kind) for an item kind" : "the root is GdHall"}`,
    );
  return makeTag<P & Holds>(type, pascal(type));
}

/**
 * A tag for an item kind your own art draws, `item:<kind>` in its
 * registry: `const Sistrum = defineHallItem<{ metal?: "gold" | "silver"
 * }>("sistrum")`, and `<Sistrum at="east" metal="gold" />` is `{type:
 * "item", kind: "sistrum", at: "east", metal: "gold"}`. It takes the
 * placement every item does, and labels as children.
 */
export function defineHallItem<P extends object = Record<never, never>>(
  kind: string,
): HallTag<HallPlaced & P & Holds> {
  return makeTag<HallPlaced & P & Holds>("item", pascal(kind), { kind });
}

/** One of the package's tags, named `Hall.<Type>` in warnings. */
const hallTag = <P>(type: string) => makeTag<P>(type, `Hall.${pascal(type)}`);

export type DaisProps = DaisAttributes & Holds;
export type BannersProps = BannersAttributes & Holds;
export type FloorProps = FloorAttributes & Holds;
export type CaptionProps = CaptionAttributes & Empty;
export type DoorProps = DoorAttributes & Empty;
export type OfficerProps = OfficerAttributes & Holds;
export type LamenProps = LamenAttributes & Holds;
export type MarkerProps = MarkerAttributes & Holds;
export type AltarProps = AltarAttributes & Holds;
export type PlatformProps = PlatformAttributes & Holds;
export type ThroneProps = ThroneAttributes & Holds;
export type BoardProps = BoardAttributes & Holds;
export type PillarProps = PillarAttributes & Holds;
export type BannerProps = BannerAttributes & Holds;
export type VeilProps = VeilAttributes & Holds;
export type ShewbreadProps = ShewbreadAttributes & Holds;
export type CandlestickProps = CandlestickAttributes & Holds;
export type HebrewLetterProps = HebrewLetterAttributes & Holds;
export type ItemProps = ItemAttributes & Holds;
export type TarotKeyProps = TarotKeyAttributes & Holds;
export type CardProps = CardAttributes & Holds;
export type TabletProps = TabletAttributes & Holds;
export type KameaProps = KameaAttributes & Holds;
export type SealProps = SealAttributes & Holds;
export type LabelProps = LabelAttributes & Empty;

/** The dais' row of officers, East of the floor (in `GdHall`). */
export const Dais: HallTag<DaisProps> = /*#__PURE__*/ hallTag("dais");
/** A row outside a wall, the East unless `side` says otherwise (in `GdHall`). */
export const Banners: HallTag<BannersProps> = /*#__PURE__*/ hallTag("banners");
/** The floor's 16 × 16 squares (in `GdHall`). */
export const Floor: HallTag<FloorProps> = /*#__PURE__*/ hallTag("floor");
/** The hall's caption, below the drawing (in `GdHall`). */
export const Caption: HallTag<CaptionProps> = /*#__PURE__*/ hallTag("caption");
/** A door in the outer wall (in `GdHall` or the floor). */
export const Door: HallTag<DoorProps> = /*#__PURE__*/ hallTag("door");
/** An officer, drawn as the role's lamen and labelled with its name. */
export const Officer: HallTag<OfficerProps> = /*#__PURE__*/ hallTag("officer");
/** A lamen on its own, unlabelled unless `label` says. */
export const Lamen: HallTag<LamenProps> = /*#__PURE__*/ hallTag("lamen");
/** A marked place: text in a box or a circle. */
export const Marker: HallTag<MarkerProps> = /*#__PURE__*/ hallTag("marker");
/** An altar; things are put on it. */
export const Altar: HallTag<AltarProps> = /*#__PURE__*/ hallTag("altar");
/** A platform `w` × `h` squares; things are put on it. */
export const Platform: HallTag<PlatformProps> =
  /*#__PURE__*/ hallTag("platform");
/** A throne, `w` × `h` squares; things are put on it. */
export const Throne: HallTag<ThroneProps> = /*#__PURE__*/ hallTag("throne");
/** A board, with a diagram or plain; things are put on it. */
export const Board: HallTag<BoardProps> = /*#__PURE__*/ hallTag("board");
/** A pillar: `black` unless `kind` says `white`. */
export const Pillar: HallTag<PillarProps> = /*#__PURE__*/ hallTag("pillar");
/** A banner: the East's unless `kind` says the West's. */
export const Banner: HallTag<BannerProps> = /*#__PURE__*/ hallTag("banner");
/** The Portal's curtain across the dais. */
export const Veil: HallTag<VeilProps> = /*#__PURE__*/ hallTag("veil");
/** The Table of Shewbread on a disc. */
export const Shewbread: HallTag<ShewbreadProps> =
  /*#__PURE__*/ hallTag("shewbread");
/** The Seven-Branched Candlestick on a disc. */
export const Candlestick: HallTag<CandlestickProps> =
  /*#__PURE__*/ hallTag("candlestick");
/** A Hebrew letter. */
export const HebrewLetter: HallTag<HebrewLetterProps> =
  /*#__PURE__*/ hallTag("hebrewLetter");
/**
 * An item of the package's kinds; `defineHallItem` makes a tag for a
 * kind of your own art's.
 */
export const Item: HallTag<ItemProps> = /*#__PURE__*/ hallTag("item");
/** A tarot key, by its trump's number; blank without one. */
export const TarotKey: HallTag<TarotKeyProps> =
  /*#__PURE__*/ hallTag("tarotKey");
/** One of the Portal's emblem cards. */
export const Card: HallTag<CardProps> = /*#__PURE__*/ hallTag("card");
/** An Enochian tablet on a board; a blank board without an element. */
export const Tablet: HallTag<TabletProps> = /*#__PURE__*/ hallTag("tablet");
/** A planet's kamea, its magic square. */
export const Kamea: HallTag<KameaProps> = /*#__PURE__*/ hallTag("kamea");
/** A planet's seal. */
export const Seal: HallTag<SealProps> = /*#__PURE__*/ hallTag("seal");
/**
 * Free text in the floor or a row, or a label of a placeable's or a
 * host's own, as its child.
 */
export const Label: HallTag<LabelProps> = /*#__PURE__*/ hallTag("label");
