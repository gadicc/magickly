import { svgCoordinate } from "../../../svgCoordinate";

/** SVG `points` for a polygon, rounded so server and browser agree. */
export function points(list: readonly (readonly [number, number])[]): string {
  return list
    .map(([x, y]) => `${svgCoordinate(x)},${svgCoordinate(y)}`)
    .join(" ");
}

/**
 * An equilateral triangle of circumradius `r` with its centroid on the
 * origin, pointing up or down.
 */
export function triangle(r: number, dir: "up" | "down") {
  const s = dir === "up" ? -1 : 1;
  const half = r * Math.sin(Math.PI / 3);
  return points([
    [0, s * r],
    [-half, (-s * r) / 2],
    [half, (-s * r) / 2],
  ]);
}

/** A point in an art's units. */
export type Point = readonly [x: number, y: number];

/**
 * One segment of a profile: a line, a cubic (`c1`, `c2`) or a quadratic
 * (`q`) Bézier to `to`.
 */
export type Segment =
  | { to: Point }
  | { c1: Point; c2: Point; to: Point }
  | { q: Point; to: Point };

/** A coordinate to two decimals: enough for a 100-unit drawing, and short. */
const short = (value: number) => Math.round(value * 100) / 100 + 0;
const pair = ([x, y]: Point) => `${short(x)},${short(y)}`;
const mirror = ([x, y]: Point): Point => [-x, y];

function command(segment: Segment): string {
  if ("c1" in segment)
    return `C${pair(segment.c1)} ${pair(segment.c2)} ${pair(segment.to)}`;
  if ("q" in segment) return `Q${pair(segment.q)} ${pair(segment.to)}`;
  return `L${pair(segment.to)}`;
}

/**
 * A closed outline symmetric about the vertical axis, from its right half
 * as a lathe profile: `start` and the last point lie on the axis, and the
 * left half is the right one mirrored and walked back. Vessels are drawn
 * this way.
 */
export function mirrored(start: Point, segments: readonly Segment[]): string {
  const from = [start, ...segments.map((segment) => segment.to)];
  const left = segments
    .map((segment, index) => {
      const back = mirror(from[index]);
      if ("c1" in segment)
        return `C${pair(mirror(segment.c2))} ${pair(mirror(segment.c1))} ${pair(back)}`;
      if ("q" in segment) return `Q${pair(mirror(segment.q))} ${pair(back)}`;
      return `L${pair(back)}`;
    })
    .reverse();
  return `M${pair(start)}${segments.map(command).join("")}${left.join("")}Z`;
}

/**
 * A smooth open path through points (Catmull–Rom as cubic Béziers), to
 * `decimals` places (two unless a small glyph needs fewer bytes). With
 * `from` and `to`, only that stretch of it, between those points, along
 * exactly the same curve as the whole path.
 */
export function smoothPath(
  list: readonly Point[],
  decimals = 2,
  from = 0,
  to = list.length - 1,
): string {
  const at = (index: number) =>
    list[Math.min(list.length - 1, Math.max(0, index))];
  const scale = 10 ** decimals;
  const round = (value: number) => Math.round(value * scale) / scale + 0;
  const pair = ([x, y]: Point) => `${round(x)},${round(y)}`;
  let d = `M${pair(list[from])}`;
  for (let i = from; i < to; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Point = [
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
    ];
    const c2: Point = [
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
    ];
    d += `C${pair(c1)} ${pair(c2)} ${pair(p2)}`;
  }
  return d;
}

/**
 * The point `r` from `centre` at `degrees`, measured clockwise from East
 * on the screen (y down).
 */
export function polar(r: number, degrees: number, centre: Point = [0, 0]) {
  const angle = (degrees * Math.PI) / 180;
  return [
    centre[0] + r * Math.cos(angle),
    centre[1] + r * Math.sin(angle),
  ] as const;
}

/** A point as path data (`x,y`), to two decimals. */
export const pathPoint = pair;

/**
 * A path's x coordinates negated: the drawing mirrored left to right. Only
 * for absolute commands whose numbers come in `x,y` pairs (M, L, C, Q).
 */
export function flipped(d: string): string {
  return d.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, y) => `${short(-x)},${y}`);
}
