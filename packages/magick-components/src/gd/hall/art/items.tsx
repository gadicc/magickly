import { enumAttr } from "../attributes";
import type { HallArt, HallArtProps, HallNode } from "../types";
import { CROSS_FORMS, type CrossForm, HALL_COLOURS } from "../vocabulary";
import { points } from "./geometry";
import { original, variantOf } from "./shared";

const COLOUR_NAMES = [...HALL_COLOURS.keys()];

/** A named colour from the node, or the art's default; never raw CSS. */
const colour = (node: HallNode, name: "fill" | "stroke", fallback: string) =>
  HALL_COLOURS.get(enumAttr(node, name, COLOUR_NAMES) ?? fallback) as string;

const direction = (node: HallNode) =>
  enumAttr(node, "dir", ["up", "down"]) ?? "up";

export const crossProvenance = original(
  "Crosses drawn from geometry: Latin, Calvary (on three steps), Greek, " +
    "Greek of five squares, and of four triangles.",
);
export const triangleProvenance = original("An equilateral triangle.");
export const pentagramProvenance = original("A five-pointed star polygon.");

/** Every art module exports its provenance; the items share these. */
export const provenance = [
  crossProvenance,
  triangleProvenance,
  pentagramProvenance,
];

const CROSS_BOXES: ReadonlyMap<CrossForm, { width: number; height: number }> =
  new Map([
    ["latin", { width: 60, height: 100 }],
    ["calvary", { width: 60, height: 100 }],
    ["greek", { width: 100, height: 100 }],
    ["greekFiveSquares", { width: 100, height: 100 }],
    ["fourTriangles", { width: 100, height: 100 }],
  ]);

const crossForm = (node: HallNode): CrossForm =>
  enumAttr(node, "form", CROSS_FORMS) ?? "latin";

const CROSS_PATHS: ReadonlyMap<CrossForm, readonly string[]> = new Map([
  ["latin", ["M-8,-50H8V-28H30V-12H8V50H-8V-12H-30V-28H-8Z"]],
  [
    "calvary",
    [
      "M-7,-50H7V-34H22V-20H7V14H-7V-20H-22V-34H-7Z",
      "M-14,14H14V26H-14Z",
      "M-22,26H22V38H-22Z",
      "M-30,38H30V50H-30Z",
    ],
  ],
  ["greek", ["M-15,-50H15V-15H50V15H15V50H-15V15H-50V-15H-15Z"]],
  [
    "greekFiveSquares",
    [
      [-1, 0],
      [0, -1],
      [0, 0],
      [0, 1],
      [1, 0],
    ].map(([i, j]) => {
      const x = i * 33 - 16.5;
      const y = j * 33 - 16.5;
      return `M${x},${y}h33v33h-33Z`;
    }),
  ],
  [
    "fourTriangles",
    [
      points([
        [-30, -50],
        [30, -50],
        [0, -4],
      ]),
      points([
        [50, -30],
        [50, 30],
        [4, 0],
      ]),
      points([
        [30, 50],
        [-30, 50],
        [0, 4],
      ]),
      points([
        [-50, 30],
        [-50, -30],
        [-4, 0],
      ]),
    ].map((list) => `M${list}Z`),
  ],
]);

function Cross({ node }: HallArtProps) {
  return (
    <>
      {(CROSS_PATHS.get(crossForm(node)) as readonly string[]).map((d) => (
        <path
          key={d}
          d={d}
          fill={colour(node, "fill", "red")}
          stroke={colour(node, "stroke", "yellow")}
          strokeWidth={3}
          strokeLinejoin="miter"
        />
      ))}
    </>
  );
}

/** A cross; `form` picks the shape, `fill` and `stroke` its colours. */
export const crossArt: HallArt = {
  Component: Cross,
  box: (node) =>
    CROSS_BOXES.get(crossForm(node)) as { width: number; height: number },
  variant: (node) =>
    variantOf(
      crossForm(node),
      colour(node, "fill", "red"),
      colour(node, "stroke", "yellow"),
    ),
  provenance: crossProvenance,
};

// The triangle's box is its bounding box; its centre is the box's centre.
const SIDE = 88;
const HEIGHT = (SIDE * Math.sqrt(3)) / 2;

function Triangle({ node }: HallArtProps) {
  const up = direction(node) === "up";
  const s = up ? 1 : -1;
  return (
    <polygon
      points={points([
        [0, (-s * HEIGHT) / 2],
        [SIDE / 2, (s * HEIGHT) / 2],
        [-SIDE / 2, (s * HEIGHT) / 2],
      ])}
      fill={colour(node, "fill", "none")}
      stroke={colour(node, "stroke", "white")}
      strokeWidth={11}
      strokeLinejoin="miter"
    />
  );
}

/** A triangle pointing up or down (`dir`), outlined white by default. */
export const triangleArt: HallArt = {
  Component: Triangle,
  box: { width: 100, height: 86.6 },
  variant: (node) =>
    variantOf(
      direction(node),
      colour(node, "fill", "none"),
      colour(node, "stroke", "white"),
    ),
  provenance: triangleProvenance,
};

// A pentagram's points lie on a circle of radius 50; its bounding box runs
// from the top point to 50·cos 36° below the centre, so shift it to centre.
const STAR_SHIFT = (50 - 50 * Math.cos(Math.PI / 5)) / 2;

function Pentagram({ node }: HallArtProps) {
  const s = direction(node) === "up" ? 1 : -1;
  const star = [0, 2, 4, 1, 3].map((i): [number, number] => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [50 * Math.cos(angle), s * (50 * Math.sin(angle) + STAR_SHIFT)];
  });
  return (
    <polygon
      points={points(star)}
      fill={colour(node, "fill", "none")}
      stroke={colour(node, "stroke", "white")}
      strokeWidth={5}
      strokeLinejoin="miter"
    />
  );
}

/** A pentagram, point up unless `dir="down"`. */
export const pentagramArt: HallArt = {
  Component: Pentagram,
  box: { width: 95.1, height: 90.5 },
  variant: (node) =>
    variantOf(
      direction(node),
      colour(node, "fill", "none"),
      colour(node, "stroke", "white"),
    ),
  provenance: pentagramProvenance,
};
