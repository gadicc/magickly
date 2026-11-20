/**
 * A planet's kamea as a sigil layout (plan 093, "Engine: a kamea layout
 * under the rose's rules"), so the rose's engine traces a name on a magic
 * square: tokens are Hebrew letters, each reduced by Aiq Bekar to a number
 * the square has (vol. 4, n73; magick-data's `aiqBekar`), and a letter's
 * place is the cell that holds its number, as "row,column" from the top
 * left. Places are cells, so two letters that reduce to one cell repeat
 * (a crook), as a doubled letter does on the rose. The cells are where
 * `KameaFigure` draws them, so a sigil traced here lies over that figure.
 *
 * `KAMEA_SIGIL_PROFILE` is the rose's rules on the square: the same marks
 * (decision 4), R4's tolerance as a share of a cell, the square's own
 * frame and a stroke weight fixed against the square.
 */

import {
  aiqBekar,
  type HebrewValueOptions,
  letterValue,
} from "magick-data/astrology/aiqBekar";
import kameas, {
  type Kamea,
  type KameaPlanetId,
} from "magick-data/astrology/kameas";
import { KAMEA_SIDE, kameaGeometry } from "../astrology/kameaGeometry.ts";
import { svgCoordinate } from "../svgCoordinate.ts";
import { DEFAULT_SIGIL_PLACEMENT } from "./placeSigil.ts";
import type {
  PlaceId,
  Point,
  SigilLayout,
  SigilLayoutFrame,
  SigilProfile,
} from "./types.ts";

/**
 * Sigil units per cell: Saturn's 32-wide cells make a unit about 1.14, the
 * Moon's 10.7-wide cells about 0.38. Marks, offsets and the figure
 * grammar's clearances are given in units, so this sets how large they are
 * against a cell. The rose's rings are 10 units apart, and a 10-unit cell
 * was the first choice; but the method folds most letters onto one line of
 * the larger squares (the Moon's fourth column holds 10 to 80), and there
 * the grammar's clearances, a stroke width between lines and two from a
 * letter, could not all be kept at 10: placement found no figure for
 * Barrett's and 777's spellings of the Moon's intelligence of
 * intelligences. Of the scales measured (20, 22, 24 and 28 units, with
 * slack 0.44, 0.46 and 0.48 of a cell), 28 with the rose's 0.46 is the one
 * that places every name the pages trace, in both finals modes, with its
 * vertices farthest from the grid's lines (plan 093, K2). The Moon's unit
 * is then 0.91 pixels at `Kamea`'s 240, under the grammar's 1.25: a figure
 * on the Moon's square is legible by that measure from about 328 pixels
 * across.
 */
export const KAMEA_CELL_UNITS = 28;

/**
 * How far a visit may move from its cell's centre, as a share of the
 * cell: the rose's 4.6 units of 10. It keeps a vertex 0.04 of a cell or
 * more inside its cell's lines, which read-back needs (it maps a vertex to
 * the cell it lies in) and the eye needs to see which cell it is in; 0.48
 * places the names too, at half the distance from the lines.
 */
export const KAMEA_SLACK_SHARE = 0.46;

/**
 * Each word's region, in `KameaFigure`'s units: `Kamea`'s own viewBox,
 * the square and its frame, so a word's region and a `Kamea` drawing are
 * the same 100 across.
 */
export const KAMEA_SIGIL_PITCH = 100;

/**
 * The square's frame: every mark of a word stays inside the square (its
 * frame's centre line, `KAMEA_SIDE` across), not the disc round its
 * corners that would let ink out past the frame. Every cell's slack lies
 * inside it.
 */
export const KAMEA_SIGIL_FRAME: SigilLayoutFrame = Object.freeze({
  center: Object.freeze({ x: 0, y: 0 }),
  shape: "square",
  radius: KAMEA_SIDE / 2,
  pitch: KAMEA_SIGIL_PITCH,
});

/**
 * The ink's default width on a kamea, in `KameaFigure`'s units, the same
 * on every square (provisional: K3 chooses the final weight from a
 * mock-up at real size). One sigil unit of the finest square, the Moon's
 * (0.381, rounded as the SVG writes it): the figure grammar's sizes assume
 * a stroke one unit wide, so its gaps of one stroke width still show
 * there, and on the coarser squares, whose units are larger, the line is
 * lighter against the cell (a third of a unit on Saturn's). It is lighter
 * than the grid's 0.6 rules; the sigil's colour sets it apart.
 */
export const KAMEA_SIGIL_STROKE_WIDTH = svgCoordinate(
  KAMEA_SIDE / (9 * KAMEA_CELL_UNITS),
);

