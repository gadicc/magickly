import { enumAttr } from "../attributes";
import type { HallArt, HallArtProps, HallNode } from "../types";
import { original, PALETTE, variantOf } from "./shared";

export const provenance = original(
  "A labelled box or circle, as the book marks objects and the candidate.",
);

const isCircle = (node: HallNode) =>
  enumAttr(node, "shape", ["box", "circle"]) === "circle";

function Marker({ node }: HallArtProps) {
  return isCircle(node) ? (
    <circle r={48} fill={PALETTE.paper} stroke={PALETTE.ink} strokeWidth={3} />
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
  );
}

/**
 * A marker: text in a box or circle, for objects without art yet. The
 * layout sets the text over it (`ResolvedObject.inner`), so it counts
 * against the hall's label lines.
 */
export const markerArt: HallArt = {
  Component: Marker,
  box: { width: 100, height: 100 },
  variant: (node) => variantOf(isCircle(node)),
  provenance,
};
