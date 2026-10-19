/**
 * The planetary kameas (magic squares), computed rather than copied (plan
 * 061, decision 5): the squares Agrippa gives (*De occulta philosophia*,
 * 1533, book II, chapter 22), which the Golden Dawn's diagrams follow.
 * The odd and doubly even ones are built by the standard constructions
 * that give exactly Agrippa's squares; the Sun's, of order 6, has no such
 * simple construction and is written out. Tests check every square is
 * magic and starts as Agrippa's does.
 */

/** The seven planets of the kameas and seals, in the Chaldean order. */
export const PLANETS = [
  "saturn",
  "jupiter",
  "mars",
  "sun",
  "venus",
  "mercury",
  "moon",
] as const;
export type Planet = (typeof PLANETS)[number];

/** Each planet as the Order's diagrams name it ("Kamea of Luna"). */
export const PLANET_NAMES: ReadonlyMap<Planet, string> = new Map([
  ["saturn", "Saturn"],
  ["jupiter", "Jupiter"],
  ["mars", "Mars"],
  ["sun", "Sol"],
  ["venus", "Venus"],
  ["mercury", "Mercury"],
  ["moon", "Luna"],
]);

/** A square's order by planet: Saturn 3 … the Moon 9. */
export const KAMEA_ORDERS: ReadonlyMap<Planet, number> = new Map(
  PLANETS.map((planet, index) => [planet, index + 3]),
);

/** A square, row by row from the top. */
export type Kamea = readonly (readonly number[])[];

const empty = (n: number) =>
  Array.from({ length: n }, () => Array<number>(n).fill(0));

/**
 * An odd square: 1 just below the centre, each next number one down and
 * one right (wrapping), or two down when that cell is taken.
 */
export function oddKamea(n: number): Kamea {
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
 * A doubly even square (order 4 or 8): 1 to n² written row by row, each
 * number on a diagonal of a 4 × 4 block replaced by its complement
 * (n² + 1 − k), and the rows read from the bottom.
 */
export function doublyEvenKamea(n: number): Kamea {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const k = i * n + j + 1;
      const [a, b] = [i % 4, j % 4];
      return a === b || a + b === 3 ? n * n + 1 - k : k;
    }),
  ).reverse();
}

/** The Sun's square, as Agrippa gives it. */
const SUN: Kamea = [
  [6, 32, 3, 34, 35, 1],
  [7, 11, 27, 28, 8, 30],
  [19, 14, 16, 15, 23, 24],
  [18, 20, 22, 21, 17, 13],
  [25, 29, 10, 9, 26, 12],
  [36, 5, 33, 4, 2, 31],
];

/** A planet's kamea. */
export function kamea(planet: Planet): Kamea {
  const n = KAMEA_ORDERS.get(planet) as number;
  if (n === 6) return SUN;
  return n % 2 === 1 ? oddKamea(n) : doublyEvenKamea(n);
}
