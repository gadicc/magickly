import { svgCoordinate } from "../../../svgCoordinate";
import type { Planet } from "../planets";
import type { Point } from "./geometry";
import { ITEM_DETAIL, ITEM_OUTLINE, PALETTE, publicDomain } from "./shared";

/**
 * The planets' seals, drawn after the woodcuts of Agrippa's *De occulta
 * philosophia* (Cologne: Soter, 1533), book II, chapter 22, which gives
 * each planet's table with its seal ("signacula sive characteres"). Read
 * from the Library of Congress copy on archive.org,
 * `DeOccultaPhilosophiaLoc1533`: Venus on p. CLI (leaf n166), the Moon on
 * p. CLIII (leaf n168). The geometry follows the woodcuts, made clean and
 * symmetric where the cutter's hand wandered; no image was copied. The
 * silver plate is our reading of the chapter's text (leaf n162), which
 * says each of these planets' tables, with its characters, is engraved
 * on silver; the woodcuts themselves draw the seals on the bare page.
 * The other five planets keep the placeholder (plan 061, stage H, part
 * 2).
 */
export const SEAL_SOURCE =
  "Heinrich Cornelius Agrippa, De occulta philosophia libri tres " +
  "(Cologne: Soter, 1533), book II, chapter 22: Venus p. CLI, the Moon " +
  "p. CLIII; archive.org DeOccultaPhilosophiaLoc1533 (Library of " +
  "Congress), leaves n166 and n168.";

export const SEAL_BASIS =
  "printed in 1533; Agrippa died in 1535 and the woodcuts' cutters are " +
  "anonymous, so the work is out of copyright everywhere; a faithful scan " +
  "of a two-dimensional public-domain work adds no copyright, and the " +
  "archive.org item carries the Public Domain Mark 1.0. Only the " +
  "figures' geometry is taken, and no image of the book is committed.";

/** The `seal` art's provenance: these seals, and the placeholder. */
export const sealProvenance = publicDomain(
  "A planet's seal drawn from geometry after Agrippa's woodcut, on a " +
    "silver plate: the Moon's and Venus' so far (plan 061, stage H, part " +
    "2); for the other planets a placeholder, a dashed ring naming the " +
    "planet.",
  { source: SEAL_SOURCE, basis: SEAL_BASIS },
);

/** Every art module exports its provenance. */
export const provenance = sealProvenance;

/** The engraved lines' width, in the 100-unit box. */
const LINE = 3;
/** The small rings at the lines' ends. */
const RING = 3;

const n = svgCoordinate;
const pair = ([x, y]: Point) => `${n(x)},${n(y)}`;

/** A quadratic through `from`, `via` (at its middle) and `to`. */
const through = (from: Point, via: Point, to: Point) => {
  const control: Point = [
    2 * via[0] - (from[0] + to[0]) / 2,
    2 * via[1] - (from[1] + to[1]) / 2,
  ];
  return `M${pair(from)}Q${pair(control)} ${pair(to)}`;
};

/**
 * A line from the centre ring out to `to`, from the ring's edge; with
 * `ringed`, it stops at the edge of a ring at `to` too.
 */
const spoke = (to: Point, ringed = true) => {
  const length = Math.hypot(to[0], to[1]);
  const along = (r: number): Point => [
    (to[0] * r) / length,
    (to[1] * r) / length,
  ];
  return `M${pair(along(RING))}L${pair(ringed ? along(length - RING) : to)}`;
};

/**
 * A circular arc to `to` from `from`, bowed `depth` from its chord: to the
 * right of the way (as the screen shows it), or with `left`, to the left.
 */
const bow = (from: Point, to: Point, depth: number, left = false) => {
  const half = Math.hypot(to[0] - from[0], to[1] - from[1]) / 2;
  const r = (half * half + depth * depth) / (2 * depth);
  return `A${n(r)},${n(r)} 0 0 ${left ? 1 : 0} ${pair(to)}`;
};

/** A point turned a quarter turn clockwise about the centre, `k` times. */
const turn = ([x, y]: Point, k: number): Point =>
  k % 4 === 0 ? [x, y] : turn([-y, x], k - 1);

/**
 * The Moon's seal: a saltire from a ring at the centre to rings in the
 * corners, and four crescents between its arms, each a lune with a line
 * along its middle, rings at its horns.
 */
