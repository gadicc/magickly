import type { ReactNode } from "react";
import { roleAliases } from "../ritualRoles";

export { roleAliases } from "../ritualRoles";

import Lamen from "@/app/gd/components/lamen";

/** Shared officer presentation; reader context may supply its own role map. */
export interface RitualRolePresentation {
  name: string;
  symbol?: ReactNode;
  color?: string;
}

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
    symbol: (
      <span>
        (<Lamen officer="hierophant" height={25} />)
      </span>
    ),
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
  candidate: { name: "Candidate", symbol: "🤠", color: "#fcf" },
  aspirant: { name: "Aspirant", symbol: "🤒", color: "#fcf" },
  member: { name: "Member", color: "#ccc" },
  psaltis: { name: "Psaltis", symbol: "🎵", color: "#c55" },
};

for (const [alias, role] of Object.entries(roleAliases)) {
  roles[alias] = roles[role];
}
