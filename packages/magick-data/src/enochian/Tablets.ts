import parsed from "../../dist/enochian/tablets.js";
import type { Links, Raw } from "../types.ts";

/** Freezes a value and everything in it. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const each of Object.values(value)) deepFreeze(each);
  }
  return value;
}

/**
 * The rows, frozen: `tabletVersion` caches a view per row object, which is
 * only sound while no row changes.
 */
const rows: typeof parsed = deepFreeze(parsed);

/**
 * A tablet's key: the four Watchtowers by their elements (`earth`, `air`,
 * `water`, `fire`) and the Tablet of Union (`union`).
 */
type EnochianTabletID = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type EnochianTablet = Raw<"enochianTablet"> &
  Partial<Links<"*", "enochianTablet">>;

/** Every tablet the data has, by key. */
type EnochianTablets = Record<EnochianTabletID, EnochianTablet>;

/** The four Watchtowers, 13 rows of 12 letters, in the table's order. */
const WATCHTOWER_IDS: readonly ["earth", "air", "water", "fire"] =
  Object.freeze(["earth", "air", "water", "fire"] as const);

/** A Watchtower's key, its element. */
type EnochianWatchtowerID = (typeof WATCHTOWER_IDS)[number];

/**
 * The sources whose readings the tablets hold (`readings` in the data):
 * Regardie 1940, the Equinox 1912, Greer's edition, Dee and Kelley's table
 * of 1584 and Raphael's of 1587, as the data file cites them. A new source
 * is a new key; no tablet's or version's id moves.
 */
const TABLET_SOURCES: readonly [
  "regardie1940",
  "equinox1912",
  "greer",
  "dee1584",
  "raphael1587",
] = Object.freeze([
  "regardie1940",
  "equinox1912",
  "greer",
  "dee1584",
  "raphael1587",
] as const);

/** A source of the tablets' letters. */
type TabletSourceId = (typeof TABLET_SOURCES)[number];

/**
 * The versions of the tablets, each a rule over the readings
 * (`tabletVersion`): the Golden Dawn's (`gd`, the default), Regardie's
 * print, the Equinox's, Dee's of 1584 as he corrected it, and Raphael's
 * of 1587. A new version is a new id and rule; none of these moves.
 */
const TABLET_VERSIONS: readonly [
  "gd",
  "regardie",
  "equinox",
  "dee",
  "raphael",
] = Object.freeze(["gd", "regardie", "equinox", "dee", "raphael"] as const);

/** A version of the tablets. */
type TabletVersionId = (typeof TABLET_VERSIONS)[number];

/** The version a tablet is drawn in unless another is asked for. */
const DEFAULT_TABLET_VERSION: TabletVersionId = "gd";

/** How doubtful a reading of a square is. */
type TabletDoubt = "low" | "medium" | "high";

/** What one source has in a square beyond its letter (the data's `marks`). */
interface TabletReadingMark {
  readonly row: number;
  readonly column: number;
  /** Letters printed on the same line, after the first. */
  readonly beside?: readonly string[];
  /** The smaller letters printed below: Regardie's second letters. */
  readonly below?: readonly string[];
  /** The square's letter is printed reversed. */
  readonly reversed?: true;
  /** The letters first written down, where Dee later corrected the square. */
  readonly dictated?: readonly string[];
  /** What the 1659 print has, where every other copy of Dee's tables agrees otherwise. */
  readonly misprint?: string;
  /** Other readings of the square in this version's witnesses. */
  readonly alt?: readonly string[];
  readonly doubt?: TabletDoubt;
}

/** One source's letters for a tablet. */
interface TabletReading {
  /** Row by row from the top, a character a square, "." for an empty one. */
  readonly rows: readonly string[];
  readonly marks?: readonly TabletReadingMark[];
}

/** A square of a version that holds more than its letter. */
interface TabletMark {
  readonly row: number;
  readonly column: number;
  /**
   * The other letters this version's sources print or record in the
   * square, which a drawing may show small in its corner.
   */
  readonly alt?: readonly string[];
  /** The square's letter is drawn reversed. */
  readonly reversed?: true;
  readonly doubt?: TabletDoubt;
}

/** One tablet in one version: its letters and the squares that hold more. */
interface TabletView {
  readonly id: EnochianTabletID;
  readonly kind: "watchtower" | "union";
  readonly version: TabletVersionId;
  /** Row by row from the top; `null` for a square the version leaves empty. */
  readonly grid: readonly (readonly (string | null)[])[];
  readonly marks: readonly TabletMark[];
}