const MOON_CORNER = 38;
const MOON_HORN: Point = [23, -38];
/** How deep each crescent's outer, middle and inner arcs bow. */
const MOON_CRESCENT = [19, 14.5, 10] as const;
const MOON = (() => {
  const corners = [0, 1, 2, 3].map((k) => turn([MOON_CORNER, MOON_CORNER], k));
  const lines = corners.map((corner) => spoke(corner));
  const crescents = [0, 1, 2, 3].map((k) => {
    const left = turn([-MOON_HORN[0], MOON_HORN[1]], k);
    const right = turn(MOON_HORN, k);
    const [outer, middle, inner] = MOON_CRESCENT;
    const lune = `M${pair(left)}${bow(left, right, outer)}${bow(right, left, inner, true)}Z`;
    return { lune, middle: `M${pair(left)}${bow(left, right, middle)}` };
  });
  const horns = [0, 1, 2, 3].flatMap((k) => [
    turn([-MOON_HORN[0], MOON_HORN[1]], k),
    turn(MOON_HORN, k),
  ]);
  return {
    lines: lines.join(""),
    lunes: crescents.map(({ lune }) => lune).join(""),
    middles: crescents.map(({ middle }) => middle).join(""),
    rings: [[0, 0] as Point, ...corners, ...horns],
  };
})();

/**
 * Venus' seal: three arms of a saltire from a ring at the centre to rings
 * at their ends; the fourth runs to the foot of a great arc on the right;
 * above the centre a cross whose stem forks into two arms, serifed at
 * their ends; an open arc on the left, like a ")"; a ring below. Every
 * line is engraved at one weight, the left arc as the great one.
 */
const VENUS = (() => {
  const ends: Point[] = [
    [-36, -35],
    [36, -35],
    [-36, 35],
  ];
  const foot: Point = [35, 33];
  const spokes = [...ends.map((end) => spoke(end)), spoke(foot, false)];
  const arc = through([30, -21], [40, 6], foot);
  const leftArc = through([-38, -16], [-27, -3.5], [-38.5, 9]);
  const cross =
    "M0,-38V-10.5M-13.5,-27H13.5M0,-27L-11.5,-37.5M0,-27L11.5,-37.5" +
    "M-2,-38H2M-14,-37.5H-9.5M9.5,-37.5H14";
  return {
    lines: spokes.join("") + arc + leftArc + cross,
    rings: [[0, 0] as Point, ...ends],
    circle: { cx: 0, cy: 25, r: 12.5 },
  };
})();

/** A seal's silver plate, the box's size less the outline. */
function Plate() {
  return (
    <rect
      x={-47}
      y={-47}
      width={94}
      height={94}
      rx={8}
      fill={PALETTE.silver}
      {...ITEM_OUTLINE}
    />
  );
}

/** The engraving's strokes: the ink, round at the ends. */
const ENGRAVED = {
  fill: "none",
  stroke: PALETTE.ink,
  strokeWidth: LINE,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Rings({ at }: { at: readonly Point[] }) {
  return (
    <g fill={PALETTE.silver} stroke={PALETTE.ink} strokeWidth={ITEM_DETAIL}>
      {at.map(([x, y]) => (
        <circle key={`${x},${y}`} cx={n(x)} cy={n(y)} r={RING} />
      ))}
    </g>
  );
}

function MoonSeal() {
  return (
    <>
      <Plate />
      <path d={MOON.lines} {...ENGRAVED} />
      <path d={MOON.lunes} {...ENGRAVED} strokeWidth={ITEM_DETAIL} />
      <path d={MOON.middles} {...ENGRAVED} strokeWidth={1.6} />
      <Rings at={MOON.rings} />
    </>
  );
}

function VenusSeal() {
  return (
    <>
      <Plate />
      <path d={VENUS.lines} {...ENGRAVED} />
      <circle {...VENUS.circle} {...ENGRAVED} />
      <Rings at={VENUS.rings} />
    </>
  );
}

/** The seals drawn so far, by planet; the others are a placeholder. */
export const SEALS: ReadonlyMap<Planet, () => React.ReactElement> = new Map([
  ["moon", MoonSeal],
  ["venus", VenusSeal],
]);
