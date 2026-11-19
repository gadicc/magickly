import type { ElementId } from "../alchemy/Elements.ts";
import type { PlanetId } from "../astrology/Planets.ts";
import {
  DEFAULT_TABLET_VERSION,
  type EnochianTablet,
  TABLET_VERSIONS,
  type TabletVersionId,
  type TabletView,
  tabletVersion,
} from "./Tablets.ts";

/**
 * The names read off a Watchtower (plan 090, decision 3), computed from a
 * version's letters as `astrology/kameas` computes its squares: each name
 * is a fixed path of squares, the same on all four Watchtowers and in
 * every version, so it is read, not written out. Where the paths come
 * from, and the spellings the sources print that no path gives, are in
 * `magick-data/enochian/tabletNotes` (`nameRules`, `citedSpellings`).
 *
 * Squares are counted from 0, as the readings count them; the Great Cross
 * is row 6 and columns 5 and 6. A Watchtower's 38 names:
 *
 * - **the three holy names**, row 6 read as 3, 4 and 5 letters;
 * - **the King**: in the Golden Dawn's versions eight squares in a whirl
 *   round the centre (6,4; 5,5; 5,6; 6,7; 7,6; 7,5; 6,5; 6,6). Dee's
 *   record gives the first six and one of the two centre letters, so in
 *   Dee's and Raphael's versions the King has two spellings (Bataiva and
 *   Bataivh on Air);
 * - **the six Seniors**, seven letters each, read from the centre
 *   outwards: along row 6 leftward from column 6 and rightward from
 *   column 5, and up and down columns 5 and 6 from row 6;
 * - in each **quarter** (6 rows of 5 squares the Great Cross leaves), the
 *   Calvary cross's column (its middle column, six letters down) and row
 *   (its second row, five across), the top row less the column's square
 *   (the Kerubic squares, four letters) and the four servient rows below
 *   the cross bar, four letters each without the column's square.
 */

/** The four quarters of a Watchtower, by place. */
export type TabletQuarter =
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

/** The quarters in order: top left, top right, bottom left, bottom right. */
export const TABLET_QUARTERS: readonly TabletQuarter[] = Object.freeze([
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
] as const);

/** What a name is, by where it is read. */
export type TabletNameKind =
  | "holyName"
  | "king"
  | "senior"
  | "crossColumn"
  | "crossRow"
  | "topRow"
  | "servient";

/** A square, by row and column from 0. */
export interface TabletSquare {
  readonly row: number;
  readonly column: number;
}

/**
 * What the Golden Dawn attributes to a name (Regardie 1940, vol. 4, p.278;
 * `nameRules` cites it): a quarter's element, by the quarter's place, and
 * the Seniors' and the King's planets. Ids of `alchemy/elements` and
 * `astrology/planets`.
 */
export interface TabletNameAttribution {
  readonly element?: ElementId & ("air" | "water" | "earth" | "fire");
  readonly planet?: PlanetId &
    ("sol" | "mars" | "venus" | "jupiter" | "mercury" | "luna" | "saturn");
}

/** One name of a Watchtower in one version. */
export interface TabletName {
  /**
   * Where the name is read, the same on every Watchtower and in every
   * version (`TABLET_NAME_IDS`): `holy-1` to `holy-3` from the left;
   * `king`; `senior-row-left`, `senior-row-right`, `senior-col6-up`,
   * `senior-col6-down`, `senior-col7-up` and `senior-col7-down`, by the
   * line read and its direction, columns counted from 1 as the sources
   * count them; and in each quarter (`top-left`, `top-right`,
   * `bottom-left`, `bottom-right`) `<quarter>-cross-column`,
   * `<quarter>-cross-row`, `<quarter>-top-row` and `<quarter>-servient-1`
   * to `-4` from the top. No id moves, so an id may name a name in a URL
   * or a file.
   */
  readonly id: TabletNameId;
  readonly kind: TabletNameKind;
  /** The quarter the name lies in; none for the Great Cross's names. */
  readonly quarter?: TabletQuarter;
  /**
   * The squares in reading order. Dee's and Raphael's King: the six
   * squares of the whirl, then the two centre squares, of which each of
   * its `spellings` takes one.
   */
  readonly squares: readonly TabletSquare[];
  /**
   * The version's letters along the path, as the version has them (case
   * included), an empty square as `?`. Dee's and Raphael's King: the
   * first of its `spellings`, with the A.
   */
  readonly spelling: string;
  /**
   * Dee's and Raphael's King only: the six squares of the whirl with each
   * centre letter, the left (A on Air) first, then the right (H).
   */
  readonly spellings?: readonly string[];
  /**
   * A top row's rotations, in every version, and a servient row's, in the
   * Golden Dawn's versions only: each one letter further left (RZLA, ZLAR,
   * LARZ, ARZL), the first being `spelling`. They are the one name's, not
   * names of their own. Dee's record rotates the four above each cross
   * (Casaubon 1659, p.178); the servient rotations are the Golden Dawn's
   * (Regardie 1940, vol. 4, pp.325-326).
   */
  readonly rotations?: readonly string[];
  /** The Golden Dawn's attribution, in its versions only. */
  readonly attribution?: TabletNameAttribution;
}

