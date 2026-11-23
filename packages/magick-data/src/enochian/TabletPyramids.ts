import elements, { type ElementId } from "../alchemy/Elements.ts";
import { type DecanId, decansOf } from "../astrology/decans.ts";
import planets, { type PlanetId } from "../astrology/Planets.ts";
import zodiac, { type ZodiacId } from "../astrology/Zodiac.ts";
import godForms, { type GDGodFormId } from "../gd/GodForms.ts";
import type { TetragramID } from "../geomancy/Tetragrams.ts";
import type { HebrewLetterId } from "../HebrewLetters.ts";
import kerubim, { type KerubId } from "../kabbalah/Kerubim.ts";
import paths, { type PathId } from "../kabbalah/Paths.ts";
import sephirot, { type SephirahId } from "../kabbalah/Sephirot.ts";
import {
  COURT_RANKS,
  type CourtRank,
  type MinorCardId,
  minorCardId,
  type SmallCardNumber,
  suitOfElement,
} from "../tarot/minorCards.ts";
import {
  findTabletName,
  TABLET_QUARTER_ELEMENTS,
  TABLET_QUARTER_ID_PREFIXES,
  type TabletNameId,
  type TabletQuarter,
  type TabletSquare,
  type TabletUnionLetter,
} from "./TabletNames.ts";
import type {
  EnochianWatchtowerID,
  TabletVersionId,
  TabletView,
} from "./Tablets.ts";

/**
 * The Golden Dawn's truncated pyramids on the Enochian tablets (plan 095,
 * decision 1), computed rather than written out, as the names are: every
 * square of the four Watchtowers and of the Tablet of Union is a pyramid
 * whose four sides (triangles) each carry an element and an attribution,
 * and whose flat top carries the square's letter (Regardie, *The Golden
 * Dawn*, vol. 4, Chicago, 1940, p.291, archive.org
 * `IsraelRegardie-TheGoldenDawn-Vol4-1940`, leaf n283; "Liber Chanokh",
 * *The Equinox* I(7), London, 1912, p.237 and Plates IV to VIII, archive.org
 * `crowley-equinox_202110`, leaves n249 and n242 to n246). The attributions
 * are a rule over positions, not letters, so a version's letters never
 * change them; only the Calvary cross's bar differs between versions
 * (`CALVARY_BARS`). Dee's and Raphael's versions have none: Dee's tables
 * carry no elements.
 *
 * The sides are numbered as vol. 4 numbers them (p.293, leaf n285): 1 the
 * left, 2 the top, 3 the right, 4 the bottom. Squares are counted from 0,
 * as the readings and `tabletNames` count them. Where each rule comes from,
 * and where the witnesses depart from it, is in
 * `magick-data/enochian/tabletNotes` (`pyramidRules`, `pyramidExceptions`).
 *
 * Ids, not colours or glyphs: of `alchemy/elements` (with Spirit), the
 * zodiac, `astrology/decans`, the planets, the sephirot, the paths (whose
 * `hermetic` trump is a side's), the Hebrew letters, `tarot/minorCards`,
 * the geomantic figures, the Kerubim and `gd/godForms`.
 */

/** A square of a tablet, by where it lies (the region rule, `tabletRegion`). */
export type TabletPyramidRegion =
  | "greatCross"
  | "calvaryCross"
  | "kerubic"
  | "servient"
  | "union";

/** A Watchtower's regions, in the order `tabletRegion` tests them. */
export const WATCHTOWER_REGIONS: readonly [
  "greatCross",
  "calvaryCross",
  "kerubic",
  "servient",
] = Object.freeze([
  "greatCross",
  "calvaryCross",
  "kerubic",
  "servient",
] as const);

/** A Watchtower's region. */
export type WatchtowerRegion = (typeof WATCHTOWER_REGIONS)[number];

/**
 * The region of a Watchtower's square, by row and column from 0 (vol. 4,
 * pp.282–289): the Great Cross (row 6, columns 5 and 6, 36 squares); in
 * each quarter of 6 rows by 5 squares, its Calvary cross (its middle
 * column and its second row, 10 squares), its Kerubic squares (the rest of
 * its top row, 4) and its servient squares (the 16 below the cross's bar,
 * either side of its column). The one rule: `magick-components`' drawing is
 * held to it. Nothing for a place outside a Watchtower's 13 rows and 12
 * columns, as `tabletPyramid` gives nothing there.
 */
