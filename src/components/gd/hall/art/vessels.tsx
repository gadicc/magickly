import type { HallArt } from "../types";
import { mirrored } from "./geometry";
import {
  HIGHLIGHT,
  ITEM_DETAIL,
  ITEM_OUTLINE,
  original,
  PALETTE,
  sameForEveryNode,
} from "./shared";

/**
 * The vessels (plan 061, stage H): flat emblems in the hall's palette
 * with the items' one outline. Each body is a lathe profile, its right
 * half written as a few lines and Bézier curves and mirrored; rims and
 * knops are ellipses. Drawn into the boxes the drawings' items had, so
 * saved halls keep their layout (decision 4).
 */

export const cupProvenance = original(
  "The Neophyte's cup of wine, drawn from geometry: a wide goblet on a " +
    "short stem, its rim and knop ellipses, the wine at the brim.",
);
export const chaliceProvenance = original(
  "The chalice, drawn from geometry: a tall bowl with a jewelled band, a " +
    "knopped stem and a wide foot.",
);
export const censerProvenance = original(
  "A standing censer, drawn from geometry: a domed lid pierced and glowing " +
    "on a bowl, a stem and a foot.",
);

/** Every art module exports its provenance; the vessels share a module. */
export const provenance = [cupProvenance, chaliceProvenance, censerProvenance];

const CUP = mirrored(
  [0, -42],
  [
    { to: [35.5, -42] },
    { c1: [35.5, -15], c2: [24.5, 1.5], to: [7, 5] },
    { to: [5.5, 30] },
    { c1: [5.5, 38], c2: [24, 40], to: [28, 44] },
    { to: [28, 48] },
    { to: [0, 48] },
  ],
);

/** The cup (`item(kind="cup")`), 76.67 × 100. */
export const cupArt: HallArt = {
  Component: () => (
    <g {...ITEM_OUTLINE}>
      <path d={CUP} fill={PALETTE.gold} />
      <ellipse cy={15} rx={10.5} ry={5} fill={PALETTE.goldDeep} />
      <ellipse cy={-42} rx={35.5} ry={6} fill={PALETTE.goldDeep} />
      <ellipse cy={-41.3} rx={30} ry={3.9} fill={PALETTE.wine} stroke="none" />
      <path d="M-27,-30C-25,-17 -18,-8 -8,-4" {...HIGHLIGHT} />
    </g>
  ),
  box: { width: 76.67, height: 100 },
  variant: sameForEveryNode,
  provenance: cupProvenance,
};

const CHALICE = mirrored(
  [0, -44],
  [
    { to: [25.5, -44] },
    { c1: [25.5, -22], c2: [19, -8], to: [5.5, -4] },
    { to: [4, 26] },
    { c1: [4, 36], c2: [20, 39], to: [25.5, 43] },
    { to: [25.5, 48] },
    { to: [0, 48] },
  ],
);
/** The chalice's three jewels on its band, as rhombi. */
const JEWELS = [-13, 0, 13]
  .map((x) => `M${x},-33.4L${x + 3.4},-30L${x},-26.6L${x - 3.4},-30Z`)
  .join("");

/** The chalice (`item(kind="chalice")`), 56.17 × 100. */
export const chaliceArt: HallArt = {
  Component: () => (
    <g {...ITEM_OUTLINE}>
      <path d={CHALICE} fill={PALETTE.gold} />
      <path
        d="M-25,-33H25L24.3,-27H-24.3Z"
        fill={PALETTE.goldDeep}
        strokeWidth={ITEM_DETAIL}
      />
      <path d={JEWELS} fill={PALETTE.rose} strokeWidth={1.6} />
      <ellipse cy={-44} rx={25.5} ry={4} fill={PALETTE.goldDeep} />
      <ellipse cy={6} rx={9.5} ry={5} fill={PALETTE.goldDeep} />
      <ellipse
        cy={20}
        rx={6.5}
        ry={2.4}
        fill={PALETTE.goldDeep}
        strokeWidth={ITEM_DETAIL}
      />
      <path d="M-18.5,-23C-16.5,-15 -12,-9.5 -6,-7.5" {...HIGHLIGHT} />
    </g>
  ),
  box: { width: 56.17, height: 100 },
  variant: sameForEveryNode,
  provenance: chaliceProvenance,
};

const CENSER_LID = mirrored(
  [0, -36],
  [{ c1: [15, -36], c2: [26, -27], to: [26, -10] }, { to: [0, -10] }],
);
const CENSER_BOWL = mirrored(
  [0, -2],
  [
    { to: [29, -2] },
    { c1: [29, 14], c2: [18, 22], to: [7, 24] },
    { to: [6, 33] },
    { c1: [10, 36], c2: [22, 40], to: [22, 45] },
    { to: [22, 48] },
    { to: [0, 48] },
  ],
);
/** The lid's piercings, glowing: the censer is lit. */
const CENSER_HOLES = [
  [0, -25],
  [-12, -18],
  [12, -18],
] as const;

/** The censer (`item(kind="censer")`), standing, 73.69 × 100. */
export const censerArt: HallArt = {
  Component: () => (
    <g {...ITEM_OUTLINE}>
      <path d="M-2.5,-41V-36H2.5V-41Z" fill={PALETTE.bronze} />
      <circle cy={-44} r={4} fill={PALETTE.bronze} />
      <path d={CENSER_LID} fill={PALETTE.silver} />
      {CENSER_HOLES.map(([cx, cy]) => (
        <circle
          key={cx}
          cx={cx}
          cy={cy}
          r={3.2}
          fill={PALETTE.flame}
          strokeWidth={ITEM_DETAIL}
        />
      ))}
      <path d={CENSER_BOWL} fill={PALETTE.silver} />
      <ellipse cy={29} rx={9} ry={3.5} fill={PALETTE.bronze} />
      <rect
        x={-31}
        y={-10}
        width={62}
        height={7}
        rx={2}
        fill={PALETTE.bronze}
      />
      <path d="M-22,4C-21,11 -16,16 -9,18" {...HIGHLIGHT} />
    </g>
  ),
  box: { width: 73.69, height: 100 },
  variant: sameForEveryNode,
  provenance: censerProvenance,
};
