import {
  defaultHallArt,
  type HallArt,
  type HallArtProps,
} from "@magick-components/gd/hall";
import { stringAttr } from "@magick-components/gd/hall/attributes";
import Lamen from "../components/lamen";

const fallback = defaultHallArt.get("lamen") as HallArt;

/**
 * `Lamen` drawn in its 100 × 100 box, centred. A node without a role keeps
 * the package's plain circle, as the validator promises.
 */
function HallLamen(props: HallArtProps) {
  const role = stringAttr(props.node, "role", 200);
  if (role === undefined || role === "")
    return <fallback.Component {...props} />;
  return (
    <g transform="translate(-50 -50)">
      <Lamen officer={role} width={100} height={100} />
    </g>
  );
}

/**
 * The officers' lamens for the hall (plan 061, decision 9). `Lamen` is Gadi
 * Cohen's own drawing except two paths, so it stays in the AGPL app and is
 * injected; it moves to the MIT package in stage H, once both are redrawn.
 */
export const lamenArt: HallArt = {
  Component: HallLamen,
  box: { width: 100, height: 100 },
  provenance: {
    origin: "thirdParty",
    author:
      "Gadi Cohen; the caduceus by Icooon Mono, the Eye of Horus by game-icons.net",
    licence:
      "AGPL-3.0-or-later; the caduceus is labelled public domain by SVG Repo " +
      "(not its author's own licence text); the Eye of Horus is CC BY",
    source: "src/app/gd/components/lamen.tsx",
    notes:
      "Two third-party paths: the Kerux's caduceus " +
      "(svgrepo.com/svg/482800/caduceus-staff-icon) and the Sentinel's Eye " +
      "of Horus (svgrepo.com/svg/322283/eye-of-horus), credited on " +
      "/about#credits. Replace both in stage H.",
  },
};
