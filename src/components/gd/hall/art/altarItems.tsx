import type { HallArt } from "../types";
import { mirrored, type Point, pathPoint, polar } from "./geometry";
import {
  HIGHLIGHT,
  ITEM_DETAIL,
  ITEM_OUTLINE,
  original,
  PALETTE,
  sameForEveryNode,
} from "./shared";

/**
 * The rose, the salt, the bread and the fan (plan 061, stage H): flat
 * emblems in the hall's palette with the items' one outline, drawn into
 * the boxes the old drawings' items had (decision 4).
 */

export const roseProvenance = original(
  "A heraldic rose laid down: five petals over five, the barbs between " +
    "them and the seed, on a stem with two leaves and two thorns, drawn " +
    "from circles and curves.",
);
export const saltProvenance = original(
  "A salt shaker drawn from geometry: a pierced silver cap on a glass of " +
    "salt marked with salt's alchemical sign.",
);
export const breadProvenance = original(
  "A round loaf drawn from curves, its crust scored three times.",
);
export const fanProvenance = original(
  "A folding fan in Air's yellow, drawn from geometry: twelve ribs about " +
    "a rivet, the leaf scalloped between them.",
);

/** Every art module exports its provenance; these share a module. */
export const provenance = [
  roseProvenance,
  saltProvenance,
  breadProvenance,
  fanProvenance,
];

const p = pathPoint;
const PETALS = [0, 1, 2, 3, 4];

/** The rose's head: centred on the stem's East end, radius 15.5. */
const HEAD: Point = [-31.5, 0];
const K = 15.5 / 18;
/** The petals, outer then inner, as [x, y, r]. */
const ROSE_PETALS = [
  ...PETALS.map((i) => [...polar(9 * K, -90 + i * 72, HEAD), 8.6 * K]),
  ...PETALS.map((i) => [...polar(4.6 * K, -54 + i * 72, HEAD), 5.6 * K]),
].map((values) => values.map((value) => Math.round(value * 100) / 100));
/** The barbs between the outer petals, as one path. */
const ROSE_BARBS = PETALS.map((i) => {
  const angle = -54 + i * 72;
  const tip = polar(19.5 * K, angle, HEAD);
  return `M${p(polar(12 * K, angle - 14, HEAD))}L${p(tip)}L${p(polar(12 * K, angle + 14, HEAD))}Z`;
}).join("");

/** A leaf, two quadratic curves from `base` out along `angle`. */
function leaf(base: Point, angle: number, length: number): string {
  const middle = polar(length * 0.45, angle, base);
  const side = (turn: number) => p(polar(length * 0.36, angle + turn, middle));
  const tip = p(polar(length, angle, base));
  return `M${p(base)}Q${side(-90)} ${tip}Q${side(90)} ${p(base)}Z`;
}
const ROSE_STEM = "M-16,1C0,5 20,-4 46,2";
const ROSE_LEAVES = leaf([6, 2.6], 60, 13) + leaf([24, -0.3], -55, 13);
const ROSE_THORNS = "M9.5,2.3L12,6.8L14.5,2.3ZM29.5,-0.2L32,-4.7L34.5,-0.2Z";

/** The rose (`item(kind="rose")`), laid East–West, 100 × 36.35. */
export const roseArt: HallArt = {
  Component: () => (
    <g {...ITEM_OUTLINE} strokeWidth={ITEM_DETAIL}>
      <path d={ROSE_STEM} fill="none" strokeWidth={7} />
      <path
        d={ROSE_STEM}
        fill="none"
        stroke={PALETTE.green}
        strokeWidth={3.4}
      />
      <path d={ROSE_THORNS} fill={PALETTE.green} strokeWidth={1.2} />
      <path d={ROSE_LEAVES} fill={PALETTE.green} />
      <path d={ROSE_BARBS} fill={PALETTE.green} strokeWidth={1.6} />
      {ROSE_PETALS.map(([cx, cy, r]) => (
        <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill={PALETTE.rose} />
      ))}
      <circle
        cx={HEAD[0]}
        cy={HEAD[1]}
        r={3.1}
        fill={PALETTE.gold}
        strokeWidth={1.6}
      />
    </g>
  ),
  box: { width: 100, height: 36.35 },
  variant: sameForEveryNode,
  provenance: roseProvenance,
};

