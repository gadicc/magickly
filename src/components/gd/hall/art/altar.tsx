import type { HallArt } from "../types";
import { original, PALETTE } from "./shared";

export const provenance = original(
  "The altar's black double cube seen from above: a square, as in the drawings.",
);

/** The altar: a black 2 × 2-square top, and a host for what lies on it. */
export const altarArt: HallArt = {
  Component: () => (
    <rect x={-50} y={-50} width={100} height={100} fill={PALETTE.ink} />
  ),
  box: { width: 100, height: 100 },
  provenance,
};
