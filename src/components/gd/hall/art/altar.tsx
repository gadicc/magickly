import { enumAttr } from "../attributes";
import type { HallArt, HallArtProps, HallNode } from "../types";
import { ALTAR_KINDS } from "../vocabulary";
import { original, PALETTE, variantOf } from "./shared";

export const provenance = original(
  "The altar seen from above: the black double cube as a black square, as " +
    "in the drawings, or the small white altar as a white one.",
);

const kindOf = (node: HallNode) =>
  enumAttr(node, "kind", ALTAR_KINDS) ?? "black";

function Altar({ node }: HallArtProps) {
  return kindOf(node) === "white" ? (
    <rect
      x={-48}
      y={-48}
      width={96}
      height={96}
      fill={PALETTE.paper}
      stroke={PALETTE.ink}
      strokeWidth={4}
    />
  ) : (
    <rect x={-50} y={-50} width={100} height={100} fill={PALETTE.ink} />
  );
}

/**
 * The altar: a black 2 × 2-square top, or a white one (`kind="white"`,
 * the Portal's small white altar, sized by `scale`), and a host for what
 * lies on it.
 */
export const altarArt: HallArt = {
  Component: Altar,
  box: { width: 100, height: 100 },
  variant: (node) => variantOf(kindOf(node)),
  provenance,
};
