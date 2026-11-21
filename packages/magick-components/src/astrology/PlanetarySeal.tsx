import type { KameaPlanetId } from "magick-data/astrology/kameas";
import planets from "magick-data/astrology/planets";
import type { CSSProperties, ReactElement } from "react";
import { svgCoordinate } from "../svgCoordinate.ts";
import {
  arc,
  bow,
  bowApex,
  mirror,
  type Point,
  pair,
  polyline,
  RING,
  segment,
  spoke,
  through,
  turn,
} from "./planetarySealGeometry.ts";

/*
 * The seals of the seven planets ("signacula sive characteres", the
 * planet's own figure, printed left of its intelligence's and spirit's
 * characters), drawn after the woodcuts of Heinrich Cornelius Agrippa, *De
 * occulta philosophia libri tres* (Cologne: Soter, 1533), book II, chapter
 * 22, from the Library of Congress copy on archive.org,
 * `DeOccultaPhilosophiaLoc1533`: Saturn and Jupiter on p. CXLIX (leaf
 * n164), Mars and the Sun on p. CL (n165), Venus on p. CLI (n166), Mercury
 * on p. CLII (n167) and the Moon on p. CLIII (n168).
 *
 * Our own drawing, not a tracing: each seal's lines, circles and arcs, with
 * their ends and junctions, were measured on the leaf's 1800-pixel scan
 * and written here as geometry, made clean (straight, round, symmetric)
 * where the cutter's hand wandered and kept where the figure has a feature
 * of its own; each seal's comment gives what was read and what was
 * regularised. No image of the book is in the repository. Copyright Gadi
 * Cohen, MIT like the rest of the package; the woodcuts are in the public
 * domain (`PLANETARY_SEAL_BASIS`).
 *
 * The seals are drawn in a 100-unit box centred on the origin, the corner
 * rings about 38 units out. On the bare page (`look="page"`) every stroke
 * is in one ink and the rings are open, so the drawing works on any
 * ground; on the silver plate (`look="plate"`) the temple hall draws, the
 * rings are filled with the plate's silver.
 */

/** Where the seals come from, by a stable reference. */
export const PLANETARY_SEAL_SOURCE =
  "Heinrich Cornelius Agrippa, De occulta philosophia libri tres " +
  "(Cologne: Soter, 1533), book II, chapter 22: Saturn and Jupiter p. " +
  "CXLIX, Mars and the Sun p. CL, Venus p. CLI, Mercury p. CLII, the " +
  "Moon p. CLIII; archive.org DeOccultaPhilosophiaLoc1533 (Library of " +
  "Congress), leaves n164, n165, n166, n167 and n168.";

/** Why the woodcuts the seals follow are in the public domain. */
export const PLANETARY_SEAL_BASIS =
  "printed in 1533; Agrippa died in 1535 and the woodcuts' cutters are " +
  "anonymous, so the work is out of copyright everywhere; a faithful scan " +
  "of a two-dimensional public-domain work adds no copyright, and the " +
  "archive.org item carries the Public Domain Mark 1.0. Only the " +
  "figures' geometry is taken, and no image of the book is committed.";

/**
 * Each seal's leaf in the archive.org item (`/page/n<leaf>`) and the
 * 1533 printing's page.
 */
export const PLANETARY_SEAL_LEAVES: Readonly<
  Record<KameaPlanetId, { leaf: number; page: string }>
> = {
  saturn: { leaf: 164, page: "CXLIX" },
  jupiter: { leaf: 164, page: "CXLIX" },
  mars: { leaf: 165, page: "CL" },
  sol: { leaf: 165, page: "CL" },
  venus: { leaf: 166, page: "CLI" },
  mercury: { leaf: 167, page: "CLII" },
  luna: { leaf: 168, page: "CLIII" },
};

/** The engraved lines' width, in the 100-unit box. */
const LINE = 3;
/** The plate's outline, and the finer lines and the rings' width. */
const OUTLINE = 3.6;
const DETAIL = 2.4;

