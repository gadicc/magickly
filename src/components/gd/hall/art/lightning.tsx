import { enumAttr } from "../attributes";
import type { HallArt, HallArtProps, HallNode } from "../types";
import { HALL_COLOURS } from "../vocabulary";
import { points } from "./geometry";
import { original, PALETTE, variantOf } from "./shared";

export const provenance = {
  ...original(
    "The Flaming Sword as a zig-zag, after Gadi Cohen's own design, with " +
      "the arrowhead drawn as a triangle instead of an SVG marker.",
  ),
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

const COLOUR_NAMES = [...HALL_COLOURS.keys()];

/** `stroke` names a colour, so the flash shows on the black altar too. */
const inkOf = (node: HallNode) => {
  const name = enumAttr(node, "stroke", COLOUR_NAMES);
  return name === undefined ? PALETTE.ink : (HALL_COLOURS.get(name) as string);
};

function Lightning({ node }: HallArtProps) {
  const ink = inkOf(node);
  return (
    <g stroke={ink} strokeWidth={STROKE} fill="none">
      <polyline points={points(ZIGZAG)} strokeLinejoin="miter" />
      <line x1={11} y1={-47.8} x2={5.8} y2={-38.6} />
      <polygon
        points={points([
          [1.5, 50],
          [-4.3, 40.3],
          [7, 40.1],
        ])}
        fill={ink}
        stroke="none"
      />
    </g>
  );
}

/**
 * The Flaming Sword, the lightning flash down the Tree
 * (`item(kind="lightning")`), black unless `stroke` names a colour.
 */
export const lightningArt: HallArt = {
  Component: Lightning,
  box: { width: 45.1, height: 100 },
  variant: (node) => variantOf(inkOf(node)),
  provenance,
};
