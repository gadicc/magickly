import type { TabletPyramid } from "magick-data/enochian/tabletPyramids";
import {
  SIDE_COLOURS,
  type SideElement,
  type SideSymbol,
  sideSymbol,
} from "./pyramidWords";

/**
 * One square of a tablet drawn large as the Golden Dawn's truncated
 * pyramid (plan 095, decision 3): four sides round a white flat top that
 * holds the square's letter, each side in its element's colour with its
 * symbol in the complementary colour (Regardie, vol. 4, pp.293–296). The
 * symbols stand upright, to be read, unless `outward` turns each to face
 * out from the top, as the Order painted them (p.295). The app's own drawing, not the tablet's: stage 4 decides
 * how a whole tablet is drawn so. Its words are in the list beside it, so
 * the drawing is hidden from screen readers.
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

/** The fonts a sign's or planet's symbol is drawn in, as text. */
const SYMBOL_FONTS =
  '"Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", "DejaVu Sans", sans-serif';

/** A symbol's inks: its colour, and the outline that sets it off its side. */
interface Inks {
  ink: string;
  outline: string;
}

/** An element's triangle's or Spirit's wheel's strokes, centred on 0, 0. */
function ElementStrokes({ element }: { element: SideElement }) {
  if (element === "spirit")
    return (
      <>
        <circle r={13} />
        {[0, 45, 90, 135].map((angle) => (
          <line key={angle} x1={-13} x2={13} transform={`rotate(${angle})`} />
        ))}
      </>
    );
  const up = element === "fire" || element === "air";
  const tip = up ? -15 : 15;
  const base = up ? 9 : -9;
  return (
    <>
      <path d={`M0 ${tip}L14 ${base}L-14 ${base}Z`} />
      {(element === "air" || element === "earth") && <line x1={-12} x2={12} />}
    </>
  );
}

/** An element's mark: its strokes over a wider stroke of the outline. */
function ElementMark({
  element,
  ink,
  outline,
}: { element: SideElement } & Inks) {
  const stroke = (colour: string, width: number) => ({
    fill: "none",
    stroke: colour,
    strokeWidth: width,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  });
  return (
    <>
      <g style={stroke(outline, 6)} data-outline="">
        <ElementStrokes element={element} />
      </g>
      <g style={stroke(ink, 3)}>
        <ElementStrokes element={element} />
      </g>
    </>
  );
}

/** A geomantic figure: a row of one or two dots for each of its four. */
function Figure({ rows, ink, outline }: { rows: readonly number[] } & Inks) {
  const dots = rows.flatMap((count, row) =>
    (count === 1 ? [0] : [-6, 6]).map((cx) => ({ cx, cy: (row - 1.5) * 8 })),
  );
  return (
    <g
      style={{
        fill: ink,
        stroke: outline,
        strokeWidth: 1.5,
        paintOrder: "stroke",
      }}
      data-outline=""
    >
      {dots.map(({ cx, cy }) => (
        <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={2.8} />
      ))}
    </g>
  );
}

function SideMark({ symbol, ink, outline }: { symbol: SideSymbol } & Inks) {
  if (symbol.kind === "element")
    return <ElementMark element={symbol.element} ink={ink} outline={outline} />;
  if (symbol.kind === "figure")
    return <Figure rows={symbol.rows} ink={ink} outline={outline} />;
  return (
    <text
      y={11}
      data-outline=""
      style={{
        fill: ink,
        // The outline under the glyph, not over it.
        stroke: outline,
        strokeWidth: 3,
        strokeLinejoin: "round",
        paintOrder: "stroke",
        fontSize: symbol.hebrew ? 34 : 32,
        fontFamily: symbol.hebrew
          ? '"Frank Ruhl Libre", "Noto Sans Hebrew", serif'
          : SYMBOL_FONTS,
        textAnchor: "middle",
      }}
      {...(symbol.hebrew ? { direction: "rtl" } : {})}
    >
      {symbol.text}
    </text>
  );
}

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
        const colours =
          SIDE_COLOURS[(side.elementId as SideElement | undefined) ?? "white"];
        const { points, at, turn } = SIDES[index];
        return (
          <g key={side.side} data-side={side.side}>
            <polygon
              points={points}
              style={{ fill: colours.fill, stroke: "#777", strokeWidth: 1.5 }}
            />
            <g
              transform={`translate(${at[0]} ${at[1]})${outward ? ` rotate(${turn})` : ""}`}
            >
              <SideMark
                symbol={sideSymbol(side)}
                ink={colours.symbol}
                outline={colours.outline}
              />
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
