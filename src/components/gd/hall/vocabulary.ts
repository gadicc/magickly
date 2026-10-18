import { COORDINATE_RANGE } from "./dimensions";
import type { HallAttrSpec } from "./types";

/**
 * The hall vocabulary (plan 061, decision 5): what each tag is and which
 * attributes it reads. Lookups go through `Map`s, never plain objects
 * indexed by untrusted strings.
 */

/** What a tag is, which decides where it may stand and how it lays out. */
export type HallTagRole =
  | "root"
  | "row"
  | "floor"
  | "caption"
  | "door"
  | "placeable"
  | "host"
  | "label";

/** A tag's role and its own attributes. */
export interface HallTagSpec {
  role: HallTagRole;
  attributes: ReadonlyMap<string, HallAttrSpec>;
}

/** Named points on a box: `at` on the parent, `anchor` on the object. */
export const HALL_POINTS = [
  "centre",
  "north",
  "south",
  "east",
  "west",
  "northEast",
  "northWest",
  "southEast",
  "southWest",
] as const;
export type HallPoint = (typeof HALL_POINTS)[number];

/**
 * Each point as a fraction of the box's half-size from its centre. North is
 * the low-x side and East the low-y side: the floor frame runs x North →
 * South and y East → West (decision 4).
 */
export const HALL_POINT_OFFSETS: ReadonlyMap<
  HallPoint,
  readonly [number, number]
> = new Map([
  ["centre", [0, 0]],
  ["north", [-1, 0]],
  ["south", [1, 0]],
  ["east", [0, -1]],
  ["west", [0, 1]],
  ["northEast", [-1, -1]],
  ["northWest", [-1, 1]],
  ["southEast", [1, -1]],
  ["southWest", [1, 1]],
]);

export const LABEL_POSITIONS = ["top", "bottom", "left", "right"] as const;
export type LabelPosition = (typeof LABEL_POSITIONS)[number];

export const BANNER_SIDES = ["east", "north", "south", "west"] as const;
export type BannerSide = (typeof BANNER_SIDES)[number];

/** The named colours art attributes may use; never raw CSS or URLs. */
export const HALL_COLOURS: ReadonlyMap<string, string> = new Map([
  ["none", "none"],
  ["white", "#ffffff"],
  ["black", "#000000"],
  ["red", "#e00000"],
  ["blue", "#2050c0"],
  ["yellow", "#ffe000"],
  ["gold", "#d4a017"],
  ["green", "#108010"],
  ["grey", "#888888"],
]);
const COLOUR_NAMES = [...HALL_COLOURS.keys()];

const number = (min: number, max: number): HallAttrSpec => ({
  kind: "number",
  min,
  max,
});
const enumOf = (values: readonly string[]): HallAttrSpec => ({
  kind: "enum",
  values,
});
const text: HallAttrSpec = { kind: "string", maxLength: 200 };
const flag: HallAttrSpec = { kind: "boolean" };

export { COORDINATE_RANGE };
/** The scale range the resolver clamps to. */
export const SCALE_RANGE = [0.05, 10] as const;
/** The size range for `w`, `h` and widths, in squares. */
export const SIZE_RANGE = [0.1, 48] as const;

const coordinate = number(...COORDINATE_RANGE);
const size = number(...SIZE_RANGE);

/** Attributes every placeable reads. */
export const PLACEABLE_ATTRIBUTES: ReadonlyMap<string, HallAttrSpec> = new Map([
  ["x", coordinate],
  ["y", coordinate],
  ["at", enumOf([...HALL_POINTS, "center"])],
  ["anchor", enumOf([...HALL_POINTS, "center"])],
  ["scale", number(...SCALE_RANGE)],
  ["label", text],
  ["labelPos", enumOf(LABEL_POSITIONS)],
]);

