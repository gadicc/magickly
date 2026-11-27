/**
 * A tablet's pyramids as plain data for the 3D view (plan 101): what each
 * square's four sides and top show, from the code the flat drawing uses
 * (`tabletPyramids`, `PYRAMID_COLOURS`, `inksOf`, `sideSymbol`), with the
 * colours already in linear light for the shader. No three.js here.
 */
import {
  inksOf,
  type SideSymbol,
  sideSymbol,
} from "magick-components/enochian/pyramidMarks";
import { PYRAMID_COLOURS } from "magick-components/enochian/Tablet";
import { tabletPyramids } from "magick-data/enochian/tabletPyramids";
import type { TabletView } from "magick-data/enochian/tablets";

/** A colour in linear-light RGB, each channel from 0 to 1. */
export type LinearRgb = readonly [r: number, g: number, b: number];

/**
 * An sRGB colour written `#rrggbb` in linear light, by the sRGB transfer
 * function (IEC 61966-2-1), as three's `SRGBToLinear` converts it: the
 * shader lights and blends in linear light, and the hex the flat drawing
 * paints is sRGB.
 */
export function srgbToLinear(hex: string): LinearRgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Not an sRGB colour: ${hex}`);
  const [r, g, b] = match.slice(1).map((byte) => {
    const c = Number.parseInt(byte, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return [r, g, b];
}

/**
 * The committed mark sheet's layout (`marksSheet.generated.ts`): a grid
 * of square cells, each mark centred in its cell at `markBox` units, and
 * each letter centred on a flat top `top` units a side. Units are the
 * sheet's SVG units; the sheet is `columns × cell` wide and `rows × cell`
 * high, cell 0 at its top left, row by row.
 */
export interface MarksSheet {
  readonly columns: number;
  readonly rows: number;
  readonly cell: number;
  readonly markBox: number;
  readonly top: number;
  /** Each side's mark's cell, by `markKey`. */
  readonly marks: Readonly<Record<string, number>>;
  /** Each top's letter's cell, by the letter. */
  readonly letters: Readonly<Record<string, number>>;
}

/** A side's mark as a key of the sheet's cells: one cell a distinct mark. */
export function markKey(symbol: SideSymbol): string {
  if (symbol.kind === "element") return `element:${symbol.element}`;
  if (symbol.kind === "figure") return `figure:${symbol.rows.join("")}`;
  return `${symbol.hebrew ? "hebrew" : "text"}:${symbol.text}`;
}

/** What a face is painted: its ground, its mark's ink and its outline. */
export interface FacePaint {
  readonly colour: LinearRgb;
  readonly ink: LinearRgb;
  readonly outline: LinearRgb;
}

/** One side of a pyramid in 3D: its paint and its mark's cell in the sheet. */
export interface PyramidSide3D extends FacePaint {
  readonly cell: number;
}

/** One square of a tablet as a pyramid in 3D. */
export interface Pyramid3D {
  readonly row: number;
  readonly column: number;
  readonly letter: string | null;
  /** The letter's cell in the sheet, or -1 for a square with none. */
  readonly letterCell: number;
  /** The letter is mirrored, as the flat drawing mirrors it. */
  readonly mirrored: boolean;
  /** Sides 1 to 4: left, top, right, bottom on the page. */
  readonly sides: readonly [
    PyramidSide3D,
    PyramidSide3D,
    PyramidSide3D,
    PyramidSide3D,
  ];
}

/** A tablet's pyramids in 3D, row by row from the top, as `tabletPyramids`. */
export interface Tablet3DModel {
  readonly rows: number;
  readonly columns: number;
  readonly pyramids: readonly Pyramid3D[];
  /** Each square's pyramid's index, row by row, or -1 for none. */
  readonly squares: readonly number[];
}

/**
 * The flat top's paint: white, its letter black, as the flat drawing
 * paints them (`PyramidSquares` in `tabletSvg.tsx`). A letter has no
 * outline.
 */
export const TOP_PAINT: Pick<FacePaint, "colour" | "ink"> = Object.freeze({
  colour: srgbToLinear("#ffffff"),
  ink: srgbToLinear("#000000"),
});

const cellOf = (cells: Readonly<Record<string, number>>, key: string) => {
  const cell = Object.hasOwn(cells, key) ? cells[key] : undefined;
  // A stale sheet, not a reader's error: the sheet's test fails first.
  if (cell === undefined)
    throw new Error(`No cell for ${key}: run pnpm tablet3d:sheet`);
  return cell;
};

/**
 * A tablet in a version as pyramids for the 3D view, always with its
 * sides' symbols (plan 101, invariant 2). The version's reversed letters
 * are mirrored unless `mirrorReversed` is false, as the flat `Tablet`
 * does. Empty for a version without pyramids (Dee's and Raphael's).
 */
export function tabletModel(
  view: TabletView,
  sheet: MarksSheet,
  { mirrorReversed = true }: { mirrorReversed?: boolean } = {},
): Tablet3DModel {
  const reversed = new Set(
    mirrorReversed
      ? view.marks
          .filter((mark) => mark.reversed)
          .map(({ row, column }) => `${row},${column}`)
      : [],
  );
  const pyramids = tabletPyramids(view).map((pyramid): Pyramid3D => {
    const letter = view.grid[pyramid.row][pyramid.column];
    return {
      row: pyramid.row,
      column: pyramid.column,
      letter,
      letterCell: letter === null ? -1 : cellOf(sheet.letters, letter),
      mirrored: reversed.has(`${pyramid.row},${pyramid.column}`),
      sides: pyramid.sides.map((side): PyramidSide3D => {
        // A Calvary square's fourth side has no element: white (`none`).
        const element = (side.elementId ??
          "none") as keyof typeof PYRAMID_COLOURS;
        const inks = inksOf(side);
        return {
          colour: srgbToLinear(PYRAMID_COLOURS[element]),
          ink: srgbToLinear(inks.ink),
          outline: srgbToLinear(inks.outline),
          cell: cellOf(sheet.marks, markKey(sideSymbol(side))),
        };
      }) as unknown as Pyramid3D["sides"],
    };
  });
  const rows = view.grid.length;
  const columns = Math.max(0, ...view.grid.map((row) => row.length));
  const squares = new Array<number>(rows * columns).fill(-1);
  pyramids.forEach(({ row, column }, index) => {
    squares[row * columns + column] = index;
  });
  return { rows, columns, pyramids, squares };
}