const n = svgCoordinate;

/**
 * One seal's strokes: `paths`, each `[d, stroke width]`, the circles
 * (`[cx, cy, r, stroke width]`) and the rings. A seal has one for the
 * page and, where its strokes differ there, another for the plate (the
 * Moon's crescents, whose ends the plate's filled rings cover).
 */
interface SealDrawing {
  paths: readonly (readonly [string, number])[];
  circles?: readonly (readonly [number, number, number, number])[];
  rings: readonly Point[];
}

/**
 * The Moon (n168): a saltire from a ring at the centre to rings in the
 * corners, and four crescents between its arms, each a lune with a line
 * along its middle, rings at its horns.
 */
const MOON_CORNER = 38;
const MOON_HORN: Point = [23, -38];
/** How deep each crescent's outer, middle and inner arcs bow. */
const MOON_CRESCENT = [19, 14.5, 10] as const;
const MOON_HORNS = [0, 1, 2, 3].map(
  (k) => [turn([-MOON_HORN[0], MOON_HORN[1]], k), turn(MOON_HORN, k)] as const,
);
const MOON_CORNERS = [0, 1, 2, 3].map((k) =>
  turn([MOON_CORNER, MOON_CORNER], k),
);
const MOON_LINES = MOON_CORNERS.map((corner) => spoke(corner)).join("");
const MOON_RINGS: readonly Point[] = [
  [0, 0],
  ...MOON_CORNERS,
  ...MOON_HORNS.flat(),
];

/** On the plate: each lune closed, its horns under the filled rings. */
const MOON_PLATE: SealDrawing = (() => {
  const [outer, middle, inner] = MOON_CRESCENT;
  const lunes = MOON_HORNS.map(
    ([left, right]) =>
      `M${pair(left)}${bow(left, right, outer)}${bow(right, left, inner, true)}Z`,
  );
  const middles = MOON_HORNS.map(
    ([left, right]) => `M${pair(left)}${bow(left, right, middle)}`,
  );
  return {
    paths: [
      [MOON_LINES, LINE],
      [lunes.join(""), DETAIL],
      [middles.join(""), 1.6],
    ],
    rings: MOON_RINGS,
  };
})();

/** On the page: the same arcs, each stopping at the edge of its rings. */
const MOON_PAGE: SealDrawing = (() => {
  const [outer, middle, inner] = MOON_CRESCENT;
  const trimmed = (depth: number) =>
    MOON_HORNS.map(([left, right]) =>
      arc(left, bowApex(left, right, depth), right, [RING, RING]),
    ).join("");
  return {
    paths: [
      [MOON_LINES, LINE],
      [trimmed(outer) + trimmed(inner), DETAIL],
      [trimmed(middle), 1.6],
    ],
    rings: MOON_RINGS,
  };
})();

/**
 * Venus (n166): three arms of a saltire from a ring at the centre to
 * rings at their ends; the fourth runs to the foot of a great arc on the
 * right; above the centre a cross whose stem forks into two arms, serifed
 * at their ends; an open arc on the left, like a ")"; a ring below. Every
 * line is engraved at one weight, the left arc as the great one.
 */
const VENUS: SealDrawing = (() => {
  const ends: Point[] = [
    [-36, -35],
    [36, -35],
    [-36, 35],
  ];
  const foot: Point = [35, 33];
  const spokes = [...ends.map((end) => spoke(end)), spoke(foot, false)];
  const greatArc = through([30, -21], [40, 6], foot);
  const leftArc = through([-38, -16], [-27, -3.5], [-38.5, 9]);
  const cross =
    "M0,-38V-10.5M-13.5,-27H13.5M0,-27L-11.5,-37.5M0,-27L11.5,-37.5" +
    "M-2,-38H2M-14,-37.5H-9.5M9.5,-37.5H14";
  return {
    paths: [[spokes.join("") + greatArc + leftArc + cross, LINE]],
    circles: [[0, 25, 12.5, LINE]],
    rings: [[0, 0], ...ends],
  };
})();