/**
 * The Golden Dawn's rules on a kamea (plan 093, decision 4): the rose's
 * marks and placement, with
 *
 * - R4's tolerance at 0.05 of a cell, since a straight pass on a grid is
 *   exact collinearity and a near miss lies at least 0.094 of a cell off:
 *   the names' passes are all exact, through the Moon's 10 between 30 and
 *   60 or 40 down its fourth column (1651's and Barrett's Malcha, and
 *   1533's Malcha and Elim with finals);
 * - placement's lane starts and eight times the rose's budget, which the
 *   runs along the Moon's column need: at this scale, with the rose's
 *   placement settings 7 of the names fail, with its budget and the lane
 *   starts 7, and with eight budgets and no lane starts 3 (plan 093, K2);
 * - the stroke fixed against the square (`KAMEA_SIGIL_STROKE_WIDTH`).
 */
export const KAMEA_SIGIL_PROFILE: SigilProfile = Object.freeze({
  id: "kamea",
  nooseTolerance: 0.05 * KAMEA_CELL_UNITS,
  placement: Object.freeze({
    ...DEFAULT_SIGIL_PLACEMENT,
    budget: 8 * DEFAULT_SIGIL_PLACEMENT.budget,
    laneStarts: true,
  }),
  strokeWidth: KAMEA_SIGIL_STROKE_WIDTH,
});

/** How a kamea layout reads letters. */
export interface KameaLayoutOptions {
  /**
   * Count the final forms at Aiq Bekar's 500 to 900 (ך 500 … ץ 900)
   * rather than at their ordinary letters' values (decision 3: the
   * generator's option; the pages trace at ordinary values).
   */
  finals?: boolean;
}

/** A cell's place id. */
function cellId(row: number, column: number): PlaceId {
  return `${row},${column}`;
}

/**
 * `square` as a layout whose tokens `number` maps to a number the square
 * holds (or `null`); see the module's comment.
 */
function squareLayout<Token>(
  square: Kamea,
  number: (token: Token) => number | null,
): SigilLayout<Token> {
  const order = square.length;
  const { cell, center } = kameaGeometry(order);
  const half = KAMEA_SIDE / 2;
  const cells = new Map<number, PlaceId>();
  const anchors = new Map<PlaceId, Point>();
  square.forEach((row, r) =>
    row.forEach((n, c) => {
      const id = cellId(r, c);
      cells.set(n, id);
      const [x, y] = center(r, c);
      anchors.set(id, { x: svgCoordinate(x), y: svgCoordinate(y) });
    }),
  );
  const slack = KAMEA_SLACK_SHARE * cell;
  return {
    place(token) {
      const n = number(token);
      return n === null ? null : (cells.get(n) ?? null);
    },
    anchor(place) {
      const point = anchors.get(place);
      if (!point) throw new Error(`kameaLayout: no cell ${place}`);
      return point;
    },
    slack() {
      return slack;
    },
    placeAt(point) {
      const row = Math.floor((point.y + half) / cell);
      const column = Math.floor((point.x + half) / cell);
      if (!(row >= 0 && row < order && column >= 0 && column < order))
        return null;
      return cellId(row, column);
    },
    unit: cell / KAMEA_CELL_UNITS,
    places: [...anchors.keys()],
    frame: KAMEA_SIGIL_FRAME,
  };
}

const layouts = new Map<string, SigilLayout<string>>();

/**
 * A planet's kamea (Agrippa's square, magick-data's `kameas`) as a sigil
 * layout over Hebrew letters: a letter's place is the cell of its value
 * reduced by `aiqBekar`; anything that is not one of the 27 letters (a
 * vowel point, a maqaf) has none and is left out. The same object for the
 * same planet and options, so placement's cache, which keys on the
 * layout's identity, serves every caller.
 */
export function kameaLayout(
  planet: KameaPlanetId,
  { finals = false }: KameaLayoutOptions = {},
): SigilLayout<string> {
  const key = `${planet} ${finals}`;
  const cached = layouts.get(key);
  if (cached) return cached;
  // Only the seven: a name from untrusted input ("constructor") is none.
  if (!Object.hasOwn(kameas, planet))
    throw new RangeError(`Not a planet with a kamea: ${planet}`);
  const square = kameas[planet];
  const cells = square.length ** 2;
  const options: HebrewValueOptions = { finals };
  const layout = squareLayout<string>(square, (letter) => {
    let value: number;
    try {
      value = letterValue(letter, options);
    } catch {
      return null;
    }
    return aiqBekar(value, cells);
  });
  layouts.set(key, layout);
  return layout;
}
