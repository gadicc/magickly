import kameas, { type KameaPlanetId } from "magick-data/astrology/kameas";
import type { CSSProperties, ReactNode } from "react";
import { svgCoordinate } from "../svgCoordinate";

/**
 * A planet's kamea (magic square) drawn from its numbers, which magick-data
 * computes (`magick-data/astrology/kameas`): a frame, the grid's rules and
 * each number in its cell. It writes no ids, links or stylesheet, so any
 * number of squares can share a page or a drawing. Plan 061 ("Follow-ups
 * after stage F"): the temple hall's `kamea` art wraps `KameaFigure`.
 */

/** The square's side, in the figure's units; the figure is centred on 0,0. */
export const KAMEA_SIDE = 96;
const FRAME = 2;
const RULE = 0.6;
/** The numbers' size, as a share of a cell. */
const NUMBER_SIZE = 0.48;

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
  centre(row: number, column: number): [x: number, y: number];
}

/** The geometry of a square of `order` cells a side, in `KameaFigure`. */
export function kameaGeometry(order: number): KameaGeometry {
  const half = KAMEA_SIDE / 2;
  const cell = KAMEA_SIDE / order;
  return {
    order,
    cell,
    centre: (row, column) => [
      -half + (column + 0.5) * cell,
      -half + (row + 0.5) * cell,
    ],
  };
}

export interface KameaFigureProps {
  /**
   * The planet, by magick-data's id; without one, or with a name that is
   * not one of the seven, an empty frame.
   */
  planet?: KameaPlanetId;
  /** The numbers' font stack. */
  fontFamily?: string;
  /** The square's ground. */
  paper?: string;
  /** The frame, the rules and the numbers. */
  ink?: string;
  /**
   * Drawn over the numbers, in the figure's units (centred on 0,0,
   * `KAMEA_SIDE` across; `kameaGeometry` places the cells): room for a
   * planet's seal or sigils to come.
   */
  children?: ReactNode;
}

/**
 * The square as SVG elements, `KAMEA_SIDE` across and centred on the
 * origin, for a drawing that places it itself (as the temple hall does);
 * `Kamea` is the same in an `<svg>` of its own.
 */
export function KameaFigure({
  planet,
  fontFamily = "serif",
  paper = "#ffffff",
  ink = "#000000",
  children,
}: KameaFigureProps) {
  const half = KAMEA_SIDE / 2;
  const frame = (
    <rect
      x={-half}
      y={-half}
      width={KAMEA_SIDE}
      height={KAMEA_SIDE}
      fill={paper}
      stroke={ink}
      strokeWidth={FRAME}
    />
  );
  // Only the seven: a name from untrusted input ("constructor") is none.
  const square =
    planet !== undefined && Object.hasOwn(kameas, planet)
      ? kameas[planet]
      : undefined;
  if (!square)
    return (
      <>
        {frame}
        {children}
      </>
    );
  const { order, cell, centre } = kameaGeometry(square.length);
  const size = cell * NUMBER_SIZE;
  const rules = Array.from({ length: order - 1 }, (_, i) =>
    svgCoordinate(-half + (i + 1) * cell),
  );
  return (
    <>
      {frame}
      <path
        d={rules
          .map((at) => `M${at},${-half}V${half}M${-half},${at}H${half}`)
          .join("")}
        stroke={ink}
        strokeWidth={RULE}
        fill="none"
      />
      <g
        fill={ink}
        fontFamily={fontFamily}
        fontStyle="italic"
        fontSize={svgCoordinate(size)}
        textAnchor="middle"
      >
        {square.flatMap((row, i) =>
          row.map((value, j) => {
            const [x, y] = centre(i, j);
            return (
              <text
                key={value}
                x={svgCoordinate(x)}
                // The digits' middle on the cell's: a third of the size down.
                y={svgCoordinate(y + size * 0.36)}
              >
                {value}
              </text>
            );
          }),
        )}
      </g>
      {children}
    </>
  );
}

export interface KameaProps extends KameaFigureProps {
  planet: KameaPlanetId;
  /** The drawing's width and height (CSS pixels for a number). */
  size?: number | string;
  /** What the square is, for a screen reader ("Kamea of Saturn"). */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A planet's kamea in an `<svg>` of its own, square, `size` across (240 by
 * default), the frame inset a little from the edge. With a `label` it is an
 * image of that name; without one, decoration.
 */
export default function Kamea({
  size = 240,
  label,
  className,
  style,
  ...figure
}: KameaProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      className={className}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <KameaFigure {...figure} />
    </svg>
  );
}
