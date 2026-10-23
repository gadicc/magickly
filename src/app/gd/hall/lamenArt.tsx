import {
  defaultHallArt,
  type HallArt,
  type HallArtProps,
} from "@magick-components/gd/hall";
import { stringAttr } from "@magick-components/gd/hall/attributes";
import { HALL_ROLES } from "@magick-components/gd/hall/vocabulary";
import Lamen, { LAMEN_OFFICERS } from "../components/lamen";

const fallback = defaultHallArt.get("lamen") as HallArt;

/**
 * Whether a node draws the package's plain circle: without a role, as the
 * validator promises, or with a hall role whose lamen `Lamen` does not
 * draw yet (the adepts', plan 061 decision 5: labelled circles). Any
 * other role draws through `Lamen`, an unknown one as its plain lamen.
 */
const plainCircle = (role: string) =>
  role === "" || (HALL_ROLES.has(role) && !LAMEN_OFFICERS.has(role));

/** `Lamen` drawn in its 100 × 100 box, centred, or the plain circle. */
function HallLamen(props: HallArtProps) {
  const role = stringAttr(props.node, "role", 200);
  if (role === undefined || plainCircle(role))
    return <fallback.Component {...props} />;
  return (
    <g transform="translate(-50 -50)">
      <Lamen officer={role} width={100} height={100} />
    </g>
  );
}

/**
 * The officers' lamens for the hall (plan 061, decision 9), injected from
 * the app while `Lamen` lives here.
 */
export const lamenArt: HallArt = {
  Component: HallLamen,
  box: { width: 100, height: 100 },
  // 1.6 squares in an officer's 2-square cell (DEFAULT_SCALES).
  inset: fallback.inset,
  // A role `Lamen` does not know draws its plain lamen, whatever the
  // name, unless it is a hall role (an adept): the plain circle.
  variant: (node) => {
    const role = stringAttr(node, "role", 200);
    if (role === undefined || plainCircle(role)) return "";
    return LAMEN_OFFICERS.has(role) ? role : "?";
  },
  provenance: {
    origin: "original",
    author: "Gadi Cohen",
    licence: "AGPL-3.0-or-later",
    source: "src/app/gd/components/lamen.tsx",
    notes:
      "Drawn for this app; the Keryx's caduceus and the Sentinel's Eye of " +
      "Horus redrawn from geometry in stage H.",
  },
};
