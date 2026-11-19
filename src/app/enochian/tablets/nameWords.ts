import type {
  TabletName,
  TabletNameId,
  TabletQuarter,
  TabletSquare,
} from "magick-data/enochian/tabletNames";

/**
 * The Names tab's words for a name (plan 090, decision 5): its label in
 * the list, its group, and its squares in words, each a whole message for
 * Lingui, per kind and per tradition, never pieced together. The Golden
 * Dawn's versions name a name by its role and attribution; Dee's and
 * Raphael's by its place, as Dee's record does. The names themselves are
 * data and are not translated.
 */

/** The page's translator (`useUiLanguage().t`). */
export type Translate = (
  message: string,
  values?: Record<string, string | number>,
) => string;

/** Whose names: the Golden Dawn's versions, or Dee's record. */
export type Tradition = "gd" | "dee";

/** A name as the list shows it: "Bataivah", "Oba?i". */
export const displayName = (spelling: string) =>
  spelling.charAt(0).toUpperCase() + spelling.slice(1).toLowerCase();

/** A name, or the King's two in Dee's and Raphael's versions. */
export function shownName(name: TabletName, t: Translate): string {
  const [first, second] = (name.spellings ?? [name.spelling]).map(displayName);
  return second
    ? t(/*i18n*/ "{first} or {second}", { first, second })
    : (first ?? "");
}

/** Each element by name, for the Watchtowers and the Golden Dawn's quarters. */
export const ELEMENT_WORDS: Readonly<Record<string, string>> = {
  earth: /*i18n*/ "Earth",
  air: /*i18n*/ "Air",
  water: /*i18n*/ "Water",
  fire: /*i18n*/ "Fire",
};

/** The Seniors' labels in the Golden Dawn's versions, by their planets. */
const SENIOR_PLANETS: Readonly<Record<string, string>> = {
  mars: /*i18n*/ "A Senior, of Mars",
  jupiter: /*i18n*/ "A Senior, of Jupiter",
  luna: /*i18n*/ "A Senior, of the Moon",
  venus: /*i18n*/ "A Senior, of Venus",
  mercury: /*i18n*/ "A Senior, of Mercury",
  saturn: /*i18n*/ "A Senior, of Saturn",
};

/** The Seniors' labels in Dee's and Raphael's versions, by their lines. */
const SENIOR_LINES: Readonly<Partial<Record<TabletNameId, string>>> = {
  "senior-row-left": /*i18n*/ "A Senior, row 7 leftward",
  "senior-row-right": /*i18n*/ "A Senior, row 7 rightward",
  "senior-col6-up": /*i18n*/ "A Senior, column 6 upward",
  "senior-col6-down": /*i18n*/ "A Senior, column 6 downward",
  "senior-col7-up": /*i18n*/ "A Senior, column 7 upward",
  "senior-col7-down": /*i18n*/ "A Senior, column 7 downward",
};

/** Each kind's label in the list, by tradition. */
const KIND_LABELS: Readonly<
  Record<Exclude<TabletName["kind"], "senior">, Record<Tradition, string>>
> = {
  holyName: { gd: /*i18n*/ "A holy name", dee: /*i18n*/ "A name of God" },
  king: { gd: /*i18n*/ "The King, of the Sun", dee: /*i18n*/ "The King" },
  crossColumn: {
    gd: /*i18n*/ "The name that calls",
    dee: /*i18n*/ "The name that calls",
  },
  crossRow: {
    gd: /*i18n*/ "The name that commands",
    dee: /*i18n*/ "The name that commands",
  },
  topRow: { gd: /*i18n*/ "The Kerubic name", dee: /*i18n*/ "Above the cross" },
  servient: {
    gd: /*i18n*/ "A servient angel",
    dee: /*i18n*/ "Below the cross bar",
  },
};

/** A name's label in the list: its role, or in Dee's versions its place. */
export function nameLabel(
  name: TabletName,
  tradition: Tradition,
  t: Translate,
): string {
  if (name.kind === "senior")
    return t(
      tradition === "gd"
        ? (SENIOR_PLANETS[name.attribution?.planet ?? ""] ??
            /*i18n*/ "A Senior")
        : (SENIOR_LINES[name.id] ?? /*i18n*/ "A Senior"),
    );
  return t(KIND_LABELS[name.kind][tradition]);
}

/** Dee's quarters, by place: his record names no element for them. */
const QUARTER_PLACES: Readonly<Record<TabletQuarter, string>> = {
  topLeft: /*i18n*/ "The top left quarter",
  topRight: /*i18n*/ "The top right quarter",
  bottomLeft: /*i18n*/ "The bottom left quarter",
  bottomRight: /*i18n*/ "The bottom right quarter",
};