export function tabletRegion(
  row: number,
  column: number,
): WatchtowerRegion | undefined {
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(column) ||
    row < 0 ||
    row > 12 ||
    column < 0 ||
    column > 11
  )
    return undefined;
  if (row === 6 || column === 5 || column === 6) return "greatCross";
  const quarterRow = row < 6 ? row : row - 7;
  const quarterColumn = column < 5 ? column : column - 7;
  if (quarterColumn === 2 || quarterRow === 1) return "calvaryCross";
  return quarterRow === 0 ? "kerubic" : "servient";
}

/**
 * One of the four elements, without Spirit: what a letter of the Name, a
 * quarter, a planet or a line of the Tablet of Union gives. A side's
 * element may also be Spirit, so a side's `elementId` is an `ElementId` of
 * `alchemy/elements`, which has the five.
 */
export type PyramidElement = Exclude<ElementId, "spirit">;

/**
 * The letters of the Name, YHVH, by which the tablets are divided: Yod,
 * He, Vau and He final (vol. 4, pp.282–284). Ids of the Name's four
 * letters, not `HebrewLetterId`s: the Name has two He's, which the Golden
 * Dawn tells apart, so its final He is `heFinal`, though in Hebrew it is
 * the same letter as the first (`NAME_LETTER_HEBREW` maps each to its
 * Hebrew letter).
 */
export const NAME_LETTERS: readonly ["yod", "he", "vav", "heFinal"] =
  Object.freeze(["yod", "he", "vav", "heFinal"] as const);

/** A letter of the Name, by its id among the Name's four (not a `HebrewLetterId`). */
export type NameLetter = (typeof NAME_LETTERS)[number];

/**
 * Each letter of the Name's Hebrew letter (`hebrewLetters`): the final He
 * is He, as the first is.
 */
export const NAME_LETTER_HEBREW: Readonly<Record<NameLetter, HebrewLetterId>> =
  Object.freeze({
    yod: "yod",
    he: "he",
    vav: "vav",
    heFinal: "he",
  });

/** Each letter of the Name's element (vol. 4, p.288, leaf n280). */
export const NAME_LETTER_ELEMENTS: Readonly<
  Record<NameLetter, PyramidElement>
> = Object.freeze({
  yod: "fire",
  he: "water",
  vav: "air",
  heFinal: "earth",
});

/**
 * Each Watchtower's own letter of the Name, which comes at the top and the
 * left of its Great Cross (vol. 4, pp.282–283, leaves n274–n275).
 */
export const TABLET_NAME_LETTERS: Readonly<
  Record<EnochianWatchtowerID, NameLetter>
> = Object.freeze({
  air: "vav",
  water: "he",
  earth: "heFinal",
  fire: "yod",
});

/**
 * The sixteen Kerubic ranks: each quarter's letters of the Name across its
 * Kerubic squares, left to right, by tablet (vol. 4, p.284, leaf n276).
 * Air's and Water's are the same, as are Earth's and Fire's; the outside
 * square of each is the quarter's own letter.
 */
export const KERUBIC_RANKS: Readonly<
  Record<
    EnochianWatchtowerID,
    Readonly<
      Record<
        TabletQuarter,
        readonly [NameLetter, NameLetter, NameLetter, NameLetter]
      >
    >
  >
> = (() => {
  const airWater = Object.freeze({
    topLeft: Object.freeze(["vav", "he", "yod", "heFinal"] as const),
    topRight: Object.freeze(["yod", "heFinal", "vav", "he"] as const),
    bottomLeft: Object.freeze(["heFinal", "yod", "he", "vav"] as const),
    bottomRight: Object.freeze(["he", "vav", "heFinal", "yod"] as const),
  });
  const earthFire = Object.freeze({
    topLeft: Object.freeze(["vav", "heFinal", "yod", "he"] as const),
    topRight: Object.freeze(["vav", "heFinal", "yod", "he"] as const),
    bottomLeft: Object.freeze(["heFinal", "vav", "he", "yod"] as const),
    bottomRight: Object.freeze(["heFinal", "vav", "he", "yod"] as const),
  });
  return Object.freeze({
    air: airWater,
    water: airWater,
    earth: earthFire,
    fire: earthFire,
  });
})();

/**
 * The qualities of the signs on the Great Cross (vol. 4, p.285, leaf
 * n277), by column and row from 0: cardinal down column 5, mutable down
 * column 6, kerubic (fixed) along row 6, the Linea Spiritus Sancti. (The
 * sources, counting from 1, call them the sixth and seventh columns and
 * the seventh row.)
 */
export const GREAT_CROSS_QUALITIES: Readonly<{
  column5: "cardinal";
  column6: "mutable";
  row6: "kerubic";
}> = Object.freeze({
  column5: "cardinal",
  column6: "mutable",
  row6: "kerubic",
});

