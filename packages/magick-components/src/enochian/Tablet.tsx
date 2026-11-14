import enochianTablets, {
  DEFAULT_TABLET_VERSION,
  type EnochianTablet,
  type EnochianTabletID,
  TABLET_VERSIONS,
  type TabletVersionId,
  type TabletView,
  tabletVersion,
} from "magick-data/enochian/tablets";
import React, { type CSSProperties } from "react";
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

function isCrossFromPosition(x: number, y: number) {
  if (x === 2 || x === 5 || x === 6 || x === 9) return true;
  if (y === 1 || y === 6 || y === 8) return true;
  return false;
}

function elementFromPosition(x: number, y: number) {
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
 * Squares to outline over a Watchtower's grid, one of them selected, and
 * what a click on one does. The outlines are drawing only; a page that
 * offers them gives keyboard and screen-reader users the same choice in a
 * list.
 */
export interface TabletHighlights {
  squares: readonly TabletSquare[];
  selected?: TabletSquare;
  onSelect?: (square: TabletSquare) => void;
}

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

function Grid({
  id,
  tablet,
  options,
  enochianStyle,
  highlights,
}: {
  /** The tablet's key, which picks its colours. */
  id: string;
  tablet: TabletView;
  options: LetterOptions;
  enochianStyle?: CSSProperties;
  highlights?: TabletHighlights;
}) {
  const enochianFont = enochianStyle !== undefined;
  const reversed = reversedSquares(tablet, options);
  const alt = altLetters(tablet, options);
  const size = 20;
  const border = 2;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size * 12 + border * 2} ${size * 13 + border * 2}`}
    >
      {tablet.grid.map((row, y) =>
        row.map((letter, x) => {
          const element = elementFromPosition(x, y);
          const isCross = isCrossFromPosition(x, y);
          const fill = tabletColors[id]?.background || elementColors[element];
          const color =
            tabletColors[id]?.color?.[element] || elementColors[element];

          return (
            <React.Fragment key={"grid-" + x + "," + y}>
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
            </React.Fragment>
          );
        }),
      )}
      {highlights?.squares.map(({ row, column }) => {
        const chosen =
          highlights.selected?.row === row &&
          highlights.selected?.column === column;
        return (
          // A pointer shortcut: the page's list is the accessible way to
          // choose a square.
          <rect
            key={`h-${row}-${column}`}
            data-square={`${row},${column}`}
            x={column * size + border + 1}
            y={row * size + border + 1}
            width={size - 2}
            height={size - 2}
            style={{
              fill: "transparent",
              stroke: chosen ? "#c0f" : "#e0f",
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
      })}
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

/** The Tablet of Union, its squares at a Watchtower's size, on its page. */
function UnionGrid({
  tablet,
  options,
  enochianStyle,
}: {
  tablet: TabletView;
  options: LetterOptions;
  enochianStyle?: CSSProperties;
}) {
  const enochianFont = enochianStyle !== undefined;
  const reversed = reversedSquares(tablet, options);
  const size = 20;
  const [, , pageWidth, pageHeight] = UNION_VIEWBOX;
  const columns = tablet.grid[0]?.length ?? 0;
  const left = (pageWidth - size * columns) / 2;
  const top = (pageHeight - size * tablet.grid.length) / 2;
  return (
    <>
      {tablet.grid
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
                transform={reversed.has(`${y},${x}`) ? mirrorAt(cx) : undefined}
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
        })}
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

/**
 * An Enochian tablet in a version (`version`, the Golden Dawn's by
 * default): a Watchtower's sigil above its grid on a 210 × 297 page, or
 * the Tablet of Union's grid on a page of its own (`tabletViewBox`). The
 * version's reversed letters are mirrored unless `reversed` is false, and
 * a Watchtower's second letters drawn small in each square's corner when
 * `alt` is true. A key the data does not have draws an empty page; a
 * tablet the version does not have, its page saying so. It is an image
 * named by `tabletName` (an `aria-label`, which shows no tooltip over the
 * squares as a `<title>` would) unless `label` is false, as for a tablet
 * drawn inside a larger drawing that names itself.
 */
export function Tablet({
  id,
  version,
  reversed = true,
  alt = false,
  enochianStyle,
  frame = true,
  width,
  height,
  label = true,
  highlights,
  ref,
}: {
  /**
   * The tablet, by its key in the data: `earth`, `air`, `water`, `fire` or
   * `union`.
   */
  id: string;
  /**
   * One of the data's `TABLET_VERSIONS`; the Golden Dawn's (`gd`) when
   * absent or unknown.
   */
  version?: string;
  /** Mirror the letters the version reverses (default true). */
  reversed?: boolean;
  /**
   * Draw each square's second letters small in its corner (default
   * false). Watchtowers only: no source gives the Tablet of Union a
   * second letter, so its grid has none to draw.
   */
  alt?: boolean;
  /** Squares of a Watchtower's grid to outline, and choose by pointer. */
  highlights?: TabletHighlights;
  /** The accessible name: the tablet's own (`true`), another, or none. */
  label?: boolean | string;
  /** Page font style for the grid letters; omitted renders the Latin transliteration. */
  enochianStyle?: CSSProperties;
  /**
   * Draws a CSS border around the page. Leave it off where the SVG is
   * exported or turned into an image, which CSS boxes do not reach.
   */
  frame?: boolean;
  /** The SVG's width; from the height and the page's shape when not given. */
  width?: string | number;
  /** The SVG's height; from the width and the page's shape when not given. */
  height?: string | number;
  /** The `<svg>`, for exporting the drawing. */
  ref?: React.Ref<SVGSVGElement>;
}) {
  const chosen = versionOf(version);
  const data = tabletOf(id);
  const tablet = tabletVersion(data, chosen);
  const sigils = VERSION_SIGILS[chosen];
  const Sigil =
    sigils && Object.hasOwn(sigils, id)
      ? sigils[id as keyof typeof sigils]
      : undefined;
  const name = label === true ? tabletName(id, chosen) : label || undefined;
  const options = { reversed, alt };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={tabletViewBox(id).join(" ")}
      width={width}
      height={height}
      style={frame ? { border: "1px solid black" } : undefined}
      role={name ? "img" : undefined}
      aria-label={name}
      ref={ref}
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
              />
            </g>
          </>
        )
      )}
    </svg>
  );
}

export default Tablet;