/** One version's rule (`TABLET_VERSION_RULES`). */
interface TabletVersionRule {
  /**
   * Bumped whenever `tabletVersion` changes what it makes of a rule (how
   * choices apply, which letters `alt` keeps, which are reversed), so that
   * an image identified by the rules and the readings moves with it.
   */
  readonly revision: number;
  /** The reading the version's letters start from. */
  readonly base: TabletSourceId;
  /** The data's `choices` it takes another source's letter from. */
  readonly choices?: "gd";
  /** The readings whose other letters it lists as `alt`. */
  readonly variants?: readonly TabletSourceId[];
  /** The reading whose reversed letters it reverses, if not its base. */
  readonly reversedFrom?: TabletSourceId;
}

/**
 * Each version as a rule: the reading it starts from; for `gd`, the
 * squares where it takes another source's letter (`choices.gd` in the
 * data), the readings whose other letters it lists as `alt`, and the
 * reading whose reversed letters it reverses. Frozen, and exported so
 * that what draws from it can be identified by it.
 */
const TABLET_VERSION_RULES: Readonly<
  Record<TabletVersionId, TabletVersionRule>
> = deepFreeze({
  gd: {
    revision: 1,
    base: "regardie1940",
    choices: "gd",
    variants: ["regardie1940", "equinox1912", "greer"],
    reversedFrom: "equinox1912",
  },
  regardie: { revision: 1, base: "regardie1940" },
  equinox: { revision: 1, base: "equinox1912" },
  dee: { revision: 1, base: "dee1584" },
  raphael: { revision: 1, base: "raphael1587" },
});

/** The source a version's letters start from. */
function versionSource(version: TabletVersionId): TabletSourceId {
  return TABLET_VERSION_RULES[version].base;
}

/** A tablet's reading from one source, or nothing where it has none. */
function tabletReading(
  tablet: EnochianTablet,
  source: TabletSourceId,
): TabletReading | undefined {
  const readings = tablet.readings as Partial<
    Record<TabletSourceId, TabletReading>
  >;
  return Object.hasOwn(readings, source) ? readings[source] : undefined;
}

/** A reading's mark on a square, if it has one. */
function readingMark(
  reading: TabletReading | undefined,
  row: number,
  column: number,
): TabletReadingMark | undefined {
  return reading?.marks?.find(
    (mark) => mark.row === row && mark.column === column,
  );
}

/** A reading's letter in a square, `null` where it is empty. */
function readingLetter(
  reading: TabletReading | undefined,
  row: number,
  column: number,
): string | null {
  const letter = reading?.rows[row]?.[column];
  return letter === undefined || letter === "." ? null : letter;
}

/** Every letter a reading prints in a square, the first first. */
function readingLetters(
  reading: TabletReading | undefined,
  row: number,
  column: number,
): string[] {
  const letter = readingLetter(reading, row, column);
  const mark = readingMark(reading, row, column);
  return [
    ...(letter ? [letter] : []),
    ...(mark?.beside ?? []),
    ...(mark?.below ?? []),
  ];
}

/** A letter folded for comparison: its case, and u for v, once one letter. */
const folded = (letter: string) => letter.toLowerCase().replace("v", "u");

const views = new WeakMap<object, Map<TabletVersionId, TabletView | null>>();

/**
 * A tablet in a version, or `undefined` where the version has no such
 * tablet (Dee and Raphael have no Tablet of Union), for no tablet, or for
 * a version that is not one of `TABLET_VERSIONS`. The rules:
 *
 * - **`gd`**: Regardie's higher letter, except where `choices.gd` takes
 *   another source's. Its `alt` is every other letter Regardie, the
 *   Equinox or Greer prints in the square: all of Regardie's, then the
 *   others' where they add a letter that differs in more than case or u
 *   for v. Its reversed letters are the Equinox's.
 * - **`regardie`**, **`equinox`**, **`dee`**, **`raphael`**: that source's
 *   letters, reversed letters and doubts; `alt` is the letters printed
 *   beside and below the first, the letters first dictated and the other
 *   readings.
 *
 * The result is frozen, and the same object for the same tablet and
 * version.
 */
function tabletVersion(
  tablet: EnochianTablet | undefined,
  version: string = DEFAULT_TABLET_VERSION,
): TabletView | undefined {
  if (!tablet || !(TABLET_VERSIONS as readonly string[]).includes(version))
    return undefined;
  const id = version as TabletVersionId;
  let cache = views.get(tablet);
  if (!cache) {
    cache = new Map();
    views.set(tablet, cache);
  }
  if (!cache.has(id)) cache.set(id, resolve(tablet, id) ?? null);
  return cache.get(id) ?? undefined;
}

