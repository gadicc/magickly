import type { TabletVersionId } from "magick-data/enochian/tablets";
import type { LamenGrade } from "../lamenGrades.ts";
import type { TABLET_ELEMENTS } from "./art/symbols.tsx";
import type { HallPlanet } from "./planets.ts";
import type {
  ALTAR_KINDS,
  BannerSide,
  BoardKind,
  CardKind,
  CrossForm,
  HallPoint,
  LabelPosition,
  LightColor,
} from "./vocabulary.ts";

/**
 * The strict hall node types (plan 084, stage 1): one per tag, with the
 * nesting `spec.ts` allows, the values the vocabulary knows and the
 * values a tag needs to draw what it names. Write a hall with them, as the
 * presets are, and TypeScript checks it as the validator would.
 *
 * Every one is a type alias, never an interface: an interface has no
 * implicit index signature, so it would not be assignable to `HallNode`,
 * the lenient type `GdHall`, `validateHall` and `resolveHall` take. Any
 * strict node is a `HallNode`; stored halls, which may hold anything,
 * stay `HallNode`, and so does a hall that uses a tag or item kind the
 * app's own art adds.
 *
 * Only the vocabulary's spellings are offered: `center`, never `centre`;
 * `gray`, never `grey`. The readers still take the old spellings in
 * stored halls.
 */

export type {
  BannerSide,
  BoardKind,
  CardKind,
  CrossForm,
  HallPlanet,
  HallPoint,
  LabelPosition,
  LightColor,
};

/**
 * An officer's role: a key of the vocabulary's `HALL_ROLES` (a test holds
 * the two together). A `HallNode` may name any other role, which draws a
 * plain lamen.
 */
export type HallRole =
  | "imperator"
  | "cancellarius"
  | "praemonstrator"
  | "hierophant"
  | "pastHierophant"
  | "hiereus"
  | "hegemon"
  | "keryx"
  | "stolistes"
  | "dadouchos"
  | "sentinel"
  | "chiefAdept"
  | "secondAdept"
  | "thirdAdept";

/**
 * A colour an item's `fill` or `stroke` takes: a key of the vocabulary's
 * `HALL_COLORS` (a test holds the two together), never raw CSS.
 */
export type HallColor =
  | "none"
  | "white"
  | "black"
  | "red"
  | "blue"
  | "yellow"
  | "gold"
  | "green"
  | "gray";

/** A tablet's element: a Watchtower's, or `union`, the Tablet of Union. */
export type TabletElement = (typeof TABLET_ELEMENTS)[number];

/** The altars: the black double cube, and the Portal's small white one. */
export type AltarKind = (typeof ALTAR_KINDS)[number];

/** What every placeable and host reads, besides its own attributes. */
export type HallPlaced = {
  /**
   * Where the object's anchor stands, in squares of its parent's frame.
   * The floor's frame runs x North → South (0 at the North edge, 16 at
   * the South); a host's is centred on the host. With `at`, an offset
   * from that point. Without, a row spreads the object, and elsewhere it
   * stands at the frame's centre.
   */
  x?: number;
  /**
   * As `x`, across: the floor's frame runs y East → West (0 at the East
   * edge, the dais beyond it, 16 at the West).
   */
  y?: number;
  /** A named point on the parent's box, which `x` and `y` then offset. */
  at?: HallPoint;
  /** The point of the object that is placed: `center` unless given. */
  anchor?: HallPoint;
  /**
   * The size: 1 fits the drawing into a 2 × 2-square cell (a platform's
   * `w` × `h` instead); 0.05–10. Each kind has its own default.
   */
  scale?: number;
  /** Replaces the default label (an officer's role name); `""` hides it. */
  label?: string;
  /** Where the label stands: `top` on the dais, `bottom` elsewhere. */
  labelPos?: LabelPosition;
};

// ---------------------------------------------------------------------------
// Each tag's attributes, without `type` and `children`.

/** The hall's own attributes, on its `gdHall` root. */
export type GdHallAttributes = {
  /** The dais' depth in squares, East of the floor: 4 unless given; 0–16. */
  dais?: number;
  /** How the outer wall is drawn: `plain` unless given. */
  wall?: "plain" | "gradient";
  /** Whether the compass points are written outside the walls: yes unless false. */
  compass?: boolean;
  /** Space around the drawing in squares, where no margin is given: 0.5 unless given. */
  padding?: number;
  /** The labels' text size in squares; 0.05–4. */
  labelSize?: number;
  /** Space beyond the outer wall on every side, in squares, replacing `padding`; 0–48. */
  margin?: number;
  /** As `margin`, on the North side only. */
  marginNorth?: number;
  /** As `margin`, on the South side only. */
  marginSouth?: number;
  /** As `margin`, on the East side only. */
  marginEast?: number;
  /** As `margin`, on the West side only. */
  marginWest?: number;
};

/** A row's spacing: `even` leaves half a gap at each end, `ends` none. */
type RowSpread = { spread?: "even" | "ends" };

/** The dais' row of officers, East of the floor. */
export type DaisAttributes = RowSpread;

