import { svgCoordinate } from "../svgCoordinate.ts";

/*
 * Plane geometry for the planetary seals (`PlanetarySeal.tsx`): points,
 * lines that stop at the edge of a ring, and circular arcs given by three
 * points or by a bow, written as SVG path data. Coordinates are the
 * seal's 100-unit box, centred on the origin, y down as the screen has it.
 */

/** A point, `[x, y]`, y down. */
export type Point = readonly [number, number];

/** The radius of the small rings at the seals' line ends. */
export const RING = 3;

const n = svgCoordinate;
export const pair = ([x, y]: Point) => `${n(x)},${n(y)}`;

const minus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];

/** `from` moved `distance` towards `to`. */
export function toward(from: Point, to: Point, distance: number): Point {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return [
    from[0] + ((to[0] - from[0]) * distance) / length,
    from[1] + ((to[1] - from[1]) * distance) / length,
  ];
}

/** A point turned a quarter turn clockwise about the centre, `k` times. */
export const turn = ([x, y]: Point, k: number): Point =>
  k % 4 === 0 ? [x, y] : turn([-y, x], k - 1);

/** A point mirrored left to right. */
export const mirror = ([x, y]: Point): Point => [-x, y];

/**
 * A straight line from `from` to `to` that stops at the edge of a ring
 * centred on either end, where the end is ringed.
 */
export function segment(
  from: Point,
  to: Point,
  { ringFrom = false, ringTo = false } = {},
): string {
  const start = ringFrom ? toward(from, to, RING) : from;
  const end = ringTo ? toward(to, from, RING) : to;
  return `M${pair(start)}L${pair(end)}`;
}

/**
 * Straight lines through `points` in turn, stopping at the edge of a ring
 * on either end, where the end is ringed.
 */
export function polyline(
  points: readonly Point[],
  { ringFrom = false, ringTo = false } = {},
): string {
  const last = points.length - 1;
  const at = points.map((point, i) => {
    if (i === 0 && ringFrom) return toward(point, points[1], RING);
    if (i === last && ringTo) return toward(point, points[last - 1], RING);
    return point;
  });
  return `M${at.map(pair).join("L")}`;
}

/**
 * A line from the centre ring out to `to`, from the ring's edge; with
 * `ringed`, it stops at the edge of a ring at `to` too.
 */
export const spoke = (to: Point, ringed = true) =>
  segment([0, 0], to, { ringFrom: true, ringTo: ringed });

/** A quadratic through `from`, `via` (at its middle) and `to`. */
export function through(from: Point, via: Point, to: Point): string {
  const control: Point = [
    2 * via[0] - (from[0] + to[0]) / 2,
    2 * via[1] - (from[1] + to[1]) / 2,
  ];
  return `M${pair(from)}Q${pair(control)} ${pair(to)}`;
}

/**
 * A circular arc to `to` from `from`, bowed `depth` from its chord: to the
 * right of the way (as the screen shows it), or with `left`, to the left.
 * Only the arc command: the path is already at `from`.
 */
export function bow(from: Point, to: Point, depth: number, left = false) {
  const half = Math.hypot(to[0] - from[0], to[1] - from[1]) / 2;
  const r = (half * half + depth * depth) / (2 * depth);
  return `A${n(r)},${n(r)} 0 0 ${left ? 1 : 0} ${pair(to)}`;
}

/** The point a `bow` passes over the middle of its chord. */
export function bowApex(
  from: Point,
  to: Point,
  depth: number,
  left = false,
): Point {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  // The way's right-hand normal on the screen (y down) is (-dy, dx).
  const side = left ? -1 : 1;
  return [
    (from[0] + to[0]) / 2 - (side * depth * (to[1] - from[1])) / length,
    (from[1] + to[1]) / 2 + (side * depth * (to[0] - from[0])) / length,
  ];
}

/** The circle through three points. */
function circleThrough(a: Point, b: Point, c: Point) {
  const d =
    2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  const sq = (p: Point) => p[0] * p[0] + p[1] * p[1];
  const centre: Point = [
    (sq(a) * (b[1] - c[1]) + sq(b) * (c[1] - a[1]) + sq(c) * (a[1] - b[1])) / d,
    (sq(a) * (c[0] - b[0]) + sq(b) * (a[0] - c[0]) + sq(c) * (b[0] - a[0])) / d,
  ];
  return { centre, r: Math.hypot(a[0] - centre[0], a[1] - centre[1]) };
}

/**
 * The circular arc from `from` through `via` to `to`, as a path of its
 * own. With `trim`, it starts and ends that far (along the chord) inside
 * its ends, to stop at the edge of a ring there: `[start, end]`.
 */
export function arc(
  from: Point,
  via: Point,
  to: Point,
  trim: readonly [number, number] = [0, 0],
): string {
  const { centre, r } = circleThrough(from, via, to);
  // Clockwise on the screen (y down) is the sweep flag's 1.
  const clockwise = cross(minus(via, from), minus(to, via)) > 0;
  const step = clockwise ? 1 : -1;
  const angle = (p: Point) => Math.atan2(p[1] - centre[1], p[0] - centre[0]);
  const at = (a: number): Point => [
    centre[0] + r * Math.cos(a),
    centre[1] + r * Math.sin(a),
  ];
  const inset = (chord: number) => 2 * Math.asin(chord / (2 * r));
  let start = angle(from);
  let end = angle(to);
  // The arc's extent, the way it runs, in (0, 2π).
  let extent = (end - start) * step;
  extent -= Math.floor(extent / (2 * Math.PI)) * 2 * Math.PI;
  start += step * inset(trim[0]);
  end -= step * inset(trim[1]);
  extent -= inset(trim[0]) + inset(trim[1]);
  const large = extent > Math.PI ? 1 : 0;
  return `M${pair(at(start))}A${n(r)},${n(r)} 0 ${large} ${clockwise ? 1 : 0} ${pair(at(end))}`;
}
