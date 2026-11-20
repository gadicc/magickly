/**
 * Where a kamea's cells lie, in `KameaFigure`'s units, as a plain module:
 * what a drawing laid over the numbers (a planet's seal, or a sigil traced
 * from cell to cell, `sigil/kameaLayout.ts`) needs to line up with them,
 * without importing a React component. `Kamea.tsx` re-exports it.
 */

/** The square's side, in the figure's units; the figure is centred on 0,0. */
export const KAMEA_SIDE = 96;

/**
 * Where a square's cells lie in the figure: what a drawing laid over the
 * numbers (a planet's seal, or a sigil traced from cell to cell) needs to
 * line up with them.
 */
export interface KameaGeometry {
  /** Cells along a side: Saturn 3 … the Moon 9. */
  order: number;
  /** A cell's side, in the figure's units. */
  cell: number;
  /** A cell's centre, by its row from the top and its column from the left. */
  center(row: number, column: number): [x: number, y: number];
}

/** The geometry of a square of `order` cells a side, in `KameaFigure`. */
export function kameaGeometry(order: number): KameaGeometry {
  const half = KAMEA_SIDE / 2;
  const cell = KAMEA_SIDE / order;
  return {
    order,
    cell,
    center: (row, column) => [
      -half + (column + 0.5) * cell,
      -half + (row + 0.5) * cell,
    ],
  };
}