/** A row outside a wall: the East unless `side` says otherwise. */
export type BannersAttributes = RowSpread & { side?: BannerSide };

/** The floor's 16 × 16 squares have no attributes of their own. */
export type FloorAttributes = Record<never, never>;

/** The hall's caption, below the drawing. */
export type CaptionAttributes = { text: string };

/**
 * A door in the outer wall, drawn at its centre along the wall (0–16, the
 * floor's squares) and `width` wide (2 unless given): along the East or
 * West wall (the West unless `side` says otherwise) by `x`, along the
 * North or South wall by `y`.
 */
export type DoorAttributes =
  | { side?: "east" | "west"; x: number; width?: number }
  | { side: "north" | "south"; y: number; width?: number };

/** An officer, drawn as the role's lamen and labelled with its name. */
export type OfficerAttributes = HallPlaced & {
  role: HallRole;
  /** A grade in which the officer wears another lamen (the Portal's Hiereus and Hegemon). */
  grade?: LamenGrade;
};

/** A lamen on its own, unlabelled unless `label` says. */
export type LamenAttributes = OfficerAttributes;

/** A marked place: text in a box or a circle. */
export type MarkerAttributes = HallPlaced & {
  text: string;
  /** `box` unless given. */
  shape?: "box" | "circle";
};

/** An altar; things are put on it. */
export type AltarAttributes = HallPlaced & {
  /** `black` unless given. */
  kind?: AltarKind;
};

/** A platform `w` × `h` squares; things are put on it. */
export type PlatformAttributes = HallPlaced & { w?: number; h?: number };

/** A throne, `w` × `h` squares; things are put on it. */
export type ThroneAttributes = PlatformAttributes;

/**
 * A board: one with a diagram keeps the diagram's proportions and is
 * sized by `scale`; a plain one takes `w` and `h`.
 */
export type BoardAttributes = HallPlaced &
  ({ kind: BoardKind } | { kind?: undefined; w?: number; h?: number });

/** A pillar: `black` unless `kind` says `white`. */
export type PillarAttributes = HallPlaced & {
  kind?: "black" | "white";
  /** A red light inside its triangle, as the Neophyte drawing has. */
  glow?: boolean;
};

/** A banner: the East's unless `kind` says the West's. */
export type BannerAttributes = HallPlaced & { kind?: "east" | "west" };

/** The Portal's curtain across the dais, sized by `scale`. */
export type VeilAttributes = HallPlaced;

/** The Table of Shewbread on a disc. */
export type ShewbreadAttributes = HallPlaced;

/** The Seven-Branched Candlestick on a disc. */
export type CandlestickAttributes = HallPlaced;

/** A Hebrew letter. */
export type HebrewLetterAttributes = HallPlaced & {
  /**
   * The letter, by name (`shin`, `Tau`, `kaf-sofit`) or as itself
   * (`ש`). The validator checks the name; this type does not.
   */
  letter: string;
};

/**
 * An item, discriminated by its `kind`: a cross alone takes `form`, a
 * lamp or a lantern alone `light`. As anywhere in TypeScript, only an
 * object literal is checked for attributes its kind does not take: a
 * cup's `form` in a variable typed otherwise still assigns.
 */
export type ItemKindAttributes =
  | {
      kind: "cross";
      /** `latin` unless given. */
      form?: CrossForm;
      /** `red` unless given. */
      fill?: HallColor;
      /** `yellow` unless given. */
      stroke?: HallColor;
    }
  | {
      kind: "triangle";
      /** `up` unless given. */
      dir?: "up" | "down";
      /** `none` unless given. */
      fill?: HallColor;
      /** `white` unless given. */
      stroke?: HallColor;
    }
  | {
      kind: "pentagram";
      /** `none` unless given. */
      fill?: HallColor;
      /** `white` unless given. */
      stroke?: HallColor;
    }
  | {
      kind: "lightning";
      /** The ink's unless given. */
      stroke?: HallColor;
    }
  | {
      kind: "lamp" | "lantern";
      /** What the light burns: a lamp red, a lantern yellow, unless given. */
      light?: LightColor;
    }
  | {
      kind:
        | "pantacle"
        | "gong"
        | "brazier"
        | "candle"
        | "cup"
        | "chalice"
        | "censer"
        | "rose"
        | "salt"
        | "bread"
        | "fan";
    };

/** The item kinds the package draws. */
export type ItemKind = ItemKindAttributes["kind"];

/** An item: see `ItemKindAttributes`. */
export type ItemAttributes = HallPlaced & ItemKindAttributes;

/** A tarot key, by its trump's number (0–21); blank without one. */
export type TarotKeyAttributes = HallPlaced & { n?: number };

/** One of the Portal's emblem cards, in a key's frame. */
export type CardAttributes = HallPlaced & { kind: CardKind };

/** An Enochian tablet on a board; a blank board without an element. */
export type TabletAttributes = HallPlaced & {
  element?: TabletElement;
  /** Whose reading of the squares: the Golden Dawn's unless given. */
  version?: TabletVersionId;
  /** Whether reversed letters are drawn mirrored: yes unless false. */
  reversed?: boolean;
  /** Whether second letters are drawn in the squares' corners. */
  alt?: boolean;
};