/**
 * Saturn (n164): two angles, each a line from a ring out to a sharp
 * corner and back to another ring, the one the other turned half a turn
 * about the centre, and a long line between rings across them, from the
 * upper left to the lower right. Read on the leaf about the centre (392,
 * 1080) of its 1800-pixel scan, at 0.317 units a pixel: the woodcut is
 * close to symmetric under the half turn (its matching points within 7
 * pixels, but for the upper ring, which stands 20 pixels right of the
 * lower one's turn), and each pair is drawn as their mean. The long line
 * runs about 44.7° below the level, and each angle's corner is about 46°;
 * both are kept as read, not set to 45°.
 */
const SATURN: SealDrawing = (() => {
  const ring: Point = [-38, 0.8];
  const corner: Point = [21.1, -17.1];
  const foot: Point = [-3.5, 31.3];
  const end: Point = [28.7, 28.4];
  const half = ([x, y]: Point): Point => [-x, -y];
  const angle = (a: Point, b: Point, c: Point) =>
    polyline([a, b, c], { ringFrom: true, ringTo: true });
  return {
    paths: [
      [
        angle(ring, corner, foot) +
          angle(half(ring), half(corner), half(foot)) +
          segment(half(end), end, { ringFrom: true, ringTo: true }),
        LINE,
      ],
    ],
    rings: [ring, foot, half(ring), half(foot), end, half(end)],
  };
})();

/**
 * Jupiter (n164): a circle, and a saltire through it from ring to ring.
 * Read about the crossing (467, 1947), at 0.352 units a pixel: the circle
 * is 102 pixels across one way and 98 the other, drawn round at the mean,
 * 100; the four rings stand 106 to 110 pixels out each way, drawn at 108,
 * so the saltire's arms are at right angles.
 */
const JUPITER: SealDrawing = (() => {
  const corner = 38;
  const corners = [0, 1, 2, 3].map((k) => turn([corner, corner], k));
  return {
    paths: [
      [
        segment(corners[2], corners[0], { ringFrom: true, ringTo: true }) +
          segment(corners[1], corners[3], { ringFrom: true, ringTo: true }),
        LINE,
      ],
    ],
    circles: [[0, 0, 35.2, LINE]],
    rings: corners,
  };
})();

/**
 * Mars (n165): as Venus', a saltire from a ring at the centre, three arms
 * ringed and the fourth running to the foot of a great arc on the right,
 * whose upper end is serifed; above the centre a "U", its ends serifed;
 * on the left a lobe from the upper arm round to the lower one, and below
 * the centre a lobe from that point round to the lower right arm. Read
 * about the centre ring (720, 902), at 0.253 units a pixel. The saltire is
 * wider than it is tall (its rings 146 to 157 pixels out and 120 to 122
 * up or down, arms about 39° from the level), on all three ringed arms, so
 * kept, drawn at 150 by 122; the two lobes meet the arms 84 to 89 pixels
 * from the centre, drawn at 87, and bulge 115 pixels out, as both do. The
 * "U" is drawn as a half ellipse, symmetric about the centre's vertical:
 * its right side leans in, the left stands upright. The serifs are short
 * bars across the line's end, as on Venus' cross; on the woodcut the great
 * arc's is a wedge.
 */