const SALT_GLASS = mirrored(
  [0, -27],
  [
    { to: [15, -27] },
    { c1: [19, -16], c2: [19, 30], to: [17, 44] },
    { q: [17, 48], to: [13, 48] },
    { to: [0, 48] },
  ],
);
const SALT_CAP = mirrored(
  [0, -48],
  [
    { c1: [10, -48], c2: [16, -42], to: [16, -34] },
    { to: [16, -27] },
    { to: [0, -27] },
  ],
);
const SALT_HOLES = "M-6,-40h0M0,-42h0M6,-40h0";

/** The salt (`item(kind="salt")`): a shaker, 42.41 × 100. */
export const saltArt: HallArt = {
  Component: () => (
    <g {...ITEM_OUTLINE}>
      <path d={SALT_GLASS} fill={PALETTE.paper} />
      <path d={SALT_CAP} fill={PALETTE.silver} />
      <path d={SALT_HOLES} strokeWidth={3.4} />
      <path d="M-16,-30.5H16" strokeWidth={ITEM_DETAIL} />
      {/* The alchemical sign of salt: a circle barred across. */}
      <circle cy={12} r={8} fill="none" strokeWidth={ITEM_DETAIL} />
      <path d="M-8,12H8" strokeWidth={ITEM_DETAIL} />
      <path d="M-11,-38C-9,-42.5 -6,-44.5 -2,-45" {...HIGHLIGHT} />
    </g>
  ),
  box: { width: 42.41, height: 100 },
  variant: sameForEveryNode,
  provenance: saltProvenance,
};

const LOAF =
  "M-44,26C-50,-10 -28,-38 0,-38C28,-38 50,-10 44,26C32,40 -32,40 -44,26Z";
/** Three slashes across the crust, each a lens the bake opened. */
const SLASHES = [-22, 0, 22]
  .map(
    (x) => `M${x - 11},10Q${x - 1},-12 ${x + 11},-16Q${x + 1},-1 ${x - 11},10Z`,
  )
  .join("");

/** The bread (`item(kind="bread")`): a round loaf, 100 × 100. */
export const breadArt: HallArt = {
  Component: () => (
    <g {...ITEM_OUTLINE}>
      <path d={LOAF} fill={PALETTE.bread} />
      <path d={SLASHES} fill={PALETTE.crumb} strokeWidth={ITEM_DETAIL} />
    </g>
  ),
  box: { width: 100, height: 100 },
  variant: sameForEveryNode,
  provenance: breadProvenance,
};

const PIVOT: Point = [0, 24.5];
const OUTER = 51;
const INNER = 16;
const FIRST = -150;
const LAST = -30;
const RIBS = 12;
const ANGLES = Array.from(
  { length: RIBS + 1 },
  (_, i) => FIRST + ((LAST - FIRST) * i) / RIBS,
);
const at = (r: number, angle: number) => p(polar(r, angle, PIVOT));
/** The leaf: out along the first rib, scalloped between the ribs, back. */
const FAN_LEAF = `M${at(INNER, FIRST)}L${at(OUTER, FIRST)}${ANGLES.slice(1)
  .map(
    (angle) =>
      `Q${at(OUTER + 5.5, angle - (LAST - FIRST) / RIBS / 2)} ${at(OUTER, angle)}`,
  )
  .join("")}L${at(INNER, LAST)}A${INNER} ${INNER} 0 0 0 ${at(INNER, FIRST)}Z`;
const FAN_RIBS = ANGLES.slice(1, -1)
  .map((angle) => `M${at(INNER, angle)}L${at(OUTER - 1, angle)}`)
  .join("");
const FAN_STICKS = ANGLES.map(
  (angle) => `M${p(PIVOT)}L${at(INNER, angle)}`,
).join("");
const FAN_GUARDS = [FIRST, LAST]
  .map((angle) => `M${p(PIVOT)}L${at(OUTER + 2, angle)}`)
  .join("");

/** The fan (`item(kind="fan")`), open, 100 × 62.79. */
export const fanArt: HallArt = {
  Component: () => (
    <g {...ITEM_OUTLINE}>
      <path d={FAN_STICKS} strokeWidth={ITEM_DETAIL} />
      <path d={FAN_LEAF} fill={PALETTE.air} />
      <path d={FAN_RIBS} strokeWidth={1.6} />
      <path d={FAN_GUARDS} strokeWidth={5.5} />
      <path d={FAN_GUARDS} stroke={PALETTE.bronze} strokeWidth={2.4} />
      <circle
        cx={PIVOT[0]}
        cy={PIVOT[1]}
        r={4}
        fill={PALETTE.bronze}
        strokeWidth={ITEM_DETAIL}
      />
    </g>
  ),
  box: { width: 100, height: 62.79 },
  variant: sameForEveryNode,
  provenance: fanProvenance,
};