const placeable = (
  role: "placeable" | "host",
  own: [string, HallAttrSpec][] = [],
): HallTagSpec => ({
  role,
  attributes: new Map([...PLACEABLE_ATTRIBUTES, ...own]),
});

export const CROSS_FORMS = [
  "latin",
  "calvary",
  "greek",
  "greekFiveSquares",
  "fourTriangles",
] as const;
export type CrossForm = (typeof CROSS_FORMS)[number];

/** Every tag the package knows. Art may add more through the registry. */
export const HALL_TAGS: ReadonlyMap<string, HallTagSpec> = new Map<
  string,
  HallTagSpec
>([
  [
    "gdHall",
    {
      role: "root",
      attributes: new Map([
        ["dais", number(0, 16)],
        ["wall", enumOf(["plain", "gradient"])],
        ["compass", flag],
        ["padding", number(0, 16)],
        ["labelSize", number(0.05, 4)],
        ["margin", number(0, 48)],
        ["marginNorth", number(0, 48)],
        ["marginSouth", number(0, 48)],
        ["marginEast", number(0, 48)],
        ["marginWest", number(0, 48)],
      ]),
    },
  ],
  [
    "dais",
    {
      role: "row",
      attributes: new Map([["spread", enumOf(["even", "ends"])]]),
    },
  ],
  [
    "banners",
    {
      role: "row",
      attributes: new Map([
        ["side", enumOf(BANNER_SIDES)],
        ["spread", enumOf(["even", "ends"])],
      ]),
    },
  ],
  ["floor", { role: "floor", attributes: new Map() }],
  ["caption", { role: "caption", attributes: new Map([["text", text]]) }],
  [
    "door",
    {
      role: "door",
      // A door stands in a wall, so along it on the floor's 0–16.
      attributes: new Map([
        ["x", number(0, 16)],
        ["y", number(0, 16)],
        ["width", number(0, 16)],
        ["side", enumOf(BANNER_SIDES)],
      ]),
    },
  ],
  ["officer", placeable("placeable", [["role", text]])],
  ["lamen", placeable("placeable", [["role", text]])],
  [
    "marker",
    placeable("placeable", [
      ["text", text],
      ["shape", enumOf(["box", "circle"])],
    ]),
  ],
  ["altar", placeable("host")],
  [
    "platform",
    placeable("host", [
      ["w", size],
      ["h", size],
    ]),
  ],
  [
    "throne",
    placeable("host", [
      ["w", size],
      ["h", size],
    ]),
  ],
  [
    "board",
    placeable("host", [
      ["kind", text],
      ["w", size],
      ["h", size],
    ]),
  ],
  [
    "pillar",
    placeable("placeable", [
      ["kind", enumOf(["black", "white"])],
      ["glow", flag],
    ]),
  ],
  ["banner", placeable("placeable", [["kind", enumOf(["east", "west"])]])],
  ["hebrewLetter", placeable("placeable", [["letter", text]])],
  [
    "item",
    placeable("placeable", [
      ["kind", text],
      ["form", enumOf(CROSS_FORMS)],
      ["dir", enumOf(["up", "down"])],
      ["fill", enumOf(COLOUR_NAMES)],
      ["stroke", enumOf(COLOUR_NAMES)],
    ]),
  ],
  [
    "label",
    {
      role: "label",
      attributes: new Map([
        ["text", text],
        ["pos", enumOf(LABEL_POSITIONS)],
        ["width", size],
        ["size", number(0.05, 4)],
        ["x", coordinate],
        ["y", coordinate],
        ["at", enumOf([...HALL_POINTS, "center"])],
        ["anchor", enumOf([...HALL_POINTS, "center"])],
      ]),
    },
  ],
]);

/**
 * `Object.prototype`'s identifier names: looked up in a plain object (the
 * reader's block registry, an inventory table), `toString` would be found
 * as a function.
 */
const OBJECT_PROTOTYPE_NAMES = [
  "constructor",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "toString",
  "valueOf",
];

