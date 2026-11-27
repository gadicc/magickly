/**
 * The Enochian tablets' drawing, a private module: the entry,
 * `enochian/Tablet`, names it and re-exports what is public, and the
 * hall's art draws it unnamed.
 */

import type {
  TabletPyramid,
  TabletPyramidSide,
} from "magick-data/enochian/tabletPyramids";
import enochianTablets, {
  DEFAULT_TABLET_VERSION,
  type EnochianTablet,
  type EnochianTabletID,
  TABLET_VERSIONS,
  type TabletVersionId,
  type TabletView,
  tabletVersion,
} from "magick-data/enochian/tablets";
import React, { type CSSProperties, type ReactNode } from "react";
import { PYRAMID_SYMBOL_TURNS } from "./pyramidSymbolTurns.ts";
import { EquinoxSigils, Sigils, VERSION_NAMES } from "./tabletSigils.tsx";

/** A tablet's page, as its `<svg>`'s viewBox: x, y, width, height. */
export type TabletViewBox = readonly [number, number, number, number];

/** A Watchtower's page: its sigil above its grid. */
export const WATCHTOWER_VIEWBOX: TabletViewBox = [-105, 0, 210, 297];

/** The Tablet of Union's page: its grid of five by four with a margin. */
export const UNION_VIEWBOX: TabletViewBox = [0, 0, 124, 104];

/** The page a tablet draws on, by its key. */
export function tabletViewBox(id: string): TabletViewBox {
  return tabletOf(id)?.kind === "union" ? UNION_VIEWBOX : WATCHTOWER_VIEWBOX;
}

/** The tablet with this key, or nothing for a key the data does not have. */
function tabletOf(id: string): EnochianTablet | undefined {
  return Object.hasOwn(enochianTablets, id)
    ? enochianTablets[id as EnochianTabletID]
    : undefined;
}

/**
 * Whether a Watchtower's square, by column `x` and row `y` from 0, is on a
 * cross: the Great Cross or a quarter's Calvary cross. Exported for the
 * test that holds it to `magick-data/enochian/tabletNames`' paths.
 */
export function isCrossFromPosition(x: number, y: number): boolean {
  if (x === 2 || x === 5 || x === 6 || x === 9) return true;
  if (y === 1 || y === 6 || y === 8) return true;
  return false;
}

/**
 * The Golden Dawn's element of the quarter a Watchtower's square lies in,
 * by column `x` and row `y` from 0; "" on the Great Cross. Exported for the
 * same test.
 */
export function elementFromPosition(x: number, y: number): string {
  if (x < 5) {
    if (y < 6) return "air";
    if (y > 6) return "earth";
  } else if (x > 6) {
    if (y < 6) return "water";
    if (y > 6) return "fire";
  }
  return "";
}

/** Each angle's colour, by element; the cross between them has none. */
const elementColors: Readonly<Record<string, string>> = {
  air: "yellow",
  water: "#59f",
  fire: "#f55",
  earth: "black",
};

/** A tablet's colours, where they are not its angles' elements'. */
interface TabletColors {
  /** The letters' colour, by angle (`default` where none is given). */
  color: Readonly<Record<string, string>>;
  /** The squares' fill, outside the cross. */
  background: string;
  /** The border of the cross's squares. */
  border?: string;
  /** The border of the other squares. */
  borderCross?: string;
}

const tabletColors: Readonly<Record<string, TabletColors>> = {
  earth: {
    color: {
      default: "black",
      earth: "white",
    },
    background: "black",
    borderCross: "white",
  },
  air: {
    color: {
      default: "black",
      air: "brown",
    },
    background: "#fff100",
  },
  // Painted in blue, the Water angle lettered in orange, and in red, the
  // Fire angle in green: Regardie, The Golden Dawn, vol. 4 (1940), p.275.
  water: {
    color: {
      water: "#f80",
    },
    background: "#59f",
  },
  fire: {
    color: {
      fire: "#2b2",
    },
    background: "#f33",
  },
};

/**
 * The ground a Watchtower's angles are painted in, outside its crosses
 * (whose squares are white): black for Earth, yellow for Air, blue for
 * Water, red for Fire. Nothing for a key that is not a Watchtower's.
 */
export function tabletGround(id: string): string | undefined {
  return Object.hasOwn(tabletColors, id)
    ? tabletColors[id]?.background
    : undefined;
}

/**
 * Which sigils each version draws: Regardie's for the Golden Dawn's and
 * his own, the Equinox's for its own, and none for Dee's and Raphael's
 * tables, which carry none (the Golden Dawn takes its sigils from Dee's
 * Sigillum Dei Aemeth).
 */
const VERSION_SIGILS: Readonly<
  Record<TabletVersionId, typeof Sigils | undefined>
> = {
  gd: Sigils,
  regardie: Sigils,
  equinox: EquinoxSigils,
  dee: undefined,
  raphael: undefined,
};

/**
 * Where a version without sigils (Dee's and Raphael's tables) would draw
 * one: a short note saying why there is none, in the sigil's place, so
 * the page keeps its shape. Drawn in the transliteration's font always.
 */
const NO_SIGIL_LINES = [
  "No sigil: Dee's tables carry none.",
  "The Watchtower sigils are the Golden Dawn's, from",
  "the Sigillum Dei Aemeth (Regardie, vol. 4, p.307).",
];

