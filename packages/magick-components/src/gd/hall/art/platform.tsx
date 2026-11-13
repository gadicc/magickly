import { clamp, numberAttr } from "../attributes";
import type { HallArt, HallArtProps, HallNode } from "../types";
import { SIZE_RANGE } from "../vocabulary";
import { original, PALETTE, sameForEveryNode } from "./shared";

export const provenance = original(
  "A white rectangle with a black outline, sized in squares by w and h.",
);

/** Outline width, in squares. */
const STROKE = 0.06;

/** A box `w` × `h` squares, `width` × `height` unless they say otherwise. */
export const sized = (width: number, height: number) => (node: HallNode) => ({
  width: clamp(numberAttr(node, "w") ?? width, ...SIZE_RANGE),
  height: clamp(numberAttr(node, "h") ?? height, ...SIZE_RANGE),
});

/** The white rectangle every platform, throne and board draws. */
export function Platform({ box }: Pick<HallArtProps, "box">) {
  return (
    <rect
      x={-box.width / 2}
      y={-box.height / 2}
      width={box.width}
      height={box.height}
      fill={PALETTE.paper}
      stroke={PALETTE.ink}
      strokeWidth={STROKE}
    />
  );
}

const art = (width: number, height: number): HallArt => ({
  Component: Platform,
  box: sized(width, height),
  fit: "squares",
  // The box (w × h) is all it draws, and the box is part of the key.
  variant: sameForEveryNode,
  provenance,
});

/** A raised platform (4 × 3 squares unless w and h say otherwise). */
export const platformArt = art(4, 3);
/** A throne (2 × 2 squares unless w and h say otherwise). */
export const throneArt = art(2, 2);
