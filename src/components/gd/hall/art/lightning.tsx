import type { HallArt } from "../types";
import { points } from "./geometry";
import { original, PALETTE } from "./shared";

export const provenance = {
  ...original(
    "The Flaming Sword as a zig-zag, after Gadi Cohen's drawing in " +
      "public/pics/theoricus2.svg (g3-8), with the arrowhead drawn as a " +
      "triangle instead of an SVG marker.",
  ),
  source: "public/pics/theoricus2.svg#g3-8",
};

const STROKE = 3.8;
const ZIGZAG: readonly (readonly [number, number])[] = [
  [0.1, -48.1],
  [20.4, -36.3],
  [-20.6, -36.4],
  [20.4, -13.4],
  [-20.6, -13.8],
  [20.6, 10],
  [-19.9, 9.9],
  [1.1, 21.6],
  [1.4, 40.2],
];

function Lightning() {
  return (
    <g stroke={PALETTE.ink} strokeWidth={STROKE} fill="none">
      <polyline points={points(ZIGZAG)} strokeLinejoin="miter" />
      <line x1={11} y1={-47.8} x2={5.8} y2={-38.6} />
      <polygon
        points={points([
          [1.5, 50],
          [-4.3, 40.3],
          [7, 40.1],
        ])}
        fill={PALETTE.ink}
        stroke="none"
      />
    </g>
  );
}

/** The Flaming Sword, the lightning flash down the Tree (`item(kind="lightning")`). */
export const lightningArt: HallArt = {
  Component: Lightning,
  box: { width: 45.1, height: 100 },
  provenance,
};