/**
 * A servient square's quality by its rank's letter (vol. 4, p.289, leaf
 * n281): Yod cardinal, He kerubic, Vau mutable; He final gives the
 * column's element itself, Earth as Saturn.
 */
export const RANK_QUALITIES: Readonly<
  Record<NameLetter, "cardinal" | "kerubic" | "mutable" | "element">
> = Object.freeze({
  yod: "cardinal",
  he: "kerubic",
  vav: "mutable",
  heFinal: "element",
});

/**
 * The element each planet rules, which colours the side that carries it
 * (vol. 4, p.294, leaf n286): the Sun and Jupiter Fire, Saturn and
 * Mercury Air, Venus and the Moon Earth, Mars Water.
 */
export const PLANET_ELEMENTS: Readonly<
  Record<
    "sol" | "jupiter" | "saturn" | "mercury" | "venus" | "luna" | "mars",
    PyramidElement
  >
> = Object.freeze({
  sol: "fire",
  jupiter: "fire",
  saturn: "air",
  mercury: "air",
  venus: "earth",
  luna: "earth",
  mars: "water",
});

/**
 * The six Sephiroth of a Calvary cross that carry a planet, with the
 * planet's trump (vol. 4, pp.287–288, leaves n279–n280): Kether Jupiter,
 * Chokmah Mercury, Binah the Moon, Chesed Venus, Geburah Mars, Tiphareth
 * the Sun. Not the planets `kabbalah/sephirot` gives the Sephiroth; no
 * Saturn. The trump and Hebrew letter are the planet's (`hebrewLetterId`,
 * and the path of that letter), as p.298's table has them.
 */
export const CALVARY_PLANETS: Readonly<Partial<Record<SephirahId, PlanetId>>> =
  Object.freeze({
    keter: "jupiter",
    chochmah: "mercury",
    binah: "luna",
    hesed: "venus",
    gevurah: "mars",
    tiferet: "sol",
  });

/**
 * A Calvary cross's column, from the top (vol. 4, pp.287–288 and p.290;
 * vol. 1, p.157; the Equinox's plates): Kether, Tiphareth where it crosses
 * the bar, then Netzach, Hod, Yesod and Malkuth. Every witness agrees.
 */
export const CALVARY_COLUMN: readonly SephirahId[] = Object.freeze([
  "keter",
  "tiferet",
  "netzach",
  "hod",
  "yesod",
  "malchut",
]);

/**
 * A Calvary cross's bar, left to right, in each version (plan 095,
 * decision 2), the one place the witnesses disagree: the Golden Dawn's and
 * Regardie's versions take vol. 4's diagram of the Earth angle of the
 * Water tablet (p.290, leaf n282) and the Ten Squares badge of the 27th
 * Path (vol. 1, Chicago, 1937, p.157, archive.org
 * `IsraelRegardie-thegoldenDawn-vol1-1937`, leaf n148), Binah, Geburah,
 * Tiphareth, Chesed and Chokmah; the Equinox's takes its plates (Plates
 * IV–VII, every lesser angle), Geburah, Binah, Tiphareth, Chokmah and
 * Chesed, which vol. 4's worked square, the O of OMEBB (p.302, leaf n294),
 * agrees with. Dee's and Raphael's versions have no pyramids (`null`). A
 * record over every version, so a new one cannot be added without
 * choosing.
 */
export const CALVARY_BARS: Readonly<
  Record<TabletVersionId, readonly SephirahId[] | null>
> = (() => {
  const badge = Object.freeze([
    "binah",
    "gevurah",
    "tiferet",
    "hesed",
    "chochmah",
  ] as const);
  return Object.freeze({
    gd: badge,
    regardie: badge,
    equinox: Object.freeze([
      "gevurah",
      "binah",
      "tiferet",
      "chochmah",
      "hesed",
    ] as const),
    dee: null,
    raphael: null,
  });
})();

/**
 * The Order's court card on a Kerubic square, by the square's letter of
 * the Name, of the quarter's suit (vol. 4, p.288, leaf n280): Yod the
 * King, He the Queen, Vau the Prince, He final the Princess.
 */
export const COURT_BY_LETTER: Readonly<Record<NameLetter, CourtRank>> =
  Object.freeze({
    yod: COURT_RANKS[0],
    he: COURT_RANKS[1],
    vav: COURT_RANKS[2],
    heFinal: COURT_RANKS[3],
  });

/**
 * The Tablet of Union's columns: each one's element on side 1 (Spirit in
 * the first; vol. 4, p.296, leaf n288) and its card, of the line's suit
 * (p.290, leaf n282): the Aces, then the Prince, Queen, Princess and
 * King.
 */
