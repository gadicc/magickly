import { booleanAttr, enumAttr } from "../attributes";
import type { HallArt, HallArtProps, HallNode } from "../types";
import { triangle } from "./geometry";
import { original, PALETTE, variantOf } from "./shared";

export const provenance = original(
  "Redrawn from geometry after Gadi Cohen's hall drawings: a disc with a " +
    "downward (black) or upward (white) triangle; glow adds the Neophyte " +
    "drawing's red radial light inside a grey-rimmed triangle.",
);

const isBlack = (node: HallNode) =>
  enumAttr(node, "kind", ["black", "white"]) !== "white";
const glows = (node: HallNode) => booleanAttr(node, "glow") === true;

function Pillar({ node, defId }: HallArtProps) {
  const black = isBlack(node);
  const dir = black ? "down" : "up";
  if (glows(node)) {
    const glow = defId("glow");
    return (
      <>
        <defs>
          <radialGradient
            id={glow}
            cx={0}
            cy={0}
            r={40}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset={0} stopColor={PALETTE.glow} />
            <stop offset={1} stopColor={PALETTE.glow} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle
          r={48.8}
          fill={black ? PALETTE.ink : PALETTE.paper}
          stroke={PALETTE.rim}
          strokeWidth={2.4}
        />
        <polygon
          points={triangle(44, dir)}
          fill={`url(#${glow})`}
          stroke={PALETTE.rim}
          strokeWidth={5}
          strokeLinejoin="miter"
        />
      </>
    );
  }
  return (
    <>
      <circle
        r={black ? 50 : 48.5}
        fill={black ? PALETTE.ink : PALETTE.paper}
        stroke={black ? "none" : PALETTE.ink}
        strokeWidth={3}
      />
      <polygon
        points={triangle(38, dir)}
        fill={black ? PALETTE.paper : PALETTE.ink}
      />
    </>
  );
}

/** A pillar: black (downward triangle) or white (upward), in 2 × 2 squares. */
export const pillarArt: HallArt = {
  Component: Pillar,
  box: { width: 100, height: 100 },
  variant: (node) => variantOf(isBlack(node), glows(node)),
  provenance,
};