const MARS: SealDrawing = (() => {
  const end: Point = [38, 31];
  const length = Math.hypot(end[0], end[1]);
  const along = (k: Point, distance: number): Point => [
    (k[0] * distance) / length,
    (k[1] * distance) / length,
  ];
  const ends: Point[] = [
    [-end[0], -end[1]],
    [end[0], -end[1]],
    [-end[0], end[1]],
  ];
  const foot = along(end, 43.6);
  const lobe = 22;
  const upperLeft = along([-end[0], -end[1]], lobe);
  const lowerLeft = along([-end[0], end[1]], lobe);
  const lowerRight = along(end, lobe);
  const head: Point = [28.7, -16.1];
  const greatArc = arc(head, [38, 4.6], foot);
  // The serif across the great arc's head: square to the circle's radius
  // there, which the arc's start runs along at right angles.
  const serif = (at: Point, toward: Point, width: number) => {
    const d = Math.hypot(toward[0] - at[0], toward[1] - at[1]);
    const [ux, uy] = [(toward[1] - at[1]) / d, -(toward[0] - at[0]) / d];
    const h = width / 2;
    return `M${pair([at[0] - ux * h, at[1] - uy * h])}L${pair([at[0] + ux * h, at[1] + uy * h])}`;
  };
  // The "U": a half ellipse from end to end, through its foot below.
  const u = { x: 13.7, top: -33.4, foot: -16.9 };
  const uPath =
    `M${pair([-u.x, u.top])}A${n(u.x)},${n(u.foot - u.top)} 0 0 0 ${pair([u.x, u.top])}` +
    `M${pair([-u.x - 1.7, u.top])}H${n(-u.x + 1.7)}M${n(u.x - 1.7)},${n(u.top)}H${n(u.x + 1.7)}`;
  return {
    paths: [
      [
        [...ends.map((e) => spoke(e)), spoke(foot, false)].join("") +
          greatArc +
          serif(head, [38, 4.6], 3.6) +
          uPath +
          arc(upperLeft, [-29.1, 0], lowerLeft) +
          arc(lowerLeft, [0, 29.1], lowerRight),
        LINE,
      ],
    ],
    rings: [[0, 0], ...ends],
  };
})();

/**
 * The Sun (n165): a saltire between rings in the corners, and on each
 * side an arc bowed in towards the centre, between two sharp points; from
 * each point a straight line runs back across the corner, through the
 * saltire, to stop short of the middle of the next side, so that each
 * corner holds a star of three crossing lines. Read about the crossing
 * (727, 1927), at 0.268 units a pixel. The woodcut is close to symmetric
 * under the square's turns and reflections: the rings stand 134 to 149
 * pixels out each way, drawn at 142; the points 71 to 97 pixels from the
 * middle of their side and 139 to 151 out, drawn at 84 and 146; the arcs
 * bow in 66 to 76 pixels from their points' line, drawn at 71; the lines'
 * free ends 6 to 22 pixels from the middle and 115 to 135 out, drawn at 10
 * and 125. Each point's two lines then cross the saltire at one point, as
 * they do on the leaf. Every line is at the finer weight, as the woodcut
 * cuts them all alike, finer than the other seals'.
 */
const SUN: SealDrawing = (() => {
  const s = 38 / 142;
  const corner: Point = [-142 * s, -142 * s];
  const point: Point = [-84 * s, -146 * s];
  const apex: Point = [0, -75 * s];
  const free: Point = [-125 * s, -10 * s];
  const flip = ([x, y]: Point): Point => [y, x];
  const corners = [0, 1, 2, 3].map((k) => turn(corner, k));
  const sides = [0, 1, 2, 3].map((k) =>
    arc(turn(point, k), turn(apex, k), turn(mirror(point), k)),
  );
  // Each corner's two lines, from the points either side of it.
  const lines = [0, 1, 2, 3].map(
    (k) =>
      segment(turn(point, k), turn(free, k)) +
      segment(turn(flip(point), k), turn(flip(free), k)),
  );
  return {
    paths: [
      [
        segment(corners[0], corners[2], { ringFrom: true, ringTo: true }) +
          segment(corners[1], corners[3], { ringFrom: true, ringTo: true }) +
          sides.join("") +
          lines.join(""),
        DETAIL,
      ],
    ],
    rings: corners,
  };
})();