export const UNION_COLUMNS: readonly {
  readonly elementId: ElementId;
  readonly rank: "ace" | CourtRank;
}[] = Object.freeze([
  Object.freeze({ elementId: "spirit", rank: "ace" }),
  Object.freeze({ elementId: "air", rank: "prince" }),
  Object.freeze({ elementId: "water", rank: "queen" }),
  Object.freeze({ elementId: "earth", rank: "princess" }),
  Object.freeze({ elementId: "fire", rank: "king" }),
] as const);

/** The Tablet of Union's lines' elements, from the top (vol. 4, p.290). */
export const UNION_LINES: readonly PyramidElement[] = Object.freeze([
  "air",
  "water",
  "earth",
  "fire",
] as const);

/**
 * The geomantic figure of each of the sixteen letters a servient square
 * can carry, from the table of attributions by Hebrew letter (vol. 4,
 * p.298, leaf n290): the twelve signs' and the four elements', Earth's as
 * Saturn's Tav. From the table, not from `geomancy/tetragrams`' `zodiacId`,
 * which gives Cancer both Populus and Via and Leo both Fortunae.
 */
export const GEOMANTIC_FIGURES: Readonly<
  Partial<Record<HebrewLetterId, TetragramID>>
> = Object.freeze({
  he: "puer",
  vav: "amissio",
  zayin: "albus",
  het: "populus",
  tet: "fortuna_major",
  yod: "conjunctio",
  lamed: "puella",
  nun: "rubeus",
  samekh: "acquisitio",
  ayin: "carcer",
  tsadi: "tristitia",
  qof: "laetitia",
  alef: "fortuna_minor",
  mem: "via",
  shin: "cauda_draconis",
  tav: "caput_draconis",
});

/** What a side carries besides its element: ids of the package's tables. */
export interface TabletPyramidAttribution {
  /**
   * A sign: a Great Cross square's (side 1), a Kerubic square's Kerub's
   * kerubic sign (side 3), a servient square's (side 1).
   */
  readonly zodiacId?: ZodiacId;
  /** A Great Cross square's decan of its sign (side 1). */
  readonly decanId?: DecanId;
  /**
   * A planet: a Great Cross square's decan's (side 3), a Calvary square's
   * (side 4, on six), Saturn for Earth on a servient square (side 1):
   * there, beside `elementId` Earth, Saturn is the symbol drawn (vol. 4,
   * p.290's diagram, leaf n282), and Tav its letter (p.298).
   */
  readonly planetId?: PlanetId;
  /** An element as the symbol: a servient square of rank He final (side 1). */
  readonly elementId?: PyramidElement;
  /** A Calvary square's Sephirah (side 4). */
  readonly sephirahId?: SephirahId;
  /**
   * A trump, as the path of the Tree it is on (`kabbalah/paths`, whose
   * `hermetic.tarotId` and `tarotTitle` name it): a servient square's
   * (side 2), a Calvary square's planet's (side 4).
   */
  readonly pathId?: PathId;
  /** A Hebrew letter: a servient square's (side 4), a Calvary planet's (4). */
  readonly hebrewLetterId?: HebrewLetterId;
  /**
   * A minor card: a Great Cross square's small card (side 1), a Calvary
   * square's Ace to 10 (side 4), a Kerubic square's court card (side 1), a
   * square of the Tablet of Union's card (side 1).
   */
  readonly minorCardId?: MinorCardId;
  /** A servient square's geomantic figure (side 3). */
  readonly tetragramId?: TetragramID;
  /** A Kerubic square's Kerub (side 3), whose `zodiacId` is its sign. */
  readonly kerubId?: KerubId;
}

/** One side of a pyramid. */
export interface TabletPyramidSide {
  /** Its number: 1 left, 2 top, 3 right, 4 bottom (vol. 4, p.293). */
  readonly side: 1 | 2 | 3 | 4;
  readonly place: "left" | "top" | "right" | "bottom";
  /**
   * Its element, which colours it (p.294). None on a Calvary square's
   * fourth side, which carries its Sephirah, painted white or in the
   * Sephirah's colour.
   */
  readonly elementId?: ElementId;
  readonly attribution: TabletPyramidAttribution;
}

/** The letters of the Name that govern a square. */
export interface TabletPyramidLetters {
  /** A Great Cross square's: its block of three. */
  readonly block?: NameLetter;
  /** A Kerubic or servient square's: its column's, from the Kerubic rank. */
  readonly column?: NameLetter;
  /** A servient square's: its rank's. */
  readonly rank?: NameLetter;
}

/**
 * A servient square's angel or great angel: the rotation of its servient
 * row that starts at the square, from `tabletNames`.
 */
