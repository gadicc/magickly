import Lamen, { LAMEN_OFFICERS } from "../../Lamen";
import { stringAttr } from "../attributes";
import type { HallArt, HallArtProps, HallNode } from "../types";
import { original, PALETTE } from "./shared";

export const provenance = original(
  "The officers' lamens, drawn by `Lamen` (src/components/gd/Lamen.tsx): " +
    "the collar's ring, the disc and the officer's glyph; a plain circle " +
    "for an officer without a role.",
);

/**
 * Whether a node draws the plain circle: without a role, as the validator
 * promises. Every hall role has its lamen since stage H, part 2 (the
 * adepts' were labelled circles before); any other role draws through
 * `Lamen` as its plain lamen.
 */
const plainCircle = (role: string | undefined): role is undefined | "" =>
  role === undefined || role === "";

const roleOf = (node: HallNode) => stringAttr(node, "role", 200);

/** An officer's lamen in its 100 × 100 box, centred, or the plain circle. */
function HallLamen({ node }: HallArtProps) {
  const role = roleOf(node);
  if (plainCircle(role))
    return (
      <circle
        r={47}
        fill={PALETTE.paper}
        stroke={PALETTE.ink}
        strokeWidth={6}
      />
    );
  return (
    <g transform="translate(-50 -50)">
      <Lamen officer={role} width={100} height={100} />
    </g>
  );
}

/** The officers' lamens (plan 061, decision 9). */
export const lamenArt: HallArt = {
  Component: HallLamen,
  box: { width: 100, height: 100 },
  // 1.6 squares in an officer's 2-square cell (layout.ts, DEFAULT_SCALES).
  inset: 0.8,
  // A role `Lamen` does not know draws its plain lamen, whatever the name.
  variant: (node) => {
    const role = roleOf(node);
    if (plainCircle(role)) return "";
    return LAMEN_OFFICERS.has(role) ? role : "?";
  },
  provenance,
};