/**
 * Tags a hall may not use (decision 2): `text` would compile to a
 * json-rich-text text node, the others the reader, the offline inventory
 * or the ritual Pug codec treat specially (`say` and `do` parse as tasks,
 * Pug's keywords as statements); `img` waits for its own design. The
 * compiler keeps its own copy of this list, since it may not import this
 * package; an app test holds the two in step. See also `reservedTag`.
 */
export const RESERVED_TAGS: ReadonlySet<string> = new Set([
  "text",
  "title",
  "grade",
  "footnote",
  "footnotes",
  "task",
  "span",
  "img",
  "stylesheet",
  "cursor",
  "say",
  "do",
  "if",
  "else",
  "unless",
  "case",
  "when",
  "default",
  "each",
  "for",
  "while",
  "extends",
  "extend",
  "include",
  "doctype",
  "mixin",
  "block",
  "append",
  "prepend",
  "yield",
  "filter",
  "script",
  "style",
  ...OBJECT_PROTOTYPE_NAMES,
]);

/**
 * Whether a hall may not use `tag`: a reserved name, a name the Pug codec
 * keeps for its wrappers (`ritual` followed by a capital), or one that
 * begins with `doctype`, which Pug reads as a doctype whatever follows.
 */
export function reservedTag(tag: string): boolean {
  return (
    RESERVED_TAGS.has(tag) || /^ritual[A-Z]/.test(tag) || /^doctype/.test(tag)
  );
}

/**
 * Attribute names a hall node may not carry (decisions 2 and 5): the tree's
 * own keys, `style`, every resource name the offline asset inventory
 * follows, any of which would stop publication, and `Object.prototype`'s
 * names.
 */
export const RESERVED_ATTRIBUTES: ReadonlySet<string> = new Set([
  "type",
  "children",
  "id",
  "style",
  "src",
  "srcSet",
  "srcset",
  "href",
  "xlinkHref",
  "poster",
  "data",
  "background",
  "dangerouslySetInnerHTML",
  ...OBJECT_PROTOTYPE_NAMES,
]);

/** Tag and attribute names the Pug printer can always write back. */
export const IDENTIFIER = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * Officer roles: the ritual role keys (`src/doc/ritualBlocks/roles.tsx`)
 * and the adepts the plan adds, with their display names.
 */
export const HALL_ROLES: ReadonlyMap<string, string> = new Map([
  ["imperator", "Imperator"],
  ["cancellarius", "Cancellarius"],
  ["praemonstrator", "Praemonstrator"],
  ["hierophant", "Hierophant"],
  ["pastHierophant", "Past Hierophant"],
  ["hiereus", "Hiereus"],
  ["hegemon", "Hegemon"],
  ["keryx", "Keryx"],
  ["stolistes", "Stolistes"],
  ["dadouchos", "Dadouchos"],
  ["sentinel", "Sentinel"],
  ["chiefAdept", "Chief Adept"],
  ["secondAdept", "Second Adept"],
  ["thirdAdept", "Third Adept"],
]);

/** A role's display name; unknown roles are split at capitals. */
export function roleName(role: string): string {
  const known = HALL_ROLES.get(role);
  if (known) return known;
  const words = role.replace(/([a-z])([A-Z])/g, "$1 $2");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Normalises the `center` spelling of `centre`. */
export function hallPoint(value: string | undefined): HallPoint | undefined {
  if (value === undefined) return undefined;
  return value === "center" ? "centre" : (value as HallPoint);
}

/** Item kinds the package draws itself; the registry may add more. */
export const CORE_ITEM_KINDS: ReadonlySet<string> = new Set([
  "cross",
  "triangle",
  "pentagram",
]);

/** The deepest nesting the validator and the resolver follow. */
export const MAX_HALL_DEPTH = 24;
/** The most nodes the validator and the resolver visit. */
export const MAX_HALL_NODES = 4000;
