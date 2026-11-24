import {
  inksOf,
  SideMark,
  sideSymbol,
} from "magick-components/enochian/pyramidMarks";
import { PYRAMID_COLOURS } from "magick-components/enochian/Tablet";
import type { TabletPyramid } from "magick-data/enochian/tabletPyramids";

/**
 * One square of a tablet drawn large as the Golden Dawn's truncated
 * pyramid (plan 095, decision 3): four sides round a white flat top that
 * holds the square's letter, each side in its element's colour with its
 * symbol in the complementary colour (Regardie, vol. 4, pp.293–296). The
 * symbols stand upright, to be read, unless `outward` turns each to face
 * out from the top, as the Order painted them (p.295). The app's own
 * drawing of one square; its marks are magick-components', which the
 * whole tablet draws with `pyramidSymbols`, here at their large outlines.
 * Its words are in the list beside it, so the drawing is hidden from
 * screen readers.
 */

const SIZE = 240;
/** The flat top's edges: a third of the square each way. */
const LOW = SIZE / 3;
const HIGH = (SIZE * 2) / 3;

/** Each side's outline, and where its symbol sits, turned to face out. */
const SIDES = [
  {
    points: `0,0 ${LOW},${LOW} ${LOW},${HIGH} 0,${SIZE}`,
    at: [LOW / 2 - 2, SIZE / 2],
    turn: -90,
  },
  {
    points: `0,0 ${SIZE},0 ${HIGH},${LOW} ${LOW},${LOW}`,
    at: [SIZE / 2, LOW / 2 - 2],
    turn: 0,
  },
  {
    points: `${SIZE},0 ${SIZE},${SIZE} ${HIGH},${HIGH} ${HIGH},${LOW}`,
    at: [SIZE - LOW / 2 + 2, SIZE / 2],
    turn: 90,
  },
  {
    points: `0,${SIZE} ${LOW},${HIGH} ${HIGH},${HIGH} ${SIZE},${SIZE}`,
    at: [SIZE / 2, SIZE - LOW / 2 + 2],
    turn: 180,
  },
] as const;

export default function PyramidDrawing({
  pyramid,
  letter,
  outward = false,
}: {
  pyramid: TabletPyramid;
  /** The square's letter in the chosen version, for the flat top. */
  letter: string;
  /** Turn each symbol to face out from the top, as the Order painted them. */
  outward?: boolean;
}) {
  return (
    <svg
      viewBox={`-2 -2 ${SIZE + 4} ${SIZE + 4}`}
      width="100%"
      aria-hidden
      data-pyramid={`${pyramid.row},${pyramid.column}`}
      data-symbols={outward ? "outward" : "upright"}
      style={{ display: "block", maxWidth: SIZE, margin: "0 auto" }}
    >
      {pyramid.sides.map((side, index) => {
        const fill =
          PYRAMID_COLOURS[
            (side.elementId as keyof typeof PYRAMID_COLOURS | undefined) ??
              "none"
          ];
        const { points, at, turn } = SIDES[index];
        return (
          <g key={side.side} data-side={side.side}>
            <polygon
              points={points}
              style={{ fill, stroke: "#777", strokeWidth: 1.5 }}
            />
            <g
              transform={`translate(${at[0]} ${at[1]})${outward ? ` rotate(${turn})` : ""}`}
            >
              <SideMark symbol={sideSymbol(side)} {...inksOf(side)} />
            </g>
          </g>
        );
      })}
      <rect
        x={LOW}
        y={LOW}
        width={LOW}
        height={LOW}
        style={{ fill: "white", stroke: "#777", strokeWidth: 1.5 }}
      />
      <text
        x={SIZE / 2}
        y={SIZE / 2 + 16}
        style={{
          fill: "black",
          fontSize: 46,
          fontWeight: 700,
          textAnchor: "middle",
        }}
      >
        {letter}
      </text>
    </svg>
  );
}