function NoSigil() {
  return (
    <g data-sigil-note="">
      {NO_SIGIL_LINES.map((line, index) => (
        <text
          key={line}
          x={0}
          y={18 + index * 9}
          style={{ fontSize: 6.5, textAnchor: "middle", fill: "#555" }}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

/** A version by its id, or the default for an id that is none. */
function versionOf(version: string | undefined): TabletVersionId {
  return (TABLET_VERSIONS as readonly string[]).includes(version ?? "")
    ? (version as TabletVersionId)
    : DEFAULT_TABLET_VERSION;
}

/** A square of a tablet's grid, by row and column from 0. */
export interface TabletSquare {
  row: number;
  column: number;
}

/**
 * A name's squares to mark over a tablet's grid, in reading order (as
 * magick-data's `enochian/tabletNames` gives them): a flag marks the
 * first.
 */
export interface TabletNameHighlight {
  /** The squares, in reading order. */
  squares: readonly TabletSquare[];
  /**
   * The reading order, drawn small in each square's bottom left corner
   * (clear of the second letters, top right): the number for each of
   * `squares`, in the same order. None drawn when absent; leave it out
   * where the squares are too small to read it.
   */
  numbers?: readonly number[];
}

/**
 * What to draw over a tablet's grid, and what a click on a square does.
 * All of it is drawing and pointer only; a page that offers it gives
 * keyboard and screen-reader users the same choices in a list. Nothing
 * is drawn with dashes, which an export may strip. The Tablet of Union
 * takes all of it but `regions`, which are a Watchtower's crosses and
 * rows: it has none, so it ignores them.
 *
 * - `squares` are outlined, `selected` among them more boldly, and a
 *   click on one calls `onSelect`;
 * - `anySquare` lets a click on any square of the grid call `onSelect`;
 * - `name` is a chosen name: every other square veiled in white, its own
 *   kept in their colours inside a dark violet outline;
 * - `preview` is a name looked at but not chosen: a violet ring round
 *   each square, the rest left as drawn;
 * - `regions` tints the Great Cross and the Calvary crosses under the
 *   letters, hatches the top rows over theirs, and leaves the servient
 *   squares plain.
 */
export interface TabletHighlights {
  /** Squares to outline; none with `[]`. */
  squares: readonly TabletSquare[];
  /** One of `squares`, outlined more boldly. */
  selected?: TabletSquare;
  /** A click on an outlined square, or on any with `anySquare`. */
  onSelect?: (square: TabletSquare) => void;
  /** A click on any square of the grid calls `onSelect`. */
  anySquare?: boolean;
  /** A chosen name: the rest dimmed, its squares outlined and flagged. */
  name?: TabletNameHighlight;
  /** A name previewed: its squares ringed and flagged. */
  preview?: TabletNameHighlight;
  /**
   * Tint the Great Cross, the Calvary crosses and the top rows; a
   * Watchtower's only, so the Tablet of Union ignores it.
   */
  regions?: boolean;
}

/**
 * The regions a Watchtower's square lies in, by row and column from 0:
 * the Great Cross (row 6, columns 5 and 6), a quarter's Calvary cross
 * (its middle column and second row), a quarter's top row (the Kerubic
 * squares) or its servient squares. The same lines as
 * `isCrossFromPosition`.
 */
export function regionFromPosition(
  row: number,
  column: number,
): "greatCross" | "calvaryCross" | "topRow" | "servient" {
  if (row === 6 || column === 5 || column === 6) return "greatCross";
  const quarterRow = row < 6 ? row : row - 7;
  if (column === 2 || column === 9 || quarterRow === 1) return "calvaryCross";
  return quarterRow === 0 ? "topRow" : "servient";
}

/** The highlights' ink: a chosen name's outline, flag and numbers. */
export const HIGHLIGHT_INK = "#4a0072";
/** A previewed name's ring, and the selected square's outline. */
export const HIGHLIGHT_RING = "#c0f";
/** The outlined squares' outline. */
export const HIGHLIGHT_OUTLINE = "#e0f";
/** The regions' tints, under the letters on the crosses' white squares. */
export const REGION_TINTS = Object.freeze({
  greatCross: { fill: "#ffd54a", opacity: 0.55 },
  calvaryCross: { fill: "#5fd3c6", opacity: 0.45 },
});
/** The top rows' hatch: white lines over the ground, at 45 degrees. */
export const REGION_HATCH = Object.freeze({
  stroke: "#fff",
  opacity: 0.55,
  width: 2,
  /** The lines' distance apart, across them. */
  spacing: 5,
});

/** How a grid draws its letters: reversed ones mirrored, second letters. */
interface LetterOptions {
  /** Mirror the letters the version reverses. */
  reversed: boolean;
  /** Draw each square's second letters small in its top right corner. */
  alt: boolean;
}

/** The squares whose letters the version reverses, as "row,column". */
function reversedSquares(tablet: TabletView, options: LetterOptions) {
  return new Set(
    options.reversed
      ? tablet.marks
          .filter((mark) => mark.reversed)
          .map(({ row, column }) => `${row},${column}`)
      : [],
  );
}

/** Each square's second letters, as "row,column", when they are drawn. */
function altLetters(tablet: TabletView, options: LetterOptions) {
  return new Map(
    options.alt
      ? tablet.marks
          .filter((mark) => mark.alt?.length)
          .map(({ row, column, alt }) => [
            `${row},${column}`,
            (alt ?? []).join(""),
          ])
      : [],
  );
}

/**
 * A square's second letters, small in its top right corner, in the
 * transliteration's font or the page's Enochian one.
 */
function AltLetters({
  letters,
  right,
  top,
  fill,
  enochianStyle,
}: {
  letters: string;
  right: number;
  top: number;
  fill: string | undefined;
  enochianStyle?: CSSProperties;
}) {
  return (
    <text
      x={right - 1.5}
      y={top + 6}
      data-alt=""
      style={{
        fontSize: 6,
        textAnchor: "end",
        fill,
        ...enochianStyle,
        // Left to right, so that the corner holds them in either font.
        direction: "ltr",
        unicodeBidi: "normal",
      }}
    >
      {letters}
    </text>
  );
}

/** A reversed letter's mirror about the vertical through `cx`. */
const mirrorAt = (cx: number) => `translate(${2 * cx} 0) scale(-1 1)`;

/** A grid's square: 20 units, inside a 2-unit border. */
const SQUARE = 20;
const BORDER = 2;
const squareKey = ({ row, column }: TabletSquare) => `${row},${column}`;

/**
 * Where a grid's squares are drawn: the top left corner of its first
 * square, in the units of the `<svg>` it is drawn in, and its size.
 */
interface GridPlace {
  readonly left: number;
  readonly top: number;
  readonly rows: number;
  readonly columns: number;
}

/** A Watchtower's grid, in its own 244 × 264 `<svg>`. */
const WATCHTOWER_GRID: GridPlace = {
  left: BORDER,
  top: BORDER,
  rows: 13,
  columns: 12,
};

/** The Tablet of Union's grid, centred on its page. */
function unionGrid(tablet: TabletView): GridPlace {
  const [, , pageWidth, pageHeight] = UNION_VIEWBOX;
  const columns = tablet.grid[0]?.length ?? 0;
  const rows = tablet.grid.length;
  return {
    left: (pageWidth - SQUARE * columns) / 2,
    top: (pageHeight - SQUARE * rows) / 2,
    rows,
    columns,
  };
}

const squareX = (column: number, grid: GridPlace = WATCHTOWER_GRID) =>
  grid.left + column * SQUARE;
const squareY = (row: number, grid: GridPlace = WATCHTOWER_GRID) =>
  grid.top + row * SQUARE;

/** Every square of a grid, top row first. */
const allSquares = (grid: GridPlace): readonly TabletSquare[] =>
  Array.from({ length: grid.rows * grid.columns }, (_, index) => ({
    row: Math.floor(index / grid.columns),
    column: index % grid.columns,
  }));

/** Every square of a Watchtower's grid, top row first. */
const ALL_SQUARES: readonly TabletSquare[] = allSquares(WATCHTOWER_GRID);

/** Squares as one path of their outlines, for a single fill. */
const squaresPath = (
  squares: readonly TabletSquare[],
  grid: GridPlace = WATCHTOWER_GRID,
) =>
  squares
    .map(
      ({ row, column }) =>
        `M${squareX(column, grid)} ${squareY(row, grid)}h${SQUARE}v${SQUARE}h${-SQUARE}Z`,
    )
    .join("");

/**
 * Lines at 45 degrees across squares, continuous from one square to the
 * next: the parts of the lines x + y = c, c a multiple of the hatch's
 * step, that cross each square.
 */
function hatchPath(squares: readonly TabletSquare[]) {
  const step = REGION_HATCH.spacing * Math.SQRT2;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const parts: string[] = [];
  for (const { row, column } of squares) {
    const left = squareX(column);
    const top = squareY(row);
    const first = Math.ceil((left + top) / step);
    const last = Math.floor((left + top + 2 * SQUARE) / step);
    for (let n = first; n <= last; n++) {
      const c = n * step;
      // Where x + y = c enters the square from the top or left, and
      // leaves it at the right or bottom.
      const x0 = Math.min(left + SQUARE, c - top);
      const x1 = Math.max(left, c - top - SQUARE);
      if (x0 - x1 < 0.01) continue;
      parts.push(
        `M${round(x0)} ${round(c - x0)}L${round(x1)} ${round(c - x1)}`,
      );
    }
  }
  return parts.join("");
}

/** A flag in the top left corner of a name's first square. */
function StartFlag({
  square,
  grid,
}: {
  square: TabletSquare;
  grid: GridPlace;
}) {
  const x = squareX(square.column, grid) + 0.6;
  const y = squareY(square.row, grid) + 0.6;
  return (
    <path
      data-start=""
      d={`M${x} ${y}h8L${x} ${y + 8}Z`}
      style={{
        fill: HIGHLIGHT_INK,
        stroke: "white",
        strokeWidth: 0.7,
        strokeLinejoin: "round",
      }}
    />
  );
}

/** A square's place in the reading order, small in its bottom left corner. */
function OrderNumber({
  square,
  number,
  grid,
}: {
  square: TabletSquare;
  number: number;
  grid: GridPlace;
}) {
  const cx = squareX(square.column, grid) + 4.8;
  const cy = squareY(square.row, grid) + SQUARE - 4.8;
  return (
    <g data-order={number}>
      <circle
        cx={cx}
        cy={cy}
        r={3.2}
        style={{ fill: HIGHLIGHT_INK, stroke: "white", strokeWidth: 0.6 }}
      />
      <text
        x={cx}
        y={cy + 1.75}
        style={{
          fontSize: 5,
          fontWeight: 700,
          fontFamily: "sans-serif",
          textAnchor: "middle",
          fill: "white",
        }}
      >
        {number}
      </text>
    </g>
  );
}

/** The flag and the numbers of a name, over its squares. */
function NameMarks({
  name,
  grid,
}: {
  name: TabletNameHighlight;
  grid: GridPlace;
}) {
  const [first] = name.squares;
  return (
    <>
      {first && <StartFlag square={first} grid={grid} />}
      {name.numbers?.map((number, index) => {
        const square = name.squares[index];
        return (
          square && (
            <OrderNumber
              key={`n-${squareKey(square)}-${number}`}
              square={square}
              number={number}
              grid={grid}
            />
          )
        );
      })}
    </>
  );
}

/**
 * A chosen name: every other square veiled in white, the name's own
 * outlined in dark violet, its first flagged and, where given, each
 * numbered. One layer over the drawing, so the letters are untouched.
 */
function ChosenName({
  name,
  grid,
}: {
  name: TabletNameHighlight;
  grid: GridPlace;
}) {
  const on = new Set(name.squares.map(squareKey));
  const unique = [...new Map(name.squares.map((s) => [squareKey(s), s]))];
  return (
    <g data-highlight="name">
      <path
        d={squaresPath(
          allSquares(grid).filter((square) => !on.has(squareKey(square))),
          grid,
        )}
        style={{ fill: "white", fillOpacity: 0.72 }}
      />
      {unique.map(([key, { row, column }]) => (
        <rect
          key={`o-${key}`}
          x={squareX(column, grid) + 0.7}
          y={squareY(row, grid) + 0.7}
          width={SQUARE - 1.4}
          height={SQUARE - 1.4}
          style={{ fill: "none", stroke: HIGHLIGHT_INK, strokeWidth: 1.4 }}
        />
      ))}
      <NameMarks name={name} grid={grid} />
    </g>
  );
}

/**
 * A name previewed: a violet ring with a white edge round each square,
 * and its first flagged, the rest of the tablet as drawn.
 */
function PreviewedName({
  name,
  grid,
}: {
  name: TabletNameHighlight;
  grid: GridPlace;
}) {
  const unique = [...new Map(name.squares.map((s) => [squareKey(s), s]))];
  const ring = (
    key: string,
    square: TabletSquare,
    stroke: string,
    width: number,
  ) => (
    <rect
      key={key}
      x={squareX(square.column, grid) + 1.4}
      y={squareY(square.row, grid) + 1.4}
      width={SQUARE - 2.8}
      height={SQUARE - 2.8}
      style={{ fill: "none", stroke, strokeWidth: width }}
    />
  );
  return (
    <g data-highlight="preview">
      {unique.map(([key, square]) => ring(`w-${key}`, square, "white", 4))}
      {unique.map(([key, square]) =>
        ring(`r-${key}`, square, HIGHLIGHT_RING, 2.4),
      )}
      <NameMarks name={{ squares: name.squares }} grid={grid} />
    </g>
  );
}

/** The crosses' tints, drawn under the letters. */
function RegionTints() {
  const of = (region: keyof typeof REGION_TINTS) =>
    ALL_SQUARES.filter(
      ({ row, column }) => regionFromPosition(row, column) === region,
    );
  return (
    // Drawing only: a click goes through to the square beneath.
    <g data-regions="tints" style={{ pointerEvents: "none" }}>
      {(["greatCross", "calvaryCross"] as const).map((region) => (
        <path
          key={region}
          data-region={region}
          d={squaresPath(of(region))}
          style={{
            fill: REGION_TINTS[region].fill,
            fillOpacity: REGION_TINTS[region].opacity,
          }}
        />
      ))}
    </g>
  );
}

/** The top rows' hatch, drawn over their letters. */
function RegionHatch() {
  return (
    <path
      data-region="topRow"
      d={hatchPath(
        ALL_SQUARES.filter(
          ({ row, column }) => regionFromPosition(row, column) === "topRow",
        ),
      )}
      style={{
        fill: "none",
        stroke: REGION_HATCH.stroke,
        strokeOpacity: REGION_HATCH.opacity,
        strokeWidth: REGION_HATCH.width,
      }}
    />
  );
}

/**
 * The square a click on the grid landed in, read from the clicked
 * square's own rect or letter: their `x` and `y` lie inside it.
 */
function squareOfTarget(
  target: EventTarget | null,
  grid: GridPlace,
): TabletSquare | undefined {
  if (!(target instanceof Element)) return undefined;
  const x = Number(target.getAttribute("x"));
  const y = Number(target.getAttribute("y"));
  if (!target.hasAttribute("x") || Number.isNaN(x) || Number.isNaN(y))
    return undefined;
  // The frame round the grid, which starts where its first square does on
  // the Tablet of Union, is no square.
  if (Number(target.getAttribute("width")) > SQUARE) return undefined;
  const column = Math.floor((x - grid.left) / SQUARE);
  const row = Math.floor((y - grid.top) / SQUARE);
  return row >= 0 && row < grid.rows && column >= 0 && column < grid.columns
    ? { row, column }
    : undefined;
}

/**
 * The click handler for `anySquare`: any square of the grid calls
 * `onSelect`, but an outlined one, which calls it itself. Nothing without
 * both.
 */
function pickerOf(highlights: TabletHighlights | undefined, grid: GridPlace) {
  const onSelect = highlights?.onSelect;
  return highlights?.anySquare && onSelect
    ? (event: React.MouseEvent<SVGSVGElement>) => {
        if (
          event.target instanceof Element &&
          event.target.closest("[data-square]")
        )
          return;
        const square = squareOfTarget(event.target, grid);
        if (square) onSelect(square);
      }
    : undefined;
}

/** A chosen name and a previewed one, over the letters. */
function NameLayers({
  highlights,
  grid,
  regions,
}: {
  highlights: TabletHighlights | undefined;
  grid: GridPlace;
  regions?: boolean;
}) {
  return (
    (regions || highlights?.name || highlights?.preview) && (
      // Drawing only: a click goes through to the square beneath.
      <g style={{ pointerEvents: "none" }}>
        {regions && <RegionHatch />}
        {highlights?.name && <ChosenName name={highlights.name} grid={grid} />}
        {highlights?.preview && (
          <PreviewedName name={highlights.preview} grid={grid} />
        )}
      </g>
    )
  );
}

/** The squares outlined, the selected one more boldly, each clickable. */
function OutlinedSquares({
  highlights,
  grid,
}: {
  highlights: TabletHighlights | undefined;
  grid: GridPlace;
}) {
  return highlights?.squares.map(({ row, column }) => {
    const chosen =
      highlights.selected?.row === row &&
      highlights.selected?.column === column;
    return (
      // A pointer shortcut: the page's list is the accessible way to
      // choose a square.
      <rect
        key={`h-${row}-${column}`}
        data-square={`${row},${column}`}
        x={squareX(column, grid) + 1}
        y={squareY(row, grid) + 1}
        width={SQUARE - 2}
        height={SQUARE - 2}
        style={{
          fill: "transparent",
          stroke: chosen ? HIGHLIGHT_RING : HIGHLIGHT_OUTLINE,
          strokeWidth: chosen ? 3 : 1.6,
          strokeDasharray: chosen ? undefined : "3 2",
        }}
        onClick={
          highlights.onSelect
            ? () => highlights.onSelect?.({ row, column })
            : undefined
        }
      />
    );
  });
}

/**
 * The flat top's side as a share of a square's, by default: half, which
 * keeps the letter legible on a phone (plan 095, decision 4, Gadi's choice
 * of 23 November 2026). No source gives a size; the Equinox's plates draw
 * the top about a quarter of the square, to leave the sides room for
 * their symbols, which this drawing does not carry.
 */
export const PYRAMID_TOP = 0.5;

/**
 * The flat top's share of a square by default when the sides carry their
 * symbols (`pyramidSymbols`): a third, which leaves the sides room for
 * them and the letter still legible (Gadi's choice of 24 November 2026,
 * plan 095's follow-up "Symbols on the sides").
 */
export const PYRAMID_TOP_SYMBOLS = 1 / 3;

/** The flat top's least and greatest share of a square. */
const PYRAMID_TOP_RANGE = [0.2, 0.8] as const;

/**
 * Each side's colour by its element (Regardie, The Golden Dawn, vol. 4
 * (1940), p.294): Fire red, Water blue, Air yellow, Earth black, Spirit
 * white; `none` is a Calvary square's fourth side, which carries its
 * Sephirah and no element, painted white (p.296).
 */
export const PYRAMID_COLOURS = Object.freeze({
  fire: "#ff3333",
  water: "#5599ff",
  air: "#fff100",
  earth: "#000000",
  spirit: "#ffffff",
  none: "#ffffff",
});

/**
 * The thin grey lines between a pyramid's sides, round its top and round
 * every square, which keep two black Earth sides apart.
 */
const PYRAMID_LINE = "#888";

/** A top share the drawing can hold: `fallback` where none is given. */
function pyramidTopOf(top: number | undefined, fallback: number): number {
  if (top === undefined || !Number.isFinite(top)) return fallback;
  return Math.min(PYRAMID_TOP_RANGE[1], Math.max(PYRAMID_TOP_RANGE[0], top));
}

const unit = (value: number) => Math.round(value * 1000) / 1000;

/** The symbols on a pyramid's sides, where they are drawn. */
interface SymbolPlan {
  /** A side's mark, centred on 0, 0 in a box of about 34 units. */
  markOf: (side: TabletPyramidSide) => ReactNode;
  /**
   * Each stood on its side's outer edge, head toward the top, as
   * Regardie's drawings (vol. 4) have them (`PYRAMID_SYMBOL_TURNS`),
   * rather than all upright on the page.
   */
  outward: boolean;
}

/**
 * How much of a side's depth, from the square's edge to its top's, its
 * symbol's box fills.
 */
const SYMBOL_FILL = 0.78;

/** The box a side's mark is drawn in, about 34 units a side. */
const MARK_BOX = 34;

/**
 * A square's four sides round its flat top, in their elements' colours,
 * with a thin line where two sides meet: side 1 on the left, 2 at the
 * top, 3 on the right, 4 at the bottom (vol. 4, p.293). With `symbols`,
 * each side's mark in the middle of its band, scaled to it.
 */
function PyramidSides({
  pyramid,
  left,
  top,
  inset,
  symbols,
}: {
  pyramid: TabletPyramid;
  left: number;
  top: number;
  /** The distance from the square's edge to its flat top's. */
  inset: number;
  symbols?: SymbolPlan;
}) {
  const near = inset;
  const far = SQUARE - inset;
  const at = (x: number, y: number) => `${unit(left + x)},${unit(top + y)}`;
  const outlines = [
    [at(0, 0), at(near, near), at(near, far), at(0, SQUARE)],
    [at(0, 0), at(SQUARE, 0), at(far, near), at(near, near)],
    [at(SQUARE, 0), at(SQUARE, SQUARE), at(far, far), at(far, near)],
    [at(0, SQUARE), at(near, far), at(far, far), at(SQUARE, SQUARE)],
  ];
  return (
    <g data-pyramid={`${pyramid.row},${pyramid.column}`}>
      {pyramid.sides.map((side, index) => {
        const fill =
          PYRAMID_COLOURS[
            (side.elementId as keyof typeof PYRAMID_COLOURS | undefined) ??
              "none"
          ];
        return (
          <polygon
            key={side.side}
            data-side={side.side}
            data-element={side.elementId ?? "none"}
            points={outlines[index]?.join(" ")}
            // Its own colour round its edge, so that no seam of the page
            // shows between two sides.
            style={{ fill, stroke: fill, strokeWidth: 0.3 }}
          />
        );
      })}
      <path
        d={`M${at(0, 0)}L${at(near, near)}M${at(SQUARE, 0)}L${at(far, near)}M${at(SQUARE, SQUARE)}L${at(far, far)}M${at(0, SQUARE)}L${at(near, far)}`}
        style={{ fill: "none", stroke: PYRAMID_LINE, strokeWidth: 0.5 }}
      />
      {symbols &&
        pyramid.sides.map((side, index) => {
          const middle = near / 2;
          const [x, y] = [
            [middle, SQUARE / 2],
            [SQUARE / 2, middle],
            [SQUARE - middle, SQUARE / 2],
            [SQUARE / 2, SQUARE - middle],
          ][index] ?? [0, 0];
          const scale = unit((near * SYMBOL_FILL) / MARK_BOX);
          const turn = symbols.outward
            ? PYRAMID_SYMBOL_TURNS[index]
            : undefined;
          return (
            <g
              key={`s-${side.side}`}
              data-symbol={side.side}
              transform={`translate(${at(x, y).replace(",", " ")}) scale(${scale})${turn === undefined ? "" : ` rotate(${turn})`}`}
            >
              {symbols.markOf(side)}
            </g>
          );
        })}
    </g>
  );
}

/**
 * A grid's squares drawn as the Golden Dawn's truncated pyramids (plan
 * 095, decision 4): every square's sides, then the white tops, then a
 * grey border round each square, which takes a click on it, then the
 * regions' tints where asked (a Watchtower's), then the letters in black
 * on the tops. No second letters: there is no room for them on a side.
 */
function PyramidSquares({
  tablet,
  pyramids,
  grid,
  options,
  enochianStyle,
  top: share,
  symbols,
  regions = false,
}: {
  tablet: TabletView;
  pyramids: readonly TabletPyramid[];
  grid: GridPlace;
  options: LetterOptions;
  enochianStyle?: CSSProperties;
  /** The flat top's share of a square. */
  top: number;
  /** The sides' symbols, drawn over them before the tops. */
  symbols?: SymbolPlan;
  regions?: boolean;
}) {
  const byKey = new Map(pyramids.map((each) => [squareKey(each), each]));
  const reversed = reversedSquares(tablet, options);
  const enochianFont = enochianStyle !== undefined;
  const side = unit(SQUARE * share);
  const inset = (SQUARE - side) / 2;
  // The flat drawing's letter, scaled to the top.
  const fontSize = unit((SQUARE - 2 - (enochianFont ? 4 : 0)) * share);
  const cells = tablet.grid.flatMap((row, y) =>
    row.map((letter, x) => ({ letter, x, y })),
  );
  return (
    <g data-pyramids="">
      {cells.map(({ x, y }) => {
        const pyramid = byKey.get(`${y},${x}`);
        return (
          pyramid && (
            <PyramidSides
              key={`p-${y}-${x}`}
              pyramid={pyramid}
              left={squareX(x, grid)}
              top={squareY(y, grid)}
              inset={inset}
              symbols={symbols}
            />
          )
        );
      })}
      {cells.map(({ x, y }) => (
        <rect
          key={`top-${y}-${x}`}
          data-top=""
          x={unit(squareX(x, grid) + inset)}
          y={unit(squareY(y, grid) + inset)}
          width={side}
          height={side}
          style={{ fill: "white", stroke: PYRAMID_LINE, strokeWidth: 0.5 }}
        />
      ))}
      {cells.map(({ x, y }) => (
        <rect
          key={`b-${y}-${x}`}
          x={squareX(x, grid)}
          y={squareY(y, grid)}
          width={SQUARE}
          height={SQUARE}
          // The whole square takes a click, as its ground does when flat.
          style={{
            fill: "none",
            pointerEvents: "all",
            stroke: PYRAMID_LINE,
            strokeWidth: 0.8,
          }}
        />
      ))}
      {regions && <RegionTints />}
      {cells.map(({ letter, x, y }) => {
        if (letter === null) return null;
        const cx = squareX(x, grid) + SQUARE / 2;
        return (
          <text
            key={`t-${y}-${x}`}
            x={cx}
            y={unit(squareY(y, grid) + SQUARE / 2 + fontSize / 3)}
            transform={reversed.has(`${y},${x}`) ? mirrorAt(cx) : undefined}
            style={{
              fontWeight: enochianFont ? "bold" : undefined,
              fontSize,
              textAnchor: "middle",
              fill: "black",
              ...enochianStyle,
            }}
          >
            {letter}
          </text>
        );
      })}
    </g>
  );
}

/**
 * A grid's pyramids, the share of a square their tops take, and their
 * sides' symbols where they are drawn.
 */
interface PyramidPlan {
  pyramids: readonly TabletPyramid[];
  top: number;
  symbols?: SymbolPlan;
}

function Grid({
  id,
  tablet,
  options,
  enochianStyle,
  highlights,
  pyramids,
}: {
  /** The tablet's key, which picks its colours. */
  id: string;
  tablet: TabletView;
  options: LetterOptions;
  enochianStyle?: CSSProperties;
  highlights?: TabletHighlights;
  /** Every square drawn as a pyramid, when given. */
  pyramids?: PyramidPlan;
}) {
  const enochianFont = enochianStyle !== undefined;
  const reversed = reversedSquares(tablet, options);
  const alt = altLetters(tablet, options);
  const size = SQUARE;
  const border = BORDER;
  const regions = highlights?.regions === true;

  /** A square's ground, and its letters over it. */
  const parts = (letter: string | null, x: number, y: number) => {
    const element = elementFromPosition(x, y);
    const isCross = isCrossFromPosition(x, y);
    const fill = tabletColors[id]?.background || elementColors[element];
    const color = tabletColors[id]?.color?.[element] || elementColors[element];
    const ground = (
      <rect
        key={`r-${y}-${x}`}
        x={x * size + border}
        y={y * size + border}
        width={size}
        height={size}
        style={{
          strokeWidth: 1.2,
          stroke: isCross
            ? tabletColors[id]?.border || "black"
            : tabletColors[id]?.borderCross || "black",
          fill: isCross ? "white" : fill,
        }}
      />
    );
    const letters = (
      <>
        {letter !== null && (
          <text
            key={`t-${y}-${x}`}
            x={x * size + size / 2 + border}
            y={y * size + size / 2 + 6 + border}
            transform={
              reversed.has(`${y},${x}`)
                ? mirrorAt(x * size + size / 2 + border)
                : undefined
            }
            style={{
              fontWeight: enochianFont ? "bold" : undefined,
              fontSize: size - 2 - (enochianFont ? 4 : 0),
              textAnchor: "middle",
              fill: isCross ? "black" : color || undefined,
              ...enochianStyle,
            }}
          >
            {letter}
          </text>
        )}
        {alt.has(`${y},${x}`) && (
          <AltLetters
            letters={alt.get(`${y},${x}`) ?? ""}
            right={(x + 1) * size + border}
            top={y * size + border}
            fill={isCross ? "black" : color || undefined}
            enochianStyle={enochianStyle}
          />
        )}
      </>
    );
    return { ground, letters };
  };

  const pickAny = pickerOf(highlights, WATCHTOWER_GRID);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size * 12 + border * 2} ${size * 13 + border * 2}`}
      // No cursor of its own, so the drawing's markup does not change;
      // the page shows one.
      onClick={pickAny}
    >
      {pyramids ? (
        <PyramidSquares
          tablet={tablet}
          pyramids={pyramids.pyramids}
          grid={WATCHTOWER_GRID}
          options={options}
          enochianStyle={enochianStyle}
          top={pyramids.top}
          symbols={pyramids.symbols}
          regions={regions}
        />
      ) : regions ? (
        // The tints go under the letters: every ground first, then the
        // tints, then every letter.
        <>
          {tablet.grid.map((row, y) =>
            row.map((letter, x) => (
              <React.Fragment key={"ground-" + x + "," + y}>
                {parts(letter, x, y).ground}
              </React.Fragment>
            )),
          )}
          <RegionTints />
          {tablet.grid.map((row, y) =>
            row.map((letter, x) => (
              <React.Fragment key={"letters-" + x + "," + y}>
                {parts(letter, x, y).letters}
              </React.Fragment>
            )),
          )}
        </>
      ) : (
        tablet.grid.map((row, y) =>
          row.map((letter, x) => {
            const { ground, letters } = parts(letter, x, y);
            return (
              <React.Fragment key={"grid-" + x + "," + y}>
                {ground}
                {letters}
              </React.Fragment>
            );
          }),
        )
      )}
      <NameLayers
        highlights={highlights}
        grid={WATCHTOWER_GRID}
        regions={regions}
      />
      <OutlinedSquares highlights={highlights} grid={WATCHTOWER_GRID} />
      <rect
        x={0}
        y={0}
        width={size * 12 + border * 2}
        height={size * 13 + border * 2}
        style={{
          strokeWidth: border + 2,
          stroke: "black",
          fill: "none",
        }}
      />
    </svg>
  );
}

/**
 * The Tablet of Union's lines in their elements' colours on white, EXARP
 * for Air, HCOMA for Water, NANTA for Earth and BITOM for Fire: Regardie,
 * The Golden Dawn, vol. 4 (1940), p.275.
 */
const UNION_LINE_COLORS = ["#d4a000", "#2255cc", "black", "#e22"];

/**
 * The Tablet of Union, its squares at a Watchtower's size, on its page,
 * with what `highlights` asks for over it, as a Watchtower's grid draws
 * it (but `regions`, which the Union has none of). Its root's click
 * handler is the page's (`pickerOf`), since it draws in no `<svg>` of
 * its own.
 */
function UnionGrid({
  tablet,
  options,
  enochianStyle,
  highlights,
  pyramids,
}: {
  tablet: TabletView;
  options: LetterOptions;
  enochianStyle?: CSSProperties;
  highlights?: TabletHighlights;
  /** Every square drawn as a pyramid, when given. */
  pyramids?: PyramidPlan;
}) {
  const enochianFont = enochianStyle !== undefined;
  const reversed = reversedSquares(tablet, options);
  const size = SQUARE;
  const grid = unionGrid(tablet);
  const { left, top, columns } = grid;
  return (
    <>
      {pyramids ? (
        <PyramidSquares
          tablet={tablet}
          pyramids={pyramids.pyramids}
          grid={grid}
          options={options}
          enochianStyle={enochianStyle}
          top={pyramids.top}
          symbols={pyramids.symbols}
        />
      ) : (
        tablet.grid
          .flatMap((row, y) => row.map((letter, x) => ({ letter, x, y })))
          .map(({ letter, x, y }) => {
            const cx = left + x * size + size / 2;
            return (
              <React.Fragment key={`grid-${x},${y}`}>
                <rect
                  x={left + x * size}
                  y={top + y * size}
                  width={size}
                  height={size}
                  style={{ strokeWidth: 1.2, stroke: "black", fill: "white" }}
                />
                <text
                  x={cx}
                  y={top + y * size + size / 2 + 6}
                  transform={
                    reversed.has(`${y},${x}`) ? mirrorAt(cx) : undefined
                  }
                  style={{
                    fontWeight: enochianFont ? "bold" : undefined,
                    fontSize: size - 2 - (enochianFont ? 4 : 0),
                    textAnchor: "middle",
                    fill: UNION_LINE_COLORS[y] ?? "black",
                    ...enochianStyle,
                  }}
                >
                  {letter}
                </text>
              </React.Fragment>
            );
          })
      )}
      <NameLayers highlights={highlights} grid={grid} />
      <OutlinedSquares highlights={highlights} grid={grid} />
      <rect
        x={left}
        y={top}
        width={size * columns}
        height={size * tablet.grid.length}
        style={{ strokeWidth: 4, stroke: "black", fill: "none" }}
      />
    </>
  );
}

/** Each Watchtower's element, as its accessible name says it. */
const ELEMENT_NAMES: Record<string, string> = {
  earth: "Earth",
  air: "Air",
  water: "Water",
  fire: "Fire",
};

/**
 * The name a tablet is announced by: "Enochian Watchtower of Fire", "Tablet
 * of Union", or "Enochian tablet" for a key the data does not have; in a
 * version other than the default, with the version's name ("Enochian
 * Watchtower of Fire, Dee's table of 1584").
 */
export function tabletName(id: string, version?: string): string {
  const tablet = tabletOf(id);
  const name =
    tablet?.kind === "union"
      ? "Tablet of Union"
      : tablet && Object.hasOwn(ELEMENT_NAMES, id)
        ? `Enochian Watchtower of ${ELEMENT_NAMES[id]}`
        : "Enochian tablet";
  const chosen = versionOf(version);
  return tablet && chosen !== DEFAULT_TABLET_VERSION
    ? `${name}, ${VERSION_NAMES[chosen]}`
    : name;
}

/**
 * The page of a tablet a version does not have (Dee's and Raphael's have
 * no Tablet of Union): its outline and a line saying so.
 */
function Missing({
  name,
  version,
  viewBox,
}: {
  name: string;
  version: TabletVersionId;
  viewBox: TabletViewBox;
}) {
  const [x, y, width, height] = viewBox;
  const lines = [`No ${name}`, `in ${VERSION_NAMES[version]}`];
  return (
    <g data-missing="">
      <rect
        x={x + 2}
        y={y + 2}
        width={width - 4}
        height={height - 4}
        style={{
          fill: "white",
          stroke: "#888",
          strokeWidth: 1,
          strokeDasharray: "4 3",
        }}
      />
      {lines.map((line, index) => (
        <text
          key={line}
          x={x + width / 2}
          y={y + height / 2 + (index - 0.5) * 10 + 3}
          style={{ fontSize: 7, textAnchor: "middle", fill: "#444" }}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

/** Props of `Tablet`. */
export interface TabletProps {
  /**
   * The tablet, by its key in magick-data: `earth`, `air`, `water`, `fire`
   * or `union`.
   */
  tablet: string;
  /**
   * One of the data's `TABLET_VERSIONS`; the Golden Dawn's (`gd`) when
   * absent or unknown.
   */
  version?: string;
  /** Mirror the letters the version reverses (default true). */
  mirrorReversed?: boolean;
  /**
   * Draw each square's second letters small in its corner (default
   * false). Watchtowers only: no source gives the Tablet of Union a
   * second letter, so its grid has none to draw.
   */
  showSecondLetters?: boolean;
  /**
   * What to draw over a tablet's grid: squares outlined, a chosen name
   * with the rest dimmed, a name previewed in a ring, a Watchtower's
   * regions tinted; and squares to choose by pointer (`TabletHighlights`).
   */
  highlights?: TabletHighlights;
  /**
   * The drawing's accessible name: the tablet's own (`tabletName`) when
   * not given, this one when a string. `false` marks it decorative,
   * hidden from assistive technology (`aria-hidden`).
   */
  label?: string | false;
  /** Page font style for the grid letters; omitted renders the Latin transliteration. */
  enochianStyle?: CSSProperties;
  /**
   * Draws a CSS border around the page (default false). Leave it off
   * where the SVG is exported or turned into an image, which CSS boxes do
   * not reach.
   */
  frame?: boolean;
  /** The SVG's width; from the height and the page's shape when not given. */
  width?: string | number;
  /** The SVG's height; from the width and the page's shape when not given. */
  height?: string | number;
  /** The `<svg>`, for exporting the drawing. */
  ref?: React.Ref<SVGSVGElement>;
  /**
   * Draw every square as the Golden Dawn's truncated pyramid (default
   * false): four sides in their elements' colours round a white flat top
   * that holds the letter, from magick-data's `enochian/tabletPyramids`.
   * The Golden Dawn's versions only: Dee's and Raphael's tables carry no
   * elements, so they are drawn flat. No second letters are drawn on
   * pyramids; the regions are tinted over them as over the flat squares.
   */
  pyramids?: boolean;
  /**
   * The flat top's side as a share of a square's, from 0.2 to 0.8
   * (default `PYRAMID_TOP`, a half, or `PYRAMID_TOP_SYMBOLS`, a third,
   * with `pyramidSymbols`). With `pyramids` only.
   */
  pyramidTop?: number;
  /**
   * Draw each side's symbol on it (default none), in the side's
   * complementary colour with a thin outline: its sign, Sephirah's
   * number, planet, Hebrew letter or geomantic figure, else its element's
   * mark (`enochian/pyramidMarks`). `outward` stands each on its side's
   * outer edge, head toward the top, as Regardie's drawings have them
   * (vol. 4, pp.294 and 296; `PYRAMID_SYMBOL_TURNS`), which we take to
   * be read from outside the pyramid; `upright` stands them all upright
   * on the page, as the Equinox I(7)'s plates draw them. Which way the
   * Order itself painted them, these two witnesses do not settle. With
   * `pyramids` only.
   */
  pyramidSymbols?: "outward" | "upright";
}

/**
 * `Tablet`'s drawing, its root's accessibility attributes the caller's:
 * none for the hall's art, which draws a tablet inside an image that
 * names itself, so that the hall's markup is as it was.
 */
export function TabletSvg({
  tablet: tabletId,
  version,
  mirrorReversed = true,
  showSecondLetters = false,
  enochianStyle,
  frame = false,
  width,
  height,
  highlights,
  ref,
  pyramidsOf,
  pyramidTop,
  pyramidSymbols,
  pyramidMarkOf,
  role,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
}: Omit<TabletProps, "label" | "pyramids"> & {
  /**
   * A tablet's pyramids, for `pyramids`: given by the entry, so that the
   * hall's art, which draws none, does not load the rules behind them.
   */
  pyramidsOf?: (view: TabletView) => readonly TabletPyramid[];
  /**
   * A side's mark, for `pyramidSymbols`: given by the entry, as
   * `pyramidsOf` is, so that the data the symbols read loads with it.
   */
  pyramidMarkOf?: (side: TabletPyramidSide) => ReactNode;
  role?: "img";
  "aria-label"?: string;
  "aria-hidden"?: true;
}) {
  const id = tabletId;
  const chosen = versionOf(version);
  const data = tabletOf(id);
  const tablet = tabletVersion(data, chosen);
  const sigils = VERSION_SIGILS[chosen];
  const Sigil =
    sigils && Object.hasOwn(sigils, id)
      ? sigils[id as keyof typeof sigils]
      : undefined;
  const drawn = pyramidsOf && tablet ? pyramidsOf(tablet) : [];
  // None in Dee's and Raphael's versions, which are then drawn flat.
  const symbols: SymbolPlan | undefined =
    pyramidMarkOf &&
    (pyramidSymbols === "outward" || pyramidSymbols === "upright")
      ? { markOf: pyramidMarkOf, outward: pyramidSymbols === "outward" }
      : undefined;
  const pyramids: PyramidPlan | undefined = drawn.length
    ? {
        pyramids: drawn,
        top: pyramidTopOf(
          pyramidTop,
          symbols ? PYRAMID_TOP_SYMBOLS : PYRAMID_TOP,
        ),
        ...(symbols && { symbols }),
      }
    : undefined;
  const options = {
    reversed: mirrorReversed,
    // No room for second letters on a pyramid's sides.
    alt: showSecondLetters && !pyramids,
  };
  // The Tablet of Union draws in the root itself, so its clicks are taken
  // here; a Watchtower's grid takes its own.
  const pickUnion =
    tablet?.kind === "union"
      ? pickerOf(highlights, unionGrid(tablet))
      : undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={tabletViewBox(id).join(" ")}
      width={width}
      height={height}
      style={frame ? { border: "1px solid black" } : undefined}
      role={role}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      ref={ref}
      onClick={pickUnion}
    >
      {data && !tablet ? (
        <Missing
          name={tabletName(id)}
          version={chosen}
          viewBox={tabletViewBox(id)}
        />
      ) : tablet?.kind === "union" ? (
        <UnionGrid
          tablet={tablet}
          options={options}
          enochianStyle={enochianStyle}
          highlights={highlights}
          pyramids={pyramids}
        />
      ) : (
        tablet && (
          <>
            {Sigil ? (
              <g transform="translate(-31.5,-5) scale(0.3)">
                <Sigil />
              </g>
            ) : (
              <NoSigil />
            )}
            <g transform="translate(-94.5,48) scale(0.9)">
              <Grid
                id={id}
                tablet={tablet}
                options={options}
                enochianStyle={enochianStyle}
                highlights={highlights}
                pyramids={pyramids}
              />
            </g>
          </>
        )
      )}
    </svg>
  );
}
