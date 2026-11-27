/**
 * The page's highlights on the 3D tablet (plan 101, stage 4): what the
 * flat drawing outlines, rings or veils, as a tint over each pyramid, and
 * which squares a click may choose. No three.js here.
 */
import {
  HIGHLIGHT_INK,
  HIGHLIGHT_OUTLINE,
  HIGHLIGHT_RING,
  type TabletHighlights,
  type TabletSquare,
} from "magick-components/enochian/Tablet";
import { srgbToLinear, type Tablet3DModel } from "./model";

/** A colour (`#rgb` or `#rrggbb`) and how much of it is mixed over. */
const tint = (hex: string, amount: number) => [
  ...srgbToLinear(hex.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3")),
  amount,
];

/**
 * Each highlight as a colour mixed over a pyramid, and how much: the flat
 * drawing's colours, the outlined squares' violet, the selected one's
 * ring stronger, a previewed name's ring, a chosen name's dark violet,
 * and its white veil over every other square. The amounts are tuned by
 * eye in stage 6 (plan 101).
 */
export const TINTS = {
  selected: tint(HIGHLIGHT_RING, 0.5),
  preview: tint(HIGHLIGHT_RING, 0.3),
  squares: tint(HIGHLIGHT_OUTLINE, 0.25),
  name: tint(HIGHLIGHT_INK, 0.15),
  dimmed: tint("#ffffff", 0.72),
  none: [0, 0, 0, 0],
} as const;

const key = ({ row, column }: TabletSquare) => `${row},${column}`;
const among = (squares: readonly TabletSquare[] = []) => {
  const keys = new Set(squares.map(key));
  return (square: TabletSquare) => keys.has(key(square));
};

/**
 * Each pyramid's tint, four floats a pyramid in the model's order: the
 * selected square first, then a previewed name's, the outlined squares,
 * a chosen name's, and, while a name is chosen, the rest veiled.
 */
export function squareTints(
  model: Tablet3DModel,
  highlights: TabletHighlights | undefined,
): Float32Array {
  const tints = new Float32Array(model.pyramids.length * 4);
  const selected = among(highlights?.selected && [highlights.selected]);
  const previewed = among(highlights?.preview?.squares);
  const outlined = among(highlights?.squares);
  const named = among(highlights?.name?.squares);
  model.pyramids.forEach((square, index) => {
    const kind = selected(square)
      ? "selected"
      : previewed(square)
        ? "preview"
        : outlined(square)
          ? "squares"
          : named(square)
            ? "name"
            : highlights?.name
              ? "dimmed"
              : "none";
    tints.set(TINTS[kind], index * 4);
  });
  return tints;
}

/**
 * The square a click on `square` chooses, as on the flat drawing: an
 * outlined one, or any with `anySquare`; none without `onSelect`.
 */
export function chosenBy(
  highlights: TabletHighlights | undefined,
  { row, column }: TabletSquare,
): TabletSquare | undefined {
  if (!highlights?.onSelect) return undefined;
  const square = { row, column };
  return highlights.anySquare || among(highlights.squares)(square)
    ? square
    : undefined;
}