export interface TabletPyramidAngel {
  /** The row's name in `tabletNames`. */
  readonly nameId: TabletNameId;
  /** Which of the name's `rotations`: the square's place in the row, from 0. */
  readonly rotation: number;
  readonly spelling: string;
  /** A great angel's letter of the Tablet of Union, which starts it. */
  readonly unionLetter?: TabletUnionLetter;
}

/** One square of a tablet as a pyramid, in one version. */
export interface TabletPyramid {
  readonly row: number;
  readonly column: number;
  readonly region: TabletPyramidRegion;
  /** The quarter it lies in, on a Watchtower; none on the Great Cross. */
  readonly quarter?: TabletQuarter;
  readonly letters: TabletPyramidLetters;
  /** Sides 1 to 4: left, top, right, bottom. */
  readonly sides: readonly [
    TabletPyramidSide,
    TabletPyramidSide,
    TabletPyramidSide,
    TabletPyramidSide,
  ];
  /** A servient square's angel: its row's rotation from the square. */
  readonly angel?: TabletPyramidAngel;
  /** A servient square's great angel: the same with its Union letter. */
  readonly greatAngel?: TabletPyramidAngel;
  /**
   * A servient square's god (`gd/godForms`), by the mix of its sides'
   * elements (vol. 4, p.315, leaf n307; the Children of Horus by the
   * three elements present, as p.361 has them).
   */
  readonly godFormId?: GDGodFormId;
  /**
   * A servient square's sphinx: the Kerub of each side's element, sides 1
   * to 4 (pp.310–311, leaves n302–n303: side 2 the head, sides 1 and 3 the
   * body and forelimbs, side 4 the hind limbs). Not composed into one
   * figure: the source does not say which of sides 1 and 3 is which part.
   */
  readonly sphinx?: readonly [KerubId, KerubId, KerubId, KerubId];
}

const PLACES = ["left", "top", "right", "bottom"] as const;

type Draft = readonly [
  Omit<TabletPyramidSide, "side" | "place">,
  Omit<TabletPyramidSide, "side" | "place">,
  Omit<TabletPyramidSide, "side" | "place">,
  Omit<TabletPyramidSide, "side" | "place">,
];

function sidesOf(draft: Draft): TabletPyramid["sides"] {
  return Object.freeze(
    draft.map((side, index) =>
      Object.freeze({
        side: (index + 1) as 1 | 2 | 3 | 4,
        place: PLACES[index],
        ...(side.elementId ? { elementId: side.elementId } : {}),
        attribution: Object.freeze({ ...side.attribution }),
      }),
    ),
  ) as unknown as TabletPyramid["sides"];
}

const plain = (elementId: ElementId) => ({
  elementId,
  attribution: {},
});

/** The sign of a quality and an element, from the zodiac table. */
function signOf(
  quality: "cardinal" | "kerubic" | "mutable",
  element: PyramidElement,
): ZodiacId {
  const sign = (Object.keys(zodiac) as ZodiacId[]).find(
    (id) =>
      zodiac[id].quadruplicity === quality && zodiac[id].elementId === element,
  );
  /* c8 ignore next -- every quality has a sign of each element */
  if (!sign) throw new Error(`No ${quality} sign of ${element}`);
  return sign;
}

/** The path whose trump goes with a Hebrew letter (`hermetic`). */
function pathOf(letter: HebrewLetterId): PathId {
  const path = (Object.keys(paths) as PathId[]).find(
    (id) =>
      (paths[id] as { hermetic?: { hebrewLetterId?: string } }).hermetic
        ?.hebrewLetterId === letter,
  );
  /* c8 ignore next -- every simple, double and mother letter has a path */
  if (!path) throw new Error(`No path of ${letter}`);
  return path;
}

/** A planet's Hebrew letter, from the planet table. */
function planetLetter(planet: PlanetId): HebrewLetterId {
  const letter = (planets[planet] as { hebrewLetterId?: HebrewLetterId })
    .hebrewLetterId;
  /* c8 ignore next -- the seven planets of the pyramids have letters */
  if (!letter) throw new Error(`No letter of ${planet}`);
  return letter;
}

/** A quarter's first row and column. */
const QUARTER_ORIGINS: Readonly<
  Record<TabletQuarter, readonly [number, number]>
> = Object.freeze({
  topLeft: [0, 0],
  topRight: [0, 7],
  bottomLeft: [7, 0],
  bottomRight: [7, 7],
});

/** The quarter a Watchtower's square lies in, off the Great Cross. */
function quarterOf(row: number, column: number): TabletQuarter {
  if (row < 6) return column < 5 ? "topLeft" : "topRight";
  return column < 5 ? "bottomLeft" : "bottomRight";
}