/** `tabletVersion` uncached. */
function resolve(
  tablet: EnochianTablet,
  version: TabletVersionId,
): TabletView | undefined {
  const rule = TABLET_VERSION_RULES[version];
  const base = tabletReading(tablet, rule.base);
  if (!base) return undefined;
  const choices = (rule.choices && tablet.choices?.[rule.choices]) || [];
  const reversedFrom =
    rule.reversedFrom && tabletReading(tablet, rule.reversedFrom);
  const grid: (string | null)[][] = [];
  const marks: TabletMark[] = [];
  base.rows.forEach((line, row) => {
    const letters: (string | null)[] = [];
    for (let column = 0; column < line.length; column++) {
      const choice = choices.find(
        (each) => each.row === row && each.column === column,
      );
      const letter = readingLetter(
        choice ? tabletReading(tablet, choice.from) : base,
        row,
        column,
      );
      letters.push(letter);
      const own = readingMark(base, row, column);

      const alt: string[] = [];
      const seenCase = new Set<string>();
      const seenFolded = new Set<string>();
      const add = (each: string, loose: boolean) => {
        if (
          (loose ? seenFolded : seenCase).has(
            loose ? folded(each) : each.toLowerCase(),
          )
        )
          return;
        seenCase.add(each.toLowerCase());
        seenFolded.add(folded(each));
        if (each.toLowerCase() !== letter?.toLowerCase()) alt.push(each);
      };
      if (letter) add(letter, false);
      if (rule.variants)
        for (const source of rule.variants)
          for (const each of readingLetters(
            tabletReading(tablet, source),
            row,
            column,
          ))
            add(each, source !== rule.base);
      else
        for (const each of [
          ...(own?.beside ?? []),
          ...(own?.below ?? []),
          ...(own?.dictated ?? []),
          ...(own?.alt ?? []),
        ])
          add(each, false);

      const reversed = reversedFrom
        ? Boolean(
            letter &&
              readingMark(reversedFrom, row, column)?.reversed &&
              folded(readingLetter(reversedFrom, row, column) ?? "") ===
                folded(letter),
          )
        : Boolean(own?.reversed);
      const doubt = choice ? undefined : own?.doubt;
      if (alt.length || reversed || doubt)
        marks.push(
          Object.freeze({
            row,
            column,
            ...(alt.length ? { alt: Object.freeze(alt) } : {}),
            ...(reversed ? { reversed: true as const } : {}),
            ...(doubt ? { doubt } : {}),
          }),
        );
    }
    grid.push(Object.freeze(letters) as (string | null)[]);
  });
  return Object.freeze({
    id: tablet.id as EnochianTabletID,
    kind: tablet.kind,
    version,
    grid: Object.freeze(grid),
    marks: Object.freeze(marks),
  });
}

/**
 * How two versions' letters in a square differ: in `letter`; in `uv`, u
 * in one and v in the other, which were one letter; in `case` alone; or
 * `empty`, a letter in one and nothing in the other.
 */
type TabletDifferenceKind = "letter" | "uv" | "case" | "empty";

/** A square where two versions differ. */
interface TabletDifference {
  readonly row: number;
  readonly column: number;
  readonly kind: TabletDifferenceKind;
  /** The first version's letter, `null` where it is empty. */
  readonly from: string | null;
  /** The second version's. */
  readonly to: string | null;
}

/**
 * The squares where two views of a tablet differ, top row first. Only the
 * squares' letters are compared, not which are reversed or their `alt`.
 * Views of two different tablets are a `RangeError`: their squares do not
 * correspond.
 */
function tabletDifferences(
  from: TabletView,
  to: TabletView,
): TabletDifference[] {
  if (from.id !== to.id)
    throw new RangeError(
      `cannot compare the ${from.id} tablet with the ${to.id} tablet`,
    );
  const found: TabletDifference[] = [];
  from.grid.forEach((line, row) =>
    line.forEach((a, column) => {
      const b = to.grid[row]?.[column] ?? null;
      if (a === b) return;
      const kind: TabletDifferenceKind =
        a === null || b === null
          ? "empty"
          : a.toLowerCase() === b.toLowerCase()
            ? "case"
            : folded(a) === folded(b)
              ? "uv"
              : "letter";
      found.push({ row, column, kind, from: a, to: b });
    }),
  );
  return found;
}

export type {
  EnochianTablet,
  EnochianTabletID,
  EnochianTablets,
  EnochianWatchtowerID,
  TabletDifference,
  TabletDifferenceKind,
  TabletDoubt,
  TabletMark,
  TabletReading,
  TabletReadingMark,
  TabletSourceId,
  TabletVersionId,
  TabletVersionRule,
  TabletView,
};
export {
  DEFAULT_TABLET_VERSION,
  readingLetter,
  readingLetters,
  readingMark,
  TABLET_SOURCES,
  TABLET_VERSION_RULES,
  TABLET_VERSIONS,
  tabletDifferences,
  tabletReading,
  tabletVersion,
  versionSource,
  WATCHTOWER_IDS,
};
export default rows;