/**
 * Mercury (n167): a square of eight bars, two on each side, rings at its
 * corners and a saltire between them; four lines, each parallel to an arm
 * of the saltire, make a lattice with it of nine diamonds, and in the four
 * between the corners a circle. Read about the crossing (1530, 490), at
 * 0.3 units a pixel. The woodcut is about 6% wider than tall (its rings
 * 260 by 245 pixels apart, its circles' centres 145 by 132), which we take
 * for the page's squeeze, not the figure's: it is drawn square. The bars
 * run from 40 to 101 pixels either side of the middle of each side, 129
 * to 136 out, drawn at 133; the rings 6 pixels inside, at 127; the
 * lattice's lines cross the saltire 73 pixels from the centre each way,
 * and end at the bars' line; the circles, 55 to 57 pixels across, stand 66
 * to 73 from the centre, drawn 56 across in the middle of their diamonds,
 * at 73.
 */
const MERCURY: SealDrawing = (() => {
  const s = 0.3;
  const bar = 133 * s;
  const corners = [0, 1, 2, 3].map((k) => turn([127 * s, 127 * s], k));
  const lattice = 146 * s;
  const lineEnd: Point = [-(lattice - bar), -bar];
  const bars = [0, 1, 2, 3].map(
    (k) =>
      segment(turn([-101 * s, -bar], k), turn([-40 * s, -bar], k)) +
      segment(turn([40 * s, -bar], k), turn([101 * s, -bar], k)),
  );
  // The lattice's lines, from near the top's middle to the left's, turned.
  const lines = [0, 1, 2, 3].map((k) =>
    segment(turn(lineEnd, k), turn([-bar, -(lattice - bar)], k)),
  );
  const circles = [0, 1, 2, 3].map((k) => {
    const [cx, cy] = turn([0, -lattice / 2], k);
    return [cx, cy, 28 * s, LINE] as const;
  });
  return {
    paths: [
      [
        segment(corners[0], corners[2], { ringFrom: true, ringTo: true }) +
          segment(corners[1], corners[3], { ringFrom: true, ringTo: true }) +
          lines.join("") +
          bars.join(""),
        LINE,
      ],
    ],
    circles,
    rings: corners,
  };
})();

/** Each seal, by planet: on the page and, where it differs, on the plate. */
const SEALS: Readonly<
  Record<KameaPlanetId, { page: SealDrawing; plate?: SealDrawing }>
> = {
  saturn: { page: SATURN },
  jupiter: { page: JUPITER },
  mars: { page: MARS },
  sol: { page: SUN },
  venus: { page: VENUS },
  mercury: { page: MERCURY },
  luna: { page: MOON_PAGE, plate: MOON_PLATE },
};

/** Whether `planet` is one of the seven, each of which has a seal. */
export const isPlanetarySealPlanet = (
  planet: string,
): planet is KameaPlanetId => Object.hasOwn(SEALS, planet);

/** How a seal is drawn: on the bare page, or engraved on a silver plate. */
export type PlanetarySealLook = "page" | "plate";

export interface PlanetarySealFigureProps {
  /**
   * The planet, by magick-data's id (`saturn` … `sol` … `luna`); without
   * one, or with one that is not of the seven, nothing.
   */
  planet?: KameaPlanetId;
  /**
   * `page` (the default): the lines alone, in `ink`, the rings open, for
   * a page in any colour scheme. `plate`: engraved on a silver plate with
   * a rounded edge, as the temple hall draws it, the rings filled silver.
   */
  look?: PlanetarySealLook;
  /**
   * The lines' colour. On the page, `currentColor` unless given, so the
   * seal takes the text's colour, light or dark; it is set as a style, so
   * it may be a custom property (`var(--ink)`). On the plate, black
   * unless given.
   */
  ink?: string;
  /** The plate's colour, `look="plate"` only. */
  plate?: string;
}

/** The engraving's strokes: round at the ends. */
const ROUND = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

/**
 * A planet's seal as SVG elements, in the 100-unit box centred on the
 * origin, for a drawing that places it itself (as the temple hall does);
 * `PlanetarySeal` is the same in an `<svg>` of its own.
 */
