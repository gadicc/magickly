import type { PlanetId } from "./Planets.ts";

/**
 * The planetary kameas (magic squares), computed rather than copied: the
 * squares Agrippa gives (*De occulta philosophia*, 1533, book II, chapter
 * 22), which the Golden Dawn's diagrams follow. Agrippa's work is in the
 * public domain, and the squares are facts; nothing here is transcribed
 * from a later edition.
 *
 * The odd and the doubly even squares are built by the standard
 * constructions, which give exactly Agrippa's squares; the Sun's, of order
 * 6, has no such simple construction and is written out. The tests check
 * that every square is magic, that each starts with Agrippa's first row,
 * and that Saturn's and Jupiter's are his row by row. Moved here from the
 * app's hall diagrams (plan 061, "Follow-ups after stage F").
 */

/** A square, row by row from the top, each row from the left. */
export type Kamea = readonly (readonly number[])[];

/** A planet id, held to the planet table's. */
type OfPlanetTable<T extends PlanetId> = T;

/** One of the seven planets that have a kamea, by its planet table id. */
export type KameaPlanetId = OfPlanetTable<
  "saturn" | "jupiter" | "mars" | "sol" | "venus" | "mercury" | "luna"
>;

/**
 * The seven planets that have a kamea, in the Chaldean order: Saturn, of
 * order 3, to the Moon, of order 9.
 */
export const KAMEA_PLANETS: readonly KameaPlanetId[] = Object.freeze([
  "saturn",
  "jupiter",
  "mars",
  "sol",
  "venus",
  "mercury",
  "luna",
]);

/**
 * The largest order the constructions build: far beyond the planets' 9,
 * and small enough (10,000 cells) that no caller builds a square by
 * accident that would hold a page up.
 */
export const MAX_KAMEA_ORDER = 100;

/**
 * Throws a RangeError unless `n` is a whole number from `min` to
 * `MAX_KAMEA_ORDER` that the construction takes (`kind`).
 */
function checkOrder(n: number, kind: "odd" | "doubly even"): void {
  const fits =
    Number.isInteger(n) &&
    n >= 3 &&
    n <= MAX_KAMEA_ORDER &&
    (kind === "odd" ? n % 2 === 1 : n % 4 === 0);
  if (!fits)
    throw new RangeError(
      `Not an order for the ${kind} construction: ${n} (${
        kind === "odd" ? "an odd number from 3" : "a multiple of 4 from 4"
      } to ${MAX_KAMEA_ORDER})`,
    );
}

const empty = (n: number) =>
  Array.from({ length: n }, () => Array<number>(n).fill(0));

/**
 * An odd square: 1 just below the centre, each next number one down and
 * one right (wrapping), or two down when that cell is taken. This is
 * Agrippa's construction for Saturn, Mars, Venus and the Moon. `n` is
 * odd, from 3 to `MAX_KAMEA_ORDER`; anything else is a RangeError.
 */
export function oddKamea(n: number): number[][] {
  checkOrder(n, "odd");
  const grid = empty(n);
  const centre = (n - 1) / 2;
  let row = centre + 1;
  let column = centre;
  for (let k = 1; k <= n * n; k++) {
    grid[row][column] = k;
    const nextRow = (row + 1) % n;
    const nextColumn = (column + 1) % n;
    if (grid[nextRow][nextColumn] !== 0) row = (row + 2) % n;
    else [row, column] = [nextRow, nextColumn];
  }
  return grid;
}

/**
 * A doubly even square (order 4 or 8, or any multiple of 4): 1 to n²
 * written row by row, each number on a diagonal of a 4 × 4 block replaced
 * by its complement (n² + 1 − k), and the rows read from the bottom. This
 * is Agrippa's construction for Jupiter and Mercury. `n` is a multiple of
 * 4 up to `MAX_KAMEA_ORDER`; anything else is a RangeError (for 2 or 6
 * the construction would return a square that is not magic).
 */
export function doublyEvenKamea(n: number): number[][] {
  checkOrder(n, "doubly even");
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const k = i * n + j + 1;
      const [a, b] = [i % 4, j % 4];
      return a === b || a + b === 3 ? n * n + 1 - k : k;
    }),
  ).reverse();
}

/** The Sun's square, as Agrippa gives it. */
const SOL = [
  [6, 32, 3, 34, 35, 1],
  [7, 11, 27, 28, 8, 30],
  [19, 14, 16, 15, 23, 24],
  [18, 20, 22, 21, 17, 13],
  [25, 29, 10, 9, 26, 12],
  [36, 5, 33, 4, 2, 31],
];

const freeze = (square: number[][]): Kamea =>
  Object.freeze(square.map((row) => Object.freeze(row)));

/**
 * Every planet's kamea, frozen, by planet: `kameas.luna` is the Moon's
 * 9 × 9 square. A planet's square has as many rows as its order. The table
 * has no prototype, so a name that is not a planet ("constructor",
 * "__proto__") reads as undefined rather than as an inherited function.
 */
const kameas: Readonly<Record<KameaPlanetId, Kamea>> = Object.freeze(
  Object.assign(
    Object.create(null),
    Object.fromEntries(
      KAMEA_PLANETS.map((planet, index) => {
        const n = index + 3;
        const square =
          n === 6 ? SOL : n % 2 === 1 ? oddKamea(n) : doublyEvenKamea(n);
        return [planet, freeze(square)];
      }),
    ),
  ) as Record<KameaPlanetId, Kamea>,
);

export default kameas;