/** The Name's letter `steps` back from `letter` (YHVH read leftward). */
function back(letter: NameLetter, steps: number): NameLetter {
  const index = NAME_LETTERS.indexOf(letter);
  return NAME_LETTERS[(((index - steps) % 4) + 4) % 4];
}

/**
 * A Great Cross square (vol. 4, pp.282–287, leaves n274–n279; the Equinox,
 * p.237). Its arm is read in blocks of three squares from the top or the
 * left, the column skipping row 6; block k takes the Name's letter k steps
 * back from the tablet's own, and decan n of the block's sign is its n-th
 * square downward or rightward. Side 1 the sign, with its decan and small
 * card, in the sign's element; 2 Spirit; 3 the decan's planet, in the
 * element it rules; 4 the tablet's element.
 */
function greatCross(
  tablet: EnochianWatchtowerID,
  row: number,
  column: number,
): Pick<TabletPyramid, "letters" | "sides"> {
  const onRow = row === 6;
  const quality = onRow
    ? GREAT_CROSS_QUALITIES.row6
    : column === 5
      ? GREAT_CROSS_QUALITIES.column5
      : GREAT_CROSS_QUALITIES.column6;
  const step = onRow ? column : row < 6 ? row : row - 1;
  const block = back(TABLET_NAME_LETTERS[tablet], Math.floor(step / 3));
  const element = NAME_LETTER_ELEMENTS[block];
  const decan = decansOf(signOf(quality, element))[step % 3];
  return {
    letters: { block },
    sides: sidesOf([
      {
        elementId: element,
        attribution: {
          zodiacId: decan.zodiacId,
          decanId: decan.id,
          minorCardId: decan.minorCardId,
        },
      },
      plain("spirit"),
      {
        elementId: PLANET_ELEMENTS[decan.planetId],
        attribution: { planetId: decan.planetId },
      },
      plain(NAME_LETTER_ELEMENTS[TABLET_NAME_LETTERS[tablet]]),
    ]),
  };
}

/** A Sephirah's number, Kether 1 to Malkuth 10. */
const sephirahNumber = (id: SephirahId) => sephirot[id].index;

/**
 * A Calvary cross's square (vol. 4, pp.287–288, 290 and 294–295, leaves
 * n279–n282 and n286–n287; the Equinox, p.238): side 1 the tablet's
 * element; 2 Spirit; 3 the quarter's element; 4 the Sephirah, with the Ace
 * to 10 of the quarter's suit by its number and, on six, the planet with
 * its trump and Hebrew letter.
 */
function calvaryCross(
  tablet: EnochianWatchtowerID,
  quarter: TabletQuarter,
  bar: readonly SephirahId[],
  row: number,
  column: number,
): Pick<TabletPyramid, "letters" | "sides"> {
  const [top, left] = QUARTER_ORIGINS[quarter];
  const sephirah =
    row - top === 1 ? bar[column - left] : CALVARY_COLUMN[row - top];
  const quarterElement = TABLET_QUARTER_ELEMENTS[quarter];
  const number = sephirahNumber(sephirah);
  const planet = CALVARY_PLANETS[sephirah];
  const letter = planet && planetLetter(planet);
  return {
    letters: {},
    sides: sidesOf([
      plain(NAME_LETTER_ELEMENTS[TABLET_NAME_LETTERS[tablet]]),
      plain("spirit"),
      plain(quarterElement),
      {
        attribution: {
          sephirahId: sephirah,
          minorCardId: minorCardId(
            suitOfElement(quarterElement),
            number === 1 ? "ace" : (number as SmallCardNumber),
          ),
          ...(planet && letter
            ? {
                planetId: planet,
                pathId: pathOf(letter),
                hebrewLetterId: letter,
              }
            : {}),
        },
      },
    ]),
  };
}

/** A quarter's columns off its Calvary cross, left to right. */
const outside = (left: number) => [0, 1, 3, 4].map((offset) => left + offset);

/**
 * A Kerubic square (vol. 4, pp.284 and 288–289, 295, leaves n276,
 * n280–n281, n287): its letter of the Name from the Kerubic rank; side 1
 * the Order's court card of that letter, of the quarter's suit, in the
 * letter's element; 2 the tablet's element; 3 the Kerub of that letter,
 * with its kerubic sign; 4 the quarter's element.
 */
