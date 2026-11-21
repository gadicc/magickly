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
import {
  KAMEA_FRAME_WIDTH,
  KAMEA_RULE_WIDTH,
  KAMEA_SIDE,
  kameaGeometry,
} from "../astrology/kameaGeometry.ts";
import { svgCoordinate } from "../svgCoordinate.ts";
import { DEFAULT_SIGIL_PLACEMENT } from "./placeSigil.ts";
import type {
  PlaceId,
  Point,
  SigilLayout,
  SigilLayoutFrame,
  SigilLayoutLine,
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
 * on the Moon's square is legible by that measure only from 329 pixels
 * across (`kameaSigilMinSize`).
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
 * on every square: the grid's rule, 0.6 (Gadi, 21 November 2026, from
 * K3's mock-up at real size, over the 0.381 K2 left provisional, one
 * sigil unit of the Moon's square). It matches the square's own lines,
 * the sigil's colour setting it apart, with no casing. It is wider than
 * the figure grammar's one unit on the larger squares (1.58 units on the
 * Moon's, 1.4 on Mercury's, 1.22 on Venus', 1.05 on the Sun's), and a gap
 * between inks is the same share of the figure at any size, so placement
 * and O2 count their limits between inks in this width there rather than
 * in units (`placeSigil`'s `LIMITS`, `FIGURE_GRAMMAR.strokeWidth`).
 * `kameaSigilMinSize` keeps the marks, sized in units, at the grammar's
 * 1.25 pixels a unit; it does not widen the gaps.
 */
export const KAMEA_SIGIL_STROKE_WIDTH = svgCoordinate(KAMEA_RULE_WIDTH);

/**
 * How long a stroke may run within touching distance of a cell's rule or
 * the square's frame, in sigil units: one cell (`KAMEA_CELL_UNITS`), the
 * same share of a cell on every square (plan 093, K3). On the Moon's square the method
 * folds runs of letters onto one column, and placement, free to move a
 * visit up to 0.46 of a cell from its centre, could lay a stroke along
 * the rule beside it (1651's בתרשיסים: 20 to 30 on the rule right of the
 * fourth column, which holds 10 to 80, for 7 cells); the reader then
 * cannot tell which column it is in. Touching is the stroke's centre
 * line within half the stroke and half the rule (0.3 + 0.3 = 0.6 of the
 * square's units) of the rule's, or half the frame's 2 (0.3 + 1 = 1.3) of
 * the frame's.
 * A stroke that crosses a rule square to it lies in that band for 1.2
 * units of the square, far under a cell; one crossing at under about 6°
 * on the Moon's square, or running beside it, is held to a cell.
 */
export const KAMEA_LINE_RUN = KAMEA_CELL_UNITS;

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
 * - no stroke along a cell's rule or the frame for more than a cell
 *   (`KAMEA_LINE_RUN`);
 * - a seeded fallback for a word the search leaves failing: up to 64
 *   random starts and three more of these budgets of work, shared by a
 *   text's words. Barrett's Malcha (both finals modes) clears only
 *   through it, after 1.3 and 2.4 million units of its work (1.4 and 2.1
 *   s for the text on a 2026 desktop); 777's with finals, which the
 *   generator alone traces, does not clear in its budget. A word that
 *   still fails costs at most four of these budgets in all (about 4 s,
 *   which a page should spend on the server or off the main thread); a
 *   text, at most two, an eighth for each word beyond the second, and
 *   the fallback's three, which its words share (plan 093, K3);
 * - the stroke fixed against the square (`KAMEA_SIGIL_STROKE_WIDTH`).
 */
export const KAMEA_SIGIL_PROFILE: SigilProfile = Object.freeze({
  id: "kamea",
  nooseTolerance: 0.05 * KAMEA_CELL_UNITS,
  placement: Object.freeze({
    ...DEFAULT_SIGIL_PLACEMENT,
    budget: 8 * DEFAULT_SIGIL_PLACEMENT.budget,
    laneStarts: true,
    lineRun: KAMEA_LINE_RUN,
    fallback: Object.freeze({
      starts: 64,
      budget: 3 * 8 * DEFAULT_SIGIL_PLACEMENT.budget,
    }),
  }),
  strokeWidth: KAMEA_SIGIL_STROKE_WIDTH,
});

/**
 * The least width, in CSS pixels, a word's figure on any square is drawn
 * at: `Kamea`'s default size.
 */
export const KAMEA_SIGIL_SIZE_FLOOR = 240;

/**
 * The least width, in CSS pixels, of one word's figure on `planet`'s
 * square (its region, `KAMEA_SIGIL_PITCH` across): the figure grammar's
 * smallest legible rendering, 1.25 pixels a sigil unit
 * (`FIGURE_GRAMMAR.minPixelsPerUnit`), rounded up to a whole pixel, and
 * never under `KAMEA_SIGIL_SIZE_FLOOR` (Gadi, 21 November 2026). A unit
 * is `KAMEA_SIDE / (order × KAMEA_CELL_UNITS)` of the region's 100, so
 * the bound is 36.46 pixels a cell along the side: Saturn, Jupiter, Mars
 * and the Sun 240 (the grammar asks 110, 146, 183 and 219), Venus 256,
 * Mercury 292 and the Moon 329.
 */
export function kameaSigilMinSize(planet: KameaPlanetId): number {
  if (!Object.hasOwn(kameas, planet))
    throw new RangeError(`Not a planet with a kamea: ${planet}`);
  const order = kameas[planet].length;
  const unit = KAMEA_SIDE / (order * KAMEA_CELL_UNITS);
  // 1.25 px a unit; less a hair, so an exact product is not rounded up.
  const least = (MIN_PIXELS_PER_UNIT * KAMEA_SIGIL_PITCH) / unit;
  return Math.max(KAMEA_SIGIL_SIZE_FLOOR, Math.ceil(least - 1e-9));
}

/**
 * The figure grammar's smallest legible rendering, in pixels a sigil unit
 * (`FIGURE_GRAMMAR.minPixelsPerUnit` in the oracle, which the package's
 * runtime code does not import).
 */
const MIN_PIXELS_PER_UNIT = 1.25;

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
  const { cell, center, rules } = kameaGeometry(order);
  const half = KAMEA_SIDE / 2;
  // The lines `KameaFigure` draws: the rules between the cells, down and
  // across, and the frame's four sides.
  const line = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    width: number,
  ): SigilLayoutLine =>
    Object.freeze({
      a: Object.freeze({ x: x0, y: y0 }),
      b: Object.freeze({ x: x1, y: y1 }),
      width,
    });
  const lines: SigilLayoutLine[] = [
    ...rules.flatMap((r) => {
      const at = svgCoordinate(r);
      return [
        line(at, -half, at, half, KAMEA_RULE_WIDTH),
        line(-half, at, half, at, KAMEA_RULE_WIDTH),
      ];
    }),
    ...[-half, half].flatMap((at) => [
      line(at, -half, at, half, KAMEA_FRAME_WIDTH),
      line(-half, at, half, at, KAMEA_FRAME_WIDTH),
    ]),
  ];
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
    lines: Object.freeze(lines),
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
