import type { ReactNode } from "react";
import { roleAliases } from "../ritualRoles";

export { roleAliases } from "../ritualRoles";

import Lamen from "magick-components/gd/Lamen";

/** Shared officer presentation; reader context may supply its own role map. */
export interface RitualRolePresentation {
  name: string;
  symbol?: ReactNode;
  color?: string;
  /**
   * The name's colour in the dark scheme: `color`'s hue, lighter, so that
   * it reads on the dark bubbles (plan 076, step 5). Without one, `color`.
   */
  darkColor?: string;
}

export const roles: Record<string, RitualRolePresentation> = {
  imperator: {
    name: "Imperator",
    symbol: <Lamen officer="imperator" height={25} />,
    color: "red",
    darkColor: "#ff7a7a",
  },
  praemonstrator: {
    name: "Praemonstrator",
    symbol: <Lamen officer="praemonstrator" height={25} />,
    color: "blue",
    darkColor: "#8ab4f8",
  },
  cancellarius: {
    name: "Cancellarius",
    symbol: <Lamen officer="cancellarius" height={25} />,
    color: "#ca0",
    darkColor: "#e6c34a",
  },
  hierophant: {
    name: "Hierophant",
    symbol: <Lamen officer="hierophant" height={25} />,
    color: "red",
    darkColor: "#ff7a7a",
  },
  pastHierophant: {
    name: "Past Hierophant",
    symbol: <Lamen officer="pastHierophant" height={25} />,
    color: "red",
    darkColor: "#ff7a7a",
  },
  hiereus: {
    name: "Hiereus",
    symbol: <Lamen officer="hiereus" height={25} />,
    color: "black",
    darkColor: "#e4e8ef",
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
    darkColor: "#ee8f8f",
  },
  stolistes: {
    name: "Stolistes",
    symbol: <Lamen officer="stolistes" height={25} />,
    color: "#55c",
    darkColor: "#a3a6ff",
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
    darkColor: "#a6adb8",
  },
  // The Portal's officers (plan 061, stage F): the hall's adept roles.
  // Their colours are ours, after the rubric's (Regardie 1938, vol. 2,
  // p.156): the Chief Adept's yellow collar and nemyss, the Second
  // Adept's orange, the Third Adept's green. Their lamens are the
  // rubric's (stage H, part 2), as the hall draws them.
  chiefAdept: {
    name: "Chief Adept",
    symbol: <Lamen officer="chiefAdept" height={25} />,
    color: "#b8860b",
    darkColor: "#e0b24a",
  },
  secondAdept: {
    name: "Second Adept",
    symbol: <Lamen officer="secondAdept" height={25} />,
    color: "#d06000",
    darkColor: "#ff9d55",
  },
  thirdAdept: {
    name: "Third Adept",
    symbol: <Lamen officer="thirdAdept" height={25} />,
    color: "#108010",
    darkColor: "#62c962",
  },
  candidate: { name: "Candidate", symbol: "🤠", color: "#fcf" },
  aspirant: { name: "Aspirant", symbol: "🤒", color: "#fcf" },
  member: { name: "Member", color: "#ccc" },
  psaltis: {
    name: "Psaltis",
    symbol: "🎵",
    color: "#c55",
    darkColor: "#ee8f8f",
  },
};

for (const [alias, role] of Object.entries(roleAliases)) {
  roles[alias] = roles[role];
}