function kerubic(
  tablet: EnochianWatchtowerID,
  quarter: TabletQuarter,
  column: number,
): Pick<TabletPyramid, "letters" | "sides"> {
  const [, left] = QUARTER_ORIGINS[quarter];
  const letter = KERUBIC_RANKS[tablet][quarter][outside(left).indexOf(column)];
  const element = NAME_LETTER_ELEMENTS[letter];
  const quarterElement = TABLET_QUARTER_ELEMENTS[quarter];
  return {
    letters: { column: letter },
    sides: sidesOf([
      {
        elementId: element,
        attribution: {
          minorCardId: minorCardId(
            suitOfElement(quarterElement),
            COURT_BY_LETTER[letter],
          ),
        },
      },
      plain(NAME_LETTER_ELEMENTS[TABLET_NAME_LETTERS[tablet]]),
      {
        elementId: element,
        attribution: {
          kerubId: element,
          zodiacId: kerubim[element].zodiacId as ZodiacId,
        },
      },
      plain(quarterElement),
    ]),
  };
}

/**
 * A servient square (vol. 4, pp.284, 289 and 295, 298, leaves n276, n281,
 * n287, n290): its column takes the letter of the Kerubic square above,
 * and its rank the Kerubic rank's letters read right to left, downward.
 * The column's element and the rank's quality give a sign, or with He
 * final the element itself (Earth as Saturn). Side 1 the tablet's element,
 * with the sign or element; 2 the column's element, with the trump; 3 the
 * quarter's element, with the geomantic figure (p.298); 4 the rank's
 * element, with the trump's Hebrew letter.
 */
function servient(
  tablet: EnochianWatchtowerID,
  quarter: TabletQuarter,
  row: number,
  column: number,
): Pick<TabletPyramid, "letters" | "sides"> {
  const [top, left] = QUARTER_ORIGINS[quarter];
  const ranks = KERUBIC_RANKS[tablet][quarter];
  const columnLetter = ranks[outside(left).indexOf(column)];
  const rankLetter = ranks[ranks.length - 1 - (row - top - 2)];
  const element = NAME_LETTER_ELEMENTS[columnLetter];
  const quality = RANK_QUALITIES[rankLetter];
  let symbol: TabletPyramidAttribution;
  let letter: HebrewLetterId;
  if (quality === "element") {
    const own = (elements[element] as { hebrewLetterId?: HebrewLetterId })
      .hebrewLetterId;
    // Earth has no letter of its own: Saturn's Tav (p.298). Saturn is
    // what is drawn on side 1 (p.290's diagram), with Earth beside it.
    letter = own ?? planetLetter("saturn");
    symbol = own
      ? { elementId: element }
      : { elementId: element, planetId: "saturn" };
  } else {
    const sign = signOf(quality, element);
    letter = zodiac[sign].hebrewLetterId as HebrewLetterId;
    symbol = { zodiacId: sign };
  }
  const figure = GEOMANTIC_FIGURES[letter];
  /* c8 ignore next -- the table has a figure for each of the sixteen */
  if (!figure) throw new Error(`No figure of ${letter}`);
  return {
    letters: { column: columnLetter, rank: rankLetter },
    sides: sidesOf([
      {
        elementId: NAME_LETTER_ELEMENTS[TABLET_NAME_LETTERS[tablet]],
        attribution: symbol,
      },
      { elementId: element, attribution: { pathId: pathOf(letter) } },
      {
        elementId: TABLET_QUARTER_ELEMENTS[quarter],
        attribution: { tetragramId: figure },
      },
      {
        elementId: NAME_LETTER_ELEMENTS[rankLetter],
        attribution: { hebrewLetterId: letter },
      },
    ]),
  };
}

/**
 * A square of the Tablet of Union (vol. 4, pp.290 and 296, leaves n282 and
 * n288; the Equinox, p.238 and Plate VIII): side 1 the column's element,
 * Spirit in the first, with its card of the line's suit; 2 Spirit; 3 the
 * line's element; 4 Spirit.
 */
function union(row: number, column: number): Pick<TabletPyramid, "sides"> {
  const line = UNION_LINES[row];
  const { elementId, rank } = UNION_COLUMNS[column];
  return {
    sides: sidesOf([
      {
        elementId,
        attribution: { minorCardId: minorCardId(suitOfElement(line), rank) },
      },
      plain("spirit"),
      plain(line),
      plain("spirit"),
    ]),
  };
}

/**
 * The god of a mix of elements (vol. 4, p.315): one of each, Osiris; one
 * element on three or four sides, its god; two and two, the pair's; three
 * elements, the Child of Horus of those three.
 */
