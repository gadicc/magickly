import type { ReactNode } from "react";
import { roleAliases } from "../ritualRoles";

export { roleAliases } from "../ritualRoles";

import Lamen from "@magick-components/gd/Lamen";

/** Shared officer presentation; reader context may supply its own role map. */
export interface RitualRolePresentation {
  name: string;
  symbol?: ReactNode;
  color?: string;
}

/**
 * The adepts' role symbol until their lamens are drawn: a plain circle,
 * as the temple hall draws them (plan 061, decision 5).
 */
const plainLamen = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="-50 -50 100 100"
    height={25}
    width={25}
    aria-hidden="true"
  >
    <circle r={47} fill="white" stroke="black" strokeWidth={6} />
  </svg>
);

export const roles: Record<string, RitualRolePresentation> = {
  imperator: {
    name: "Imperator",
    symbol: <Lamen officer="imperator" height={25} />,
    color: "red",
  },
  praemonstrator: {
    name: "Praemonstrator",
    symbol: <Lamen officer="praemonstrator" height={25} />,
    color: "blue",
  },
  cancellarius: {
    name: "Cancellarius",
    symbol: <Lamen officer="cancellarius" height={25} />,
    color: "#ca0",
  },
  hierophant: {
    name: "Hierophant",
    symbol: <Lamen officer="hierophant" height={25} />,
    color: "red",
  },
  pastHierophant: {
    name: "Past Hierophant",
    symbol: <Lamen officer="pastHierophant" height={25} />,
    color: "red",
  },
  hiereus: {
    name: "Hiereus",
    symbol: <Lamen officer="hiereus" height={25} />,
    color: "black",
  },
  hegemon: {
    name: "Hegemon",
    symbol: <Lamen officer="hegemon" height={25} />,
    color: "#aaa",
  },
  keryx: {
    name: "Keryx",
    symbol: <Lamen officer="keryx" height={25} />,
    color: "#c55",
  },
  stolistes: {
    name: "Stolistes",
    symbol: <Lamen officer="stolistes" height={25} />,
    color: "#55c",
  },
  dadouchos: {
    name: "Dadouchos",
    symbol: <Lamen officer="dadouchos" height={25} />,
    color: "#cc5",
  },
  sentinel: {
    name: "Sentinel",
    symbol: <Lamen officer="sentinel" height={25} />,
    color: "#777",
  },
  // The Portal's officers (plan 061, stage F): the hall's adept roles.
  // Their colours are ours, after the rubric's (Regardie 1938, vol. 2,
  // p.156): the Chief Adept's yellow collar and nemyss, the Second
  // Adept's orange, the Third Adept's green.
  chiefAdept: { name: "Chief Adept", symbol: plainLamen, color: "#b8860b" },
  secondAdept: { name: "Second Adept", symbol: plainLamen, color: "#d06000" },
  thirdAdept: { name: "Third Adept", symbol: plainLamen, color: "#108010" },
  candidate: { name: "Candidate", symbol: "🤠", color: "#fcf" },
  aspirant: { name: "Aspirant", symbol: "🤒", color: "#fcf" },
  member: { name: "Member", color: "#ccc" },
  psaltis: { name: "Psaltis", symbol: "🎵", color: "#c55" },
};

for (const [alias, role] of Object.entries(roleAliases)) {
  roles[alias] = roles[role];
}
