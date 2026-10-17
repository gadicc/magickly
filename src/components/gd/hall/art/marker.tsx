import { svgCoordinate } from "../../../svgCoordinate";
import { enumAttr, stringAttr } from "../attributes";
import { GD_HALL_FONT_STACKS } from "../fonts";
import { LINE_HEIGHT, labelFont, wrapText } from "../labels";
import type { HallArt, HallArtProps } from "../types";
import { original, PALETTE } from "./shared";

export const provenance = original(
  "A labelled box or circle, as the book marks objects and the candidate.",
);

/** Inner width the text wraps to, in art units. */
const INNER = 84;
/** Marker text is smaller than labels: a marker is only 1.2 squares wide. */
const TEXT_SCALE = 0.7;

function Marker({ node, unitsPerSquare, labelSize }: HallArtProps) {
  const circle = enumAttr(node, "shape", ["box", "circle"]) === "circle";
  const text = stringAttr(node, "text", 200) ?? "";
  const lines = wrapText(text, INNER / unitsPerSquare, labelSize * TEXT_SCALE);
  const size = labelSize * TEXT_SCALE * unitsPerSquare;
  const advance = size * LINE_HEIGHT;
  const first =
    -((lines.length - 1) * advance) / 2 +
    ((labelFont.top - labelFont.bottom) * size) / 2;
  return (
    <>
      {circle ? (
        <circle
          r={48}
          fill={PALETTE.paper}
          stroke={PALETTE.ink}
          strokeWidth={3}
        />
      ) : (
        <rect
          x={-48}
          y={-48}
          width={96}
          height={96}
          fill={PALETTE.paper}
          stroke={PALETTE.ink}
          strokeWidth={3}
        />
      )}
      {lines
        .map((line, index) => ({
          ...line,
          y: svgCoordinate(first + index * advance),
        }))
        .map((line) => (
          <text
            key={line.y}
            x={0}
            y={line.y}
            fontSize={svgCoordinate(size)}
            fontFamily={GD_HALL_FONT_STACKS.serif}
            fontStyle="italic"
            textAnchor="middle"
            fill={PALETTE.ink}
            style={{ fontVariantLigatures: "none", fontKerning: "normal" }}
          >
            {line.text}
          </text>
        ))}
    </>
  );
}

/** A marker: text in a box or circle, for objects without art yet. */
export const markerArt: HallArt = {
  Component: Marker,
  box: { width: 100, height: 100 },
  provenance,
};