/** The Golden Dawn's element of each quarter, by place. */
const QUARTER_ELEMENTS: Readonly<Record<TabletQuarter, string>> = {
  topLeft: "air",
  topRight: "water",
  bottomLeft: "earth",
  bottomRight: "fire",
};

/**
 * A group's heading: the Great Cross, or a quarter as the Golden Dawn
 * names it ("Air of Earth") or by its place in Dee's versions.
 */
export function groupLabel(
  quarter: TabletQuarter | undefined,
  tablet: string,
  tradition: Tradition,
  t: Translate,
): string {
  if (!quarter) return t(/*i18n*/ "The Great Cross");
  if (tradition === "dee") return t(QUARTER_PLACES[quarter]);
  return t(/*i18n*/ "{quarter} of {tablet}", {
    quarter: t(ELEMENT_WORDS[QUARTER_ELEMENTS[quarter]]),
    tablet: t(ELEMENT_WORDS[tablet] ?? tablet),
  });
}

/** A square counted from 1, as a reader counts it. */
const one = (index: number) => index + 1;

/**
 * A name and its squares in words, for the detail and the live region:
 * "Laidrom, a Senior: row 7, squares 7 to 1". The squares are counted
 * from 1, rows from the top and squares from the left.
 */
export function nameInWords(
  name: TabletName,
  tradition: Tradition,
  t: Translate,
): string {
  const squares = name.squares;
  const first = squares[0] as TabletSquare;
  const last = squares[squares.length - 1] as TabletSquare;
  const shown = displayName(name.spelling);
  const run = {
    name: shown,
    row: one(first.row),
    column: one(first.column),
    from: 0,
    to: 0,
  };
  const along = { ...run, from: one(first.column), to: one(last.column) };
  const down = { ...run, from: one(first.row), to: one(last.row) };
  const four = {
    name: shown,
    row: one(first.row),
    first: one(squares[0]?.column ?? 0),
    second: one(squares[1]?.column ?? 0),
    third: one(squares[2]?.column ?? 0),
    fourth: one(squares[3]?.column ?? 0),
  };
  switch (name.kind) {
    case "holyName":
      return tradition === "gd"
        ? t(
            /*i18n*/ "{name}, a holy name: row {row}, squares {from} to {to}",
            along,
          )
        : t(
            /*i18n*/ "{name}, a name of God: row {row}, squares {from} to {to}",
            along,
          );
    case "king": {
      const [a, b] = (name.spellings ?? [name.spelling]).map(displayName);
      return b
        ? t(
            /*i18n*/ "{first} or {second}, the King: row 7, square 5; row 6, squares 6 and 7; row 7, square 8; row 8, squares 7 and 6; then row 7, square 6 or square 7",
            { first: a ?? "", second: b },
          )
        : t(
            /*i18n*/ "{name}, the King: row 7, square 5; row 6, squares 6 and 7; row 7, square 8; row 8, squares 7 and 6; then row 7, squares 6 and 7",
            { name: shown },
          );
    }
    case "senior":
      return first.row === last.row
        ? t(
            /*i18n*/ "{name}, a Senior: row {row}, squares {from} to {to}",
            along,
          )
        : t(
            /*i18n*/ "{name}, a Senior: column {column}, rows {from} to {to}",
            down,
          );
    case "crossColumn":
      return t(
        /*i18n*/ "{name}, the name that calls: column {column}, rows {from} to {to}",
        down,
      );
    case "crossRow":
      return t(
        /*i18n*/ "{name}, the name that commands: row {row}, squares {from} to {to}",
        along,
      );
    case "topRow":
      return tradition === "gd"
        ? t(
            /*i18n*/ "{name}, the Kerubic name: row {row}, squares {first}, {second}, {third} and {fourth}",
            four,
          )
        : t(
            /*i18n*/ "{name}, above the cross: row {row}, squares {first}, {second}, {third} and {fourth}",
            four,
          );
    case "servient":
      return tradition === "gd"
        ? t(
            /*i18n*/ "{name}, a servient angel: row {row}, squares {first}, {second}, {third} and {fourth}",
            four,
          )
        : t(
            /*i18n*/ "{name}, below the cross bar: row {row}, squares {first}, {second}, {third} and {fourth}",
            four,
          );
  }
}

/** "Row 7, square 6", counting from 1. */
export const squareInWords = (square: TabletSquare, t: Translate) =>
  t(/*i18n*/ "Row {row}, square {column}", {
    row: one(square.row),
    column: one(square.column),
  });
