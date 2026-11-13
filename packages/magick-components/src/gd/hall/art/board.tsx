import { TreeFigure } from "../../../kabbalah/treeOfLifeFigure";
import { svgCoordinate } from "../../../svgCoordinate";
import { enumAttr } from "../attributes";
import { GD_HALL_FONT_STACKS } from "../fonts";
import { LINE_HEIGHT, wrapText } from "../labels";
import type { HallArt, HallArtProps, HallNode } from "../types";
import { BOARD_KINDS, BOARD_NAMES, type BoardKind } from "../vocabulary";
import { Platform, sized } from "./platform";
import { original, PALETTE, variantOf } from "./shared";

export const provenance = original(
  "A board on a stand: a white rectangle sized in squares. The Flaming " +
    "Sword and the Minutum Mundum draw the Tree of Life's figure (the " +
    "package's own TreeOfLife geometry, Gadi Cohen); the Garden of Eden " +
    "and the Fall are labelled with their names until they are drawn.",
);

/** A board with a diagram: 2 × 3 squares, the Tree's proportions. */
const DIAGRAM = { width: 2, height: 3 };
/** The margin inside the board, in squares. */
const MARGIN = 0.12;
/** The title's size and the units it is set in (squares × 100). */
const TITLE_SIZE = 30;

const kindOf = (node: HallNode): BoardKind | undefined =>
  enumAttr(node, "kind", BOARD_KINDS);

const plainBox = sized(2, 3);

function Board({ node, box }: HallArtProps) {
  const kind = kindOf(node);
  const inner = {
    width: box.width - 2 * MARGIN,
    height: box.height - 2 * MARGIN,
  };
  if (kind === "flamingSword" || kind === "minutumMundum")
    return (
      <>
        <Platform box={box} />
        <g transform={`translate(${-inner.width / 2} ${-inner.height / 2})`}>
          <TreeFigure
            width={inner.width}
            height={inner.height}
            flash={kind === "flamingSword"}
          />
        </g>
      </>
    );
  const title = kind ? BOARD_NAMES.get(kind) : undefined;
  // Text at a large size inside a scaled group (decision 6).
  const lines = title ? wrapText(title, inner.width * 100, TITLE_SIZE) : [];
  const advance = TITLE_SIZE * LINE_HEIGHT;
  const first = TITLE_SIZE * 0.36 - ((lines.length - 1) * advance) / 2;
  return (
    <>
      <Platform box={box} />
      {lines.length > 0 && (
        <g
          transform="scale(0.01)"
          fill={PALETTE.ink}
          fontFamily={GD_HALL_FONT_STACKS.serif}
          fontStyle="italic"
          fontSize={TITLE_SIZE}
          textAnchor="middle"
          style={{ fontVariantLigatures: "none", fontKerning: "normal" }}
        >
          {lines.map((line, index) => (
            <text
              // biome-ignore lint/suspicious/noArrayIndexKey: lines keep their order
              key={index}
              y={svgCoordinate(first + index * advance)}
            >
              {line.text}
            </text>
          ))}
        </g>
      )}
    </>
  );
}

/**
 * A board on a stand (`board(kind="flamingSword")`), a host for markers.
 * A plain board is `w` × `h` squares (2 × 3 unless they say otherwise); a
 * board with a diagram is 2 × 3 at `scale=1`, sized by `scale`, so each
 * diagram is drawn once per hall however many boards show it.
 */
export const boardArt: HallArt = {
  Component: Board,
  box: (node) => (kindOf(node) ? DIAGRAM : plainBox(node)),
  fit: "squares",
  variant: (node) => variantOf(kindOf(node)),
  provenance,
};
