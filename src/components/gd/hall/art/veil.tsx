import type { HallArt } from "../types";
import { original, PALETTE, sameForEveryNode } from "./shared";

export const provenance = original(
  "A curtain seen from above: a band with its pleats, drawn from geometry.",
);

/** The veil's box in squares at scale 1: the hall's width, a band deep. */
const BOX = { width: 16, height: 0.4 };
/** A pleat every half square, as lines across the band. */
const PLEAT = 0.5;

const pleats = Array.from(
  { length: BOX.width / PLEAT - 1 },
  (_, i) => -BOX.width / 2 + (i + 1) * PLEAT,
)
  .map((x) => `M${x},${-BOX.height / 2}v${BOX.height}`)
  .join("");

/**
 * The Portal's veil (`veil`), the curtain across the dais before the
 * Chief Adept: 16 × 0.4 squares at `scale=1`, the hall's width, sized by
 * `scale`, so a hall draws it once however often it is placed.
 */
export const veilArt: HallArt = {
  Component: () => (
    <>
      <rect
        x={-BOX.width / 2}
        y={-BOX.height / 2}
        width={BOX.width}
        height={BOX.height}
        fill={PALETTE.veil}
        stroke={PALETTE.ink}
        strokeWidth={0.04}
      />
      <path d={pleats} stroke={PALETTE.veilPleat} strokeWidth={0.03} />
    </>
  ),
  box: BOX,
  fit: "squares",
  variant: sameForEveryNode,
  provenance,
};