function godOf(sides: readonly ElementId[]): GDGodFormId {
  const counts = new Map<ElementId, number>();
  for (const side of sides) counts.set(side, (counts.get(side) ?? 0) + 1);
  const most = Math.max(...counts.values());
  const mix =
    counts.size === 4
      ? "each"
      : most >= 3
        ? "single"
        : counts.size === 2
          ? "pair"
          : "three";
  const present = [...counts.keys()].filter(
    (element) => mix !== "single" || counts.get(element) === most,
  );
  const god = (Object.keys(godForms) as GDGodFormId[]).find((id) => {
    const row = godForms[id];
    if (row.mix !== mix) return false;
    if (mix === "each") return true;
    const ids = row.elementIds as readonly string[];
    return (
      ids.length === present.length &&
      present.every((element) => ids.includes(element))
    );
  });
  /* c8 ignore next -- the table covers every mix */
  if (!god) throw new Error(`No god of ${sides.join(", ")}`);
  return god;
}

/** A servient square's angel and great angel, from `tabletNames`. */
function angelsOf(
  view: TabletView,
  quarter: TabletQuarter,
  row: number,
  column: number,
): Pick<TabletPyramid, "angel" | "greatAngel"> {
  const [top, left] = QUARTER_ORIGINS[quarter];
  const id = `${TABLET_QUARTER_ID_PREFIXES[quarter]}-servient-${row - top - 1}`;
  const rotation = outside(left).indexOf(column);
  const angelOf = (nameId: string): TabletPyramidAngel | undefined => {
    const name = findTabletName(view, nameId);
    const spelling = name?.rotations?.[rotation];
    if (!name || !spelling) return undefined;
    return Object.freeze({
      nameId: name.id,
      rotation,
      spelling,
      ...(name.unionLetter ? { unionLetter: name.unionLetter } : {}),
    });
  };
  const angel = angelOf(id);
  const greatAngel = angelOf(`${id}-archangel`);
  return {
    ...(angel ? { angel } : {}),
    ...(greatAngel ? { greatAngel } : {}),
  };
}

/** One square of a view, or nothing outside it or in a version without. */
function pyramidOf(
  view: TabletView,
  row: number,
  column: number,
): TabletPyramid | undefined {
  const bar = CALVARY_BARS[view.version];
  if (!bar || view.grid[row]?.[column] === undefined) return undefined;
  if (view.kind === "union")
    return Object.freeze({
      row,
      column,
      region: "union",
      letters: Object.freeze({}),
      ...union(row, column),
    });
  const tablet = view.id as EnochianWatchtowerID;
  // Inside the grid, checked above, so a region.
  const region = tabletRegion(row, column) as WatchtowerRegion;
  if (region === "greatCross")
    return Object.freeze({
      row,
      column,
      region,
      ...frozenLetters(greatCross(tablet, row, column)),
    });
  const quarter = quarterOf(row, column);
  if (region === "calvaryCross")
    return Object.freeze({
      row,
      column,
      region,
      quarter,
      ...frozenLetters(calvaryCross(tablet, quarter, bar, row, column)),
    });
  if (region === "kerubic")
    return Object.freeze({
      row,
      column,
      region,
      quarter,
      ...frozenLetters(kerubic(tablet, quarter, column)),
    });
  const square = servient(tablet, quarter, row, column);
  const elementsOf = square.sides.map((side) => side.elementId as ElementId);
  return Object.freeze({
    row,
    column,
    region,
    quarter,
    ...frozenLetters(square),
    ...angelsOf(view, quarter, row, column),
    godFormId: godOf(elementsOf),
    sphinx: Object.freeze(elementsOf as KerubId[]) as unknown as NonNullable<
      TabletPyramid["sphinx"]
    >,
  });
}

function frozenLetters<T extends Pick<TabletPyramid, "letters" | "sides">>(
  square: T,
): T {
  return { ...square, letters: Object.freeze({ ...square.letters }) };
}

const cache = new WeakMap<TabletView, readonly TabletPyramid[]>();

/**
 * Every square of a tablet in one version as a pyramid, row by row from
 * the top, each from the left: a Watchtower's 156, the Tablet of Union's
 * 20. None in Dee's and Raphael's versions. Frozen, and the same array for
 * the same view.
 */
export function tabletPyramids(view: TabletView): readonly TabletPyramid[] {
  let pyramids = cache.get(view);
  if (!pyramids) {
    pyramids = Object.freeze(
      view.grid.flatMap((letters, row) =>
        letters.flatMap((_, column) => pyramidOf(view, row, column) ?? []),
      ),
    );
    cache.set(view, pyramids);
  }
  return pyramids;
}

/**
 * One square of a tablet in one version as a pyramid, by row and column
 * from 0; nothing for a square outside the tablet or a version without
 * pyramids (Dee's and Raphael's).
 */
export function tabletPyramid(
  view: TabletView,
  square: TabletSquare,
): TabletPyramid | undefined {
  return tabletPyramids(view).find(
    (each) => each.row === square.row && each.column === square.column,
  );
}