/**
 * Each quarter's prefix in a name's id (`top-left-cross-column`): the
 * quarter in kebab case.
 */
export const TABLET_QUARTER_ID_PREFIXES: Readonly<
  Record<
    TabletQuarter,
    "top-left" | "top-right" | "bottom-left" | "bottom-right"
  >
> = Object.freeze({
  topLeft: "top-left",
  topRight: "top-right",
  bottomLeft: "bottom-left",
  bottomRight: "bottom-right",
});

/** A quarter's first row and column. */
const QUARTER_ORIGINS: Readonly<
  Record<TabletQuarter, readonly [number, number]>
> = Object.freeze({
  topLeft: [0, 0],
  topRight: [0, 7],
  bottomLeft: [7, 0],
  bottomRight: [7, 7],
});

/** The Golden Dawn's element of each quarter. */
const QUARTER_ELEMENTS: Readonly<
  Record<TabletQuarter, NonNullable<TabletNameAttribution["element"]>>
> = Object.freeze({
  topLeft: "air",
  topRight: "water",
  bottomLeft: "earth",
  bottomRight: "fire",
});

/** The Seniors: their lines, from the centre outwards, and planets. */
const SENIORS = Object.freeze([
  // Regardie 1940, vol. 4, p.277's order.
  { line: "row-left", planet: "mars", at: (step: number) => [6, 6 - step] },
  { line: "col6-up", planet: "jupiter", at: (step: number) => [6 - step, 5] },
  { line: "col7-up", planet: "luna", at: (step: number) => [6 - step, 6] },
  { line: "row-right", planet: "venus", at: (step: number) => [6, 5 + step] },
  {
    line: "col6-down",
    planet: "mercury",
    at: (step: number) => [6 + step, 5],
  },
  {
    line: "col7-down",
    planet: "saturn",
    at: (step: number) => [6 + step, 6],
  },
] as const);

/** A Senior's id, by its line. */
type SeniorId =
  | "senior-row-left"
  | "senior-row-right"
  | "senior-col6-up"
  | "senior-col6-down"
  | "senior-col7-up"
  | "senior-col7-down";

/** A quarter name's id. */
type QuarterNameId = `${"top" | "bottom"}-${"left" | "right"}-${
  | "cross-column"
  | "cross-row"
  | "top-row"
  | `servient-${1 | 2 | 3 | 4}`}`;

/** A name's id (`TabletName.id`). */
export type TabletNameId =
  | "holy-1"
  | "holy-2"
  | "holy-3"
  | "king"
  | SeniorId
  | QuarterNameId;

/** The King's whirl: the six squares Dee's record gives, then the centre. */
const KING_WHIRL: readonly (readonly [number, number])[] = Object.freeze([
  [6, 4],
  [5, 5],
  [5, 6],
  [6, 7],
  [7, 6],
  [7, 5],
  [6, 5],
  [6, 6],
] as const);

/**
 * The tradition each version's names follow: the Golden Dawn's (`gd`: the
 * eight-square King, the servient rotations and the attributions) or Dee's
 * record (`dee`: the King of six squares and a centre letter, no servient
 * rotations, no attributions). A record over every version, so a new
 * version cannot be added without choosing.
 */
export const TABLET_NAME_TRADITIONS: Readonly<
  Record<TabletVersionId, "gd" | "dee">
> = Object.freeze({
  gd: "gd",
  regardie: "gd",
  equinox: "gd",
  dee: "dee",
  raphael: "dee",
});

/** A name's shape, before any version's letters. */
interface NamePath {
  readonly id: TabletNameId;
  readonly kind: TabletNameKind;
  readonly quarter?: TabletQuarter;
  readonly squares: readonly TabletSquare[];
  /** `topRow` in every version, `servient` in the Golden Dawn's only. */
  readonly rotates?: "always" | "gd";
  readonly attribution?: TabletNameAttribution;
}

