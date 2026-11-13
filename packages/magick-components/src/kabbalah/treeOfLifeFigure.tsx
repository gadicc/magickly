import sephirot from "magick-data/kabbalah/sephirot";
import type { SVGProps } from "react";
import { svgCoordinate } from "../svgCoordinate";

/**
 * The Tree of Life's figure, shared by `TreeOfLife` and the drawings that
 * show the Tree inside another drawing (a temple hall's boards, plan 061):
 * its geometry, its paths' draw order and `TreeFigure`, the spheres and
 * paths alone. This module reads only magick-data's sephirot (their
 * colours), never the whole barrel `TreeOfLife` reads for its labels, so
 * a drawing that only shows the figure stays small.
 */

/** Draw order, which paths are "on top" of which, for clarity. */
// prettier-ignore
export const ORDERED_PATHS = {
  hebrew: [
    "4_5",
    "2_3",
    "7_8", // alef, shin, mem
    "1_2",
    "1_3",
    "1_6", // he, vav, dalet
    "2_5",
    "3_4", // zayin, qof <-- paths specific to hebrew tree
    "2_4",
    "2_6",
    "3_5",
    "3_6",
    "4_6",
    "4_7",
    "5_6",
    "5_8",
    "6_7",
    "6_8",
    "6_9",
    "7_9",
    "8_9",
    "9_10",
  ],
  hermetic: [
    "4_5",
    "2_3",
    "7_8",
    "1_2",
    "1_3",
    "1_6",
    "2_4",
    "2_6",
    "3_5",
    "3_6",
    "4_6",
    "4_7",
    "5_6",
    "5_8",
    "6_7",
    "6_8",
    "6_9",
    "7_9",
    "8_9",
    "9_10",
    "7_10",
    "8_10", // paths specific to hermetic tree
  ],
};

/** `x,y` for SVG path data, rounded so every engine writes the same digits. */
export function point(x: number, y: number) {
  return `${svgCoordinate(x)},${svgCoordinate(y)}`;
}

/** A path between two spheres: a band `offset` either side of the line. */
export function LineOutline({
  x1,
  y1,
  x2,
  y2,
  offset = 5,
  ...args
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Half the band's width. */
  offset?: number;
} & Omit<SVGProps<SVGPathElement>, "d">) {
  const theta = Math.PI / 2 - Math.atan((x2 - x1) / (y2 - y1));
  const xd = Math.sin(theta) * offset;
  const yd = Math.cos(theta) * offset;

  return (
    <path
      {...args}
      d={
        `M ${point(x1 - xd, y1 + yd)} L ${point(x1 + xd, y1 - yd)} ` +
        `L ${point(x2 + xd, y2 - yd)} L ${point(x2 - xd, y2 + yd)} z`
      }
    />
  );
}

const constructRadius = 128.5;
const intersectionOffset = (constructRadius / 2) * Math.sqrt(3);
const strokePadding = 2;
const sephirahRadius = 40;
const rowStart = sephirahRadius + strokePadding;
const rowGap = constructRadius / 2;

/** The figure's measures, in its own units. */
export const TREE_GEOMETRY = {
  constructRadius,
  strokePadding,
  sephirahRadius,
  rowStart,
  canvasWidth: 2 * (constructRadius + sephirahRadius + strokePadding),
  canvasHeight: 4 * constructRadius + 2 * (sephirahRadius + strokePadding),
  /** The pillars' x: severity, equilibrium, mercy. */
  pillars: [-intersectionOffset, 0, intersectionOffset],
} as const;

const [severity, equilibrium, mercy] = TREE_GEOMETRY.pillars;

/** Each sphere's centre, Kether to Malkuth, then Daat. */
export const SEPHIRAH_CENTRES: readonly { x: number; y: number }[] = [
  [equilibrium, 0],
  [mercy, 1],
  [severity, 1],
  [mercy, 3],
  [severity, 3],
  [equilibrium, 4],
  [mercy, 5],
  [severity, 5],
  [equilibrium, 6],
  [equilibrium, 8],
  [equilibrium, 2],
].map(([x, row]) => ({ x, y: rowStart + rowGap * row }));

/**
 * The quarters of a sphere of several colours (Malkuth), as path props:
 * wedges from the centre, the first starting at 135°.
 */
export function sephirahWedges(
  x: number,
  y: number,
  colors: readonly string[],
  r = sephirahRadius,
) {
  const rads = Math.PI / 180;
  return colors.map((fill, i) => {
    // Adapted from https://codepen.io/hari_shanx/pen/NRyPBz
    // 180 - 45; hard coded malkuth angles till we need something else
    const from = (i * 360) / colors.length + 180 - 45;
    const to = ((i + 1) * 360) / colors.length + 180 - 45;
    return {
      fill,
      d:
        `M ${point(x, y)} L ${point(x + r * Math.cos(from * rads), y + r * Math.sin(from * rads))} ` +
        `A ${r},${r} 0 0,1 ${point(x + r * Math.cos(to * rads), y + r * Math.sin(to * rads))} z`,
    };
  });
}

const rows = Object.values(sephirot);

/**
 * The Tree's spheres in the Queen scale and its Hermetic paths, nothing
 * else: no text, links, ids or stylesheet. `flash` draws the Lightning
 * Flash down the spheres, Kether to Malkuth. Sized like `TreeOfLife`.
 */
export function TreeFigure({
  width,
  height,
  flash,
}: {
  width?: number;
  height?: number;
  flash?: boolean;
}) {
  const { canvasWidth, canvasHeight } = TREE_GEOMETRY;
  const centre = (index: number) => SEPHIRAH_CENTRES[index - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${-canvasWidth / 2} 0 ${canvasWidth} ${canvasHeight}`}
    >
      <g
        stroke="#000"
        strokeWidth={3}
        fill="#fff"
        style={{ paintOrder: "stroke fill markers" }}
      >
        {[...ORDERED_PATHS.hermetic].reverse().map((id) => {
          const [a, b] = id.split("_").map(Number);
          return (
            <LineOutline
              key={id}
              x1={centre(a).x}
              y1={centre(a).y}
              x2={centre(b).x}
              y2={centre(b).y}
              offset={8.5}
            />
          );
        })}
      </g>
      {SEPHIRAH_CENTRES.slice(0, 10).map(({ x, y }, index) => {
        const colors = rows[index].color.queenWeb.split(",");
        return (
          <g key={rows[index].id}>
            <circle
              cx={x}
              cy={y}
              r={sephirahRadius}
              fill={colors.length > 1 ? undefined : colors[0]}
              stroke="#000"
              strokeWidth={1.568}
            />
            {colors.length > 1 &&
              sephirahWedges(x, y, colors).map((wedge) => (
                <path
                  key={wedge.fill}
                  d={wedge.d}
                  fill={wedge.fill}
                  stroke="#000"
                  strokeWidth={1.568}
                />
              ))}
          </g>
        );
      })}
      {flash && (
        <polyline
          points={SEPHIRAH_CENTRES.slice(0, 10)
            .map(({ x, y }) => point(x, y))
            .join(" ")}
          fill="none"
          stroke="#d92128"
          strokeWidth={9}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
