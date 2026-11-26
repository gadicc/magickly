import {
  inksOf,
  PYRAMID_SYMBOL_TURNS,
  SideMark,
  sideSymbol,
} from "magick-components/enochian/pyramidMarks";
import { PYRAMID_COLOURS } from "magick-components/enochian/Tablet";
import type { TabletPyramid } from "magick-data/enochian/tabletPyramids";

/**
 * One square of a tablet drawn large as the Golden Dawn's truncated
 * pyramid (plan 095, decision 3): four sides round a white flat top that
 * holds the square's letter, each side in its element's colour with its
 * symbol in the complementary colour (Regardie, vol. 4, pp.293–296). Each
 * symbol stands on its side's outer edge, head toward the top, as
 * Regardie's drawings have them (pp.294 and 296; `PYRAMID_SYMBOL_TURNS`), unless `upright` stands them all upright
 * on the page, as the Equinox's plates do. The app's own drawing of one
 * square; its marks are magick-components', which the
 * whole tablet draws with `pyramidSymbols`, here at their large outlines.
 * Its words are in the list beside it, so the drawing is hidden from
 * screen readers.
 */

const SIZE = 240;
/** The flat top's edges: a third of the square each way. */
const LOW = SIZE / 3;
const HIGH = (SIZE * 2) / 3;

/** Each side's outline, and where its symbol sits. */
const SIDES = [
  {
    points: `0,0 ${LOW},${LOW} ${LOW},${HIGH} 0,${SIZE}`,
    at: [LOW / 2 - 2, SIZE / 2],
  },
  {
    points: `0,0 ${SIZE},0 ${HIGH},${LOW} ${LOW},${LOW}`,
    at: [SIZE / 2, LOW / 2 - 2],
  },
  {
    points: `${SIZE},0 ${SIZE},${SIZE} ${HIGH},${HIGH} ${HIGH},${LOW}`,
    at: [SIZE - LOW / 2 + 2, SIZE / 2],
  },
  {
    points: `0,${SIZE} ${LOW},${HIGH} ${HIGH},${HIGH} ${SIZE},${SIZE}`,
    at: [SIZE / 2, SIZE - LOW / 2 + 2],
  },
] as const;

export default function PyramidDrawing({
  pyramid,
  letter,
  upright = false,
}: {
  pyramid: TabletPyramid;
  /** The square's letter in the chosen version, for the flat top. */
  letter: string;
  /**
   * Stand each symbol upright on the page, as the Equinox's plates do,
   * rather than on its side's outer edge.
   */
  upright?: boolean;
}) {
  return (
    <svg
      viewBox={`-2 -2 ${SIZE + 4} ${SIZE + 4}`}
      width="100%"
      aria-hidden
      data-pyramid={`${pyramid.row},${pyramid.column}`}
      data-symbols={upright ? "upright" : "outward"}
      style={{ display: "block", maxWidth: SIZE, margin: "0 auto" }}
    >
      {pyramid.sides.map((side, index) => {
        const fill =
          PYRAMID_COLOURS[
            (side.elementId as keyof typeof PYRAMID_COLOURS | undefined) ??
              "none"
          ];
        const { points, at } = SIDES[index];
        return (
          <g key={side.side} data-side={side.side}>
            <polygon
              points={points}
              style={{ fill, stroke: "#777", strokeWidth: 1.5 }}
            />
            <g
              transform={`translate(${at[0]} ${at[1]})${upright ? "" : ` rotate(${PYRAMID_SYMBOL_TURNS[index]})`}`}
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