const square = (row: number, column: number): TabletSquare =>
  Object.freeze({ row, column });

/** Every path, in the order `tabletNames` gives them. */
const PATHS: readonly NamePath[] = (() => {
  const paths: NamePath[] = [];
  const holy = [
    [0, 3],
    [3, 7],
    [7, 12],
  ] as const;
  holy.forEach(([from, to], index) =>
    paths.push({
      id: `holy-${index + 1}` as TabletNameId,
      kind: "holyName",
      squares: Array.from({ length: to - from }, (_, step) =>
        square(6, from + step),
      ),
    }),
  );
  paths.push({
    id: "king",
    kind: "king",
    squares: KING_WHIRL.map(([row, column]) => square(row, column)),
    attribution: { planet: "sol" },
  });
  for (const { line, planet, at } of SENIORS)
    paths.push({
      id: `senior-${line}`,
      kind: "senior",
      squares: Array.from({ length: 7 }, (_, step) => {
        const [row, column] = at(step);
        return square(row, column);
      }),
      attribution: { planet },
    });
  for (const quarter of TABLET_QUARTERS) {
    const [top, left] = QUARTER_ORIGINS[quarter];
    const prefix = TABLET_QUARTER_ID_PREFIXES[quarter];
    const attribution = { element: QUARTER_ELEMENTS[quarter] };
    const outside = [0, 1, 3, 4].map((offset) => left + offset);
    paths.push({
      id: `${prefix}-cross-column` as TabletNameId,
      kind: "crossColumn",
      quarter,
      squares: Array.from({ length: 6 }, (_, step) =>
        square(top + step, left + 2),
      ),
      attribution,
    });
    paths.push({
      id: `${prefix}-cross-row` as TabletNameId,
      kind: "crossRow",
      quarter,
      squares: Array.from({ length: 5 }, (_, step) =>
        square(top + 1, left + step),
      ),
      attribution,
    });
    paths.push({
      id: `${prefix}-top-row` as TabletNameId,
      kind: "topRow",
      quarter,
      squares: outside.map((column) => square(top, column)),
      rotates: "always",
      attribution,
    });
    for (let index = 1; index <= 4; index++)
      paths.push({
        id: `${prefix}-servient-${index}` as TabletNameId,
        kind: "servient",
        quarter,
        squares: outside.map((column) => square(top + 1 + index, column)),
        rotates: "gd",
        attribution,
      });
  }
  return paths.map((path) =>
    Object.freeze({
      ...path,
      squares: Object.freeze(path.squares),
      ...(path.attribution
        ? { attribution: Object.freeze(path.attribution) }
        : {}),
    }),
  );
})();

/** Every name's id, in the order `tabletNames` gives them: 38. */
export const TABLET_NAME_IDS: readonly TabletNameId[] = Object.freeze(
  PATHS.map((path) => path.id),
);

/** Whether a string is a name's id. */
export function isTabletNameId(id: string): id is TabletNameId {
  return (TABLET_NAME_IDS as readonly string[]).includes(id);
}

/** A word's rotations, each one letter further left, the word first. */
function rotations(word: string): string[] {
  const letters = [...word];
  return letters.map((_, start) =>
    [...letters.slice(start), ...letters.slice(0, start)].join(""),
  );
}

/** A view's letters along squares, an empty square as `?`. */
function read(view: TabletView, squares: readonly TabletSquare[]): string {
  return squares
    .map(({ row, column }) => view.grid[row]?.[column] ?? "?")
    .join("");
}

/** One path in one view. */
function nameOf(view: TabletView, path: NamePath): TabletName {
  const { rotates, attribution, ...shape } = path;
  const name: {
    -readonly [K in keyof TabletName]: TabletName[K];
  } = { ...shape, spelling: read(view, path.squares) };
  const tradition = TABLET_NAME_TRADITIONS[view.version];
  if (path.kind === "king" && tradition === "dee") {
    const six = read(view, path.squares.slice(0, 6));
    const spellings = path.squares
      .slice(6)
      .map((centre) => six + read(view, [centre]));
    name.spelling = spellings[0];
    name.spellings = Object.freeze(spellings);
  }
  if (rotates === "always" || (rotates === "gd" && tradition === "gd"))
    name.rotations = Object.freeze(rotations(name.spelling));
  if (attribution && tradition === "gd") name.attribution = attribution;
  return Object.freeze(name);
}

const cache = new WeakMap<TabletView, readonly TabletName[]>();