/** A planet's kamea, its magic square. */
export type KameaAttributes = HallPlanetAttributes;

/** A planet's seal. */
export type SealAttributes = HallPlanetAttributes;

/** A kamea's or a seal's planet. */
type HallPlanetAttributes = HallPlaced & { planet: HallPlanet };

/**
 * A label: free text in the floor or a row, or, as a child of a
 * placeable or a host, one more line of its label, which `pos` places.
 */
export type LabelAttributes = {
  text: string;
  /** Where an attached label stands: its object's `labelPos` unless given. */
  pos?: LabelPosition;
  /** The width it wraps at, in squares: its object's, or none when free. */
  width?: number;
  /** The text size in squares: the hall's `labelSize` unless given; 0.05–4. */
  size?: number;
  /** As a placeable's `x`, for free text. */
  x?: number;
  /** As a placeable's `y`, for free text. */
  y?: number;
  /** As a placeable's `at`, for free text. */
  at?: HallPoint;
  /** As a placeable's `anchor`, for free text. */
  anchor?: HallPoint;
};

// ---------------------------------------------------------------------------
// The nodes: `{type} & attributes & {children}`, nested as `spec.ts` allows.

/** A label node. */
export type LabelNode = { type: "label" } & LabelAttributes;

/** A placeable's children: the lines of its label. */
type LabelChildren = { children?: readonly LabelNode[] };

export type OfficerNode = { type: "officer" } & OfficerAttributes &
  LabelChildren;
export type LamenNode = { type: "lamen" } & LamenAttributes & LabelChildren;
export type MarkerNode = { type: "marker" } & MarkerAttributes & LabelChildren;
export type PillarNode = { type: "pillar" } & PillarAttributes & LabelChildren;
export type BannerNode = { type: "banner" } & BannerAttributes & LabelChildren;
export type VeilNode = { type: "veil" } & VeilAttributes & LabelChildren;
export type ShewbreadNode = { type: "shewbread" } & ShewbreadAttributes &
  LabelChildren;
export type CandlestickNode = { type: "candlestick" } & CandlestickAttributes &
  LabelChildren;
export type HebrewLetterNode = {
  type: "hebrewLetter";
} & HebrewLetterAttributes &
  LabelChildren;
/** An item: see `ItemKindAttributes`. */
export type ItemNode = { type: "item" } & ItemAttributes & LabelChildren;
export type TarotKeyNode = { type: "tarotKey" } & TarotKeyAttributes &
  LabelChildren;
export type CardNode = { type: "card" } & CardAttributes & LabelChildren;
export type TabletNode = { type: "tablet" } & TabletAttributes & LabelChildren;
export type KameaNode = { type: "kamea" } & KameaAttributes & LabelChildren;
export type SealNode = { type: "seal" } & SealAttributes & LabelChildren;

/** Every placeable the package draws: things that hold only labels. */
export type HallPlaceableNode =
  | OfficerNode
  | LamenNode
  | MarkerNode
  | PillarNode
  | BannerNode
  | VeilNode
  | ShewbreadNode
  | CandlestickNode
  | HebrewLetterNode
  | ItemNode
  | TarotKeyNode
  | CardNode
  | TabletNode
  | KameaNode
  | SealNode;

/** What a row (`dais`, `banners`), the floor or a host holds, doors aside. */
export type HallContentNode = HallPlaceableNode | HallHostNode | LabelNode;

/** The children of a row or a host. */
type ContentChildren = { children?: readonly HallContentNode[] };

export type AltarNode = { type: "altar" } & AltarAttributes & ContentChildren;
export type PlatformNode = { type: "platform" } & PlatformAttributes &
  ContentChildren;
export type ThroneNode = { type: "throne" } & ThroneAttributes &
  ContentChildren;
export type BoardNode = { type: "board" } & BoardAttributes & ContentChildren;

/** The hosts: placeables that things are put on. */
export type HallHostNode = AltarNode | PlatformNode | ThroneNode | BoardNode;

export type DaisNode = { type: "dais" } & DaisAttributes & ContentChildren;
export type BannersNode = { type: "banners" } & BannersAttributes &
  ContentChildren;
export type DoorNode = { type: "door" } & DoorAttributes;
export type FloorNode = { type: "floor" } & FloorAttributes & {
    children?: readonly (HallContentNode | DoorNode)[];
  };
export type CaptionNode = { type: "caption" } & CaptionAttributes;

/** What the `gdHall` root holds. */
export type GdHallChildNode =
  | DaisNode
  | BannersNode
  | FloorNode
  | CaptionNode
  | DoorNode;

/** A whole hall, strictly typed; any one is a `HallNode`. */
export type GdHallNode = { type: "gdHall" } & GdHallAttributes & {
    children?: readonly GdHallChildNode[];
  };

/** Every strict node, one per tag. */
export type HallStrictNode = GdHallNode | GdHallChildNode | HallContentNode;
