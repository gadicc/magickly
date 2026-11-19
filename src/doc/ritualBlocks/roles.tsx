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

/**
 * Lamens take their size from the role line (`.roleSymbol svg`), in em.
 *
 * The officers' colours (plan 089, "Officer colours"): every light `color`
 * reads at 4.5:1 or more on the bubbles, the surface and the reader's own
 * tints, and every `darkColor` on the dark ones. The Hierophant keeps the
 * red of the lamen and collar, the Stolistes the blue of water, and the
 * Dadouchos takes fire's orange; the Keryx is teal only to stand apart
 * from the Hierophant, the Hegemon steel blue for the white robe, which
 * cannot be text. `roles.test.tsx` pins both and keeps one hall's
 * officers apart.
 */
export const roles: Record<string, RitualRolePresentation> = {
  imperator: {
    name: "Imperator",
    symbol: <Lamen officer="imperator" />,
    color: "#c80000",
    darkColor: "#ff7a7a",
  },
  praemonstrator: {
    name: "Praemonstrator",
    symbol: <Lamen officer="praemonstrator" />,
    color: "#0000ff",
    darkColor: "#7aa2ff",
  },
  cancellarius: {
    name: "Cancellarius",
    symbol: <Lamen officer="cancellarius" />,
    color: "#776000",
    darkColor: "#e6c34a",
  },
  hierophant: {
    name: "Hierophant",
    symbol: <Lamen officer="hierophant" />,
    color: "#c80000",
    darkColor: "#ff7a7a",
  },
  pastHierophant: {
    name: "Past Hierophant",
    symbol: <Lamen officer="pastHierophant" />,
    color: "#c80000",
    darkColor: "#ff7a7a",
  },
  hiereus: {
    name: "Hiereus",
    symbol: <Lamen officer="hiereus" />,
    color: "#000000",
    darkColor: "#e4e8ef",
  },
  hegemon: {
    name: "Hegemon",
    symbol: <Lamen officer="hegemon" />,
    color: "#3d6a8a",
    darkColor: "#a0d0e0",
  },
  keryx: {
    name: "Keryx",
    symbol: <Lamen officer="keryx" />,
    color: "#00756e",
    darkColor: "#5ccabf",
  },
  stolistes: {
    name: "Stolistes",
    symbol: <Lamen officer="stolistes" />,
    color: "#55c",
    darkColor: "#b7a6ff",
  },
  dadouchos: {
    name: "Dadouchos",
    symbol: <Lamen officer="dadouchos" />,
    color: "#b04500",
    darkColor: "#ffa04a",
  },
  sentinel: {
    name: "Sentinel",
    symbol: <Lamen officer="sentinel" />,
    color: "#666666",
    darkColor: "#a6adb8",
  },
  // The Portal's officers (plan 061, stage F): the hall's adept roles.
  // Their colours are ours, after the rubric's (Regardie 1938, vol. 2,
  // p.156): the Chief Adept's yellow collar and nemyss, the Second
  // Adept's orange, the Third Adept's green. Their lamens are the
  // rubric's (stage H, part 2), as the hall draws them.
  chiefAdept: {
    name: "Chief Adept",
    symbol: <Lamen officer="chiefAdept" />,
    color: "#896200",
    darkColor: "#e0b24a",
  },
  secondAdept: {
    name: "Second Adept",
    symbol: <Lamen officer="secondAdept" />,
    color: "#aa4e04",
    darkColor: "#ff9d55",
  },
  thirdAdept: {
    name: "Third Adept",
    symbol: <Lamen officer="thirdAdept" />,
    color: "#007a03",
    darkColor: "#62c962",
  },
  candidate: {
    name: "Candidate",
    symbol: "🤠",
    color: "#a3329c",
    darkColor: "#ffccff",
  },
  aspirant: {
    name: "Aspirant",
    symbol: "🤒",
    color: "#a3329c",
    darkColor: "#ffccff",
  },
  // The members are the body of the hall, not an office: their name takes
  // the text's own colour and their directions the neutral rule.
  member: { name: "Member" },
  psaltis: {
    name: "Psaltis",
    symbol: "🎵",
    color: "#00756e",
    darkColor: "#5ccabf",
  },
};

for (const [alias, role] of Object.entries(roleAliases)) {
  roles[alias] = roles[role];
}