/**
 * A Watchtower's 38 names in one version, in the order of
 * `TABLET_NAME_IDS`: the holy names, the King, the Seniors (in the order
 * of Regardie 1940, vol. 4, p.277: row 7 leftward, column 6 up, column 7
 * up, row 7 rightward, column 6 down, column 7 down), then each quarter
 * from the top left, its cross's column and row, its top row and its
 * four servient rows. The Tablet of Union has no names here yet: its view
 * gives none. The result is frozen, and the same array for the same view.
 */
export function tabletNames(view: TabletView): readonly TabletName[] {
  if (view.kind !== "watchtower") return Object.freeze([]);
  let names = cache.get(view);
  if (!names) {
    names = Object.freeze(PATHS.map((path) => nameOf(view, path)));
    cache.set(view, names);
  }
  return names;
}

/** One name of a view by its id, if the view has it. */
export function findTabletName(
  view: TabletView,
  id: string,
): TabletName | undefined {
  return tabletNames(view).find((name) => name.id === id);
}

/** Another version's reading of a name (`tabletNameVariants`). */
export interface TabletNameVariant {
  /** The first listed version's spelling. */
  readonly spelling: string;
  /** Its `spellings`, where the name has two (Dee's and Raphael's King). */
  readonly spellings?: readonly string[];
  /** The versions that read it so, in the order of `TABLET_VERSIONS`. */
  readonly versions: readonly TabletVersionId[];
}

/** A spelling folded for comparison: its case, and u for v, once one letter. */
const folded = (spelling: string) =>
  spelling.toLowerCase().replaceAll("v", "u");

/**
 * How the other versions read a name of a tablet, for display: each
 * version's whole reading of the path, never a mixture of letters from
 * several. It hides differences of case alone and of u for v alone (once
 * one letter): a version whose reading differs from `version`'s only so is
 * left out, and versions that read alike so are listed together under the
 * first one's letters, so a version not listed reads the name as `version`
 * does. For every reading as it stands, to look a name up by, see
 * `tabletNameSpellings`.
 * Nothing for the Tablet of Union, a version without the tablet or an id
 * that is not a name's.
 */
export function tabletNameVariants(
  tablet: EnochianTablet,
  id: string,
  version: TabletVersionId = DEFAULT_TABLET_VERSION,
): readonly TabletNameVariant[] {
  const keyOf = (name: TabletName) =>
    (name.spellings ?? [name.spelling]).map(folded).join(" ");
  const own = tabletVersion(tablet, version);
  const mine = own && findTabletName(own, id);
  if (!mine) return Object.freeze([]);
  const variants: { key: string; variant: TabletNameVariant }[] = [];
  for (const other of TABLET_VERSIONS) {
    if (other === version) continue;
    const view = tabletVersion(tablet, other);
    const name = view && findTabletName(view, id);
    if (!name) continue;
    const key = keyOf(name);
    if (key === keyOf(mine)) continue;
    const found = variants.find((each) => each.key === key);
    if (found)
      found.variant = {
        ...found.variant,
        versions: [...found.variant.versions, other],
      };
    else
      variants.push({
        key,
        variant: {
          spelling: name.spelling,
          ...(name.spellings ? { spellings: name.spellings } : {}),
          versions: [other],
        },
      });
  }
  return Object.freeze(
    variants.map(({ variant }) =>
      Object.freeze({ ...variant, versions: Object.freeze(variant.versions) }),
    ),
  );
}

/**
 * Every spelling of a name of a tablet, to look it up by (a dictionary
 * link, plan 090 decision 4): `version`'s spelling or spellings first,
 * then each other version's in the order of `TABLET_VERSIONS`, as each
 * version has them, case included, each spelling once. Nothing is folded
 * or left out for differing only in case or u for v; compare as the
 * lookup needs. Nothing for the Tablet of Union, a version without the
 * tablet or an id that is not a name's.
 */
export function tabletNameSpellings(
  tablet: EnochianTablet,
  id: string,
  version: TabletVersionId = DEFAULT_TABLET_VERSION,
): readonly string[] {
  const order = [
    version,
    ...TABLET_VERSIONS.filter((other) => other !== version),
  ];
  const own = tabletVersion(tablet, version);
  if (!own || !findTabletName(own, id)) return Object.freeze([]);
  const found: string[] = [];
  for (const each of order) {
    const view = tabletVersion(tablet, each);
    const name = view && findTabletName(view, id);
    for (const spelling of name ? (name.spellings ?? [name.spelling]) : [])
      if (!found.includes(spelling)) found.push(spelling);
  }
  return Object.freeze(found);
}