export function PlanetarySealFigure({
  planet,
  look = "page",
  ink,
  plate = "#d3d7dc",
}: PlanetarySealFigureProps): ReactElement | null {
  // Only the seven: a name from untrusted input ("constructor") is none.
  if (planet === undefined || !isPlanetarySealPlanet(planet)) return null;
  const seal = SEALS[planet];
  if (look === "plate") {
    const drawing = seal.plate ?? seal.page;
    const color = ink ?? "#000000";
    return (
      <>
        <rect
          x={-47}
          y={-47}
          width={94}
          height={94}
          rx={8}
          fill={plate}
          stroke={color}
          strokeWidth={OUTLINE}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Strokes drawing={drawing} stroke={color} />
        <g fill={plate} stroke={color} strokeWidth={DETAIL}>
          <Rings at={drawing.rings} />
        </g>
      </>
    );
  }
  return (
    <g style={ink === undefined ? undefined : { color: ink }}>
      <Strokes drawing={seal.page} stroke="currentColor" />
      <g fill="none" stroke="currentColor" strokeWidth={DETAIL}>
        <Rings at={seal.page.rings} />
      </g>
    </g>
  );
}

function Strokes({
  drawing,
  stroke,
}: {
  drawing: SealDrawing;
  stroke: string;
}) {
  return (
    <>
      {drawing.paths.map(([d, width]) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={width}
          {...ROUND}
        />
      ))}
      {drawing.circles?.map(([cx, cy, r, width]) => (
        <circle
          key={`${cx},${cy}`}
          cx={n(cx)}
          cy={n(cy)}
          r={n(r)}
          fill="none"
          stroke={stroke}
          strokeWidth={width}
          {...ROUND}
        />
      ))}
    </>
  );
}

function Rings({ at }: { at: readonly Point[] }) {
  return at.map(([x, y]) => (
    <circle key={`${x},${y}`} cx={n(x)} cy={n(y)} r={RING} />
  ));
}

export interface PlanetarySealProps extends PlanetarySealFigureProps {
  planet: KameaPlanetId;
  /**
   * The drawing's width (CSS pixels for a number); the height's when only
   * that is given, as it is square, and 120 when neither is.
   */
  width?: number | string;
  /** The drawing's height; the width's when only that is given. */
  height?: number | string;
  /**
   * The drawing's accessible name: the seal's own ("Seal of Saturn") when
   * not given, this one when a string. `false` marks it decorative,
   * hidden from assistive technology (`aria-hidden`).
   */
  label?: string | false;
  /** The `<svg>`'s class. */
  className?: string;
  /** The `<svg>`'s style. */
  style?: CSSProperties;
}

/** The seal's own name: "Seal of Saturn", "Seal of Sol". */
function sealName(planet: string | undefined): string {
  return planet !== undefined && isPlanetarySealPlanet(planet)
    ? `Seal of ${planets[planet].name.en.en}`
    : "Seal";
}

/**
 * A planet's seal after Agrippa (1533) in an `<svg>` of its own, square,
 * 120 across unless `width` or `height` says otherwise. On the page (the
 * default) it is drawn in the text's colour, the box close about the
 * figure; on the plate, the plate fills the box. It is an image named by
 * its planet ("Seal of Saturn") unless `label` names it otherwise or is
 * false.
 */
export function PlanetarySeal({
  width,
  height,
  label,
  className,
  style,
  ...figure
}: PlanetarySealProps) {
  const name =
    label === undefined ? sealName(figure.planet) : label || undefined;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={figure.look === "plate" ? "-50 -50 100 100" : "-45 -45 90 90"}
      width={width ?? height ?? 120}
      height={height ?? width ?? 120}
      className={className}
      style={style}
      role={name ? "img" : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
    >
      <PlanetarySealFigure {...figure} />
    </svg>
  );
}

export default PlanetarySeal;
