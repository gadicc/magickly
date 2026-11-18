/**
 * Plane geometry for placement and the renderer (plan 088). Only
 * `+ − × ÷ √` and comparisons: IEEE 754 rounds each of these exactly the
 * same in every engine, unlike trig, so a figure computed from quantised
 * inputs is the same figure in Node, Chromium and the oracle.
 */

import type { Point } from "./types.ts";

/** A coordinate as the SVG writes it, to 0.001 (`svgCoordinate`'s rounding). */
export const quantise = (value: number): number =>
  Math.round(value * 1000) / 1000 + 0;

/** A point quantised as the SVG writes it. */
export const quantised = (p: Point): Point => ({
  x: quantise(p.x),
  y: quantise(p.y),
});

export const add = (p: Point, q: Point): Point => ({
  x: p.x + q.x,
  y: p.y + q.y,
});
export const sub = (p: Point, q: Point): Point => ({
  x: p.x - q.x,
  y: p.y - q.y,
});
export const scale = (p: Point, s: number): Point => ({
  x: p.x * s,
  y: p.y * s,
});
export const dot = (u: Point, v: Point): number => u.x * v.x + u.y * v.y;
export const cross = (u: Point, v: Point): number => u.x * v.y - u.y * v.x;
export const dist = (p: Point, q: Point): number => {
  const dx = p.x - q.x;
  const dy = p.y - q.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/** The unit vector from `from` to `to`, or `fallback` where they meet. */
export function direction(
  from: Point,
  to: Point,
  fallback: Point = { x: 1, y: 0 },
): Point {
  const l = dist(from, to);
  return l === 0
    ? fallback
    : { x: (to.x - from.x) / l, y: (to.y - from.y) / l };
}

/** `d` turned a quarter towards +y (clockwise on the page, SVG's positive angle). */
export const normal = (d: Point): Point => ({ x: -d.y, y: d.x });

/** `p + d × s`. */
export const along = (p: Point, d: Point, s: number): Point => ({
  x: p.x + d.x * s,
  y: p.y + d.y * s,
});

/** A straight segment. */
export interface Segment {
  a: Point;
  b: Point;
}

/** Distance from `p` to segment `s`, with the parameter of its foot (0–1). */
export function toSegment(p: Point, s: Segment): { d: number; t: number } {
  const v = sub(s.b, s.a);
  const l2 = dot(v, v);
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, s.a), v) / l2));
  return { d: dist(p, along(s.a, v, t)), t };
}

/**
 * Where on segment `a` (as parameters 0–1) the line lies within `within`
 * of segment `b`: one interval, since the region within a distance of a
 * segment is convex, or null. Found exactly: the band beside `b` and the
 * discs at its ends each cut `a` in an interval, and their hull is the cut.
 */
function nearInterval(
  a: Segment,
  b: Segment,
  within: number,
): [number, number] | null {
  const u = sub(a.b, a.a);
  const uu = dot(u, u);
  if (uu === 0) return null;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  const take = (t0: number, t1: number) => {
    const s = Math.max(0, t0);
    const e = Math.min(1, t1);
    if (s < e) {
      lo = Math.min(lo, s);
      hi = Math.max(hi, e);
    }
  };
  // Discs at b's ends: |a.a + t u − c|² < within².
  for (const c of [b.a, b.b]) {
    const w = sub(a.a, c);
    const bq = dot(w, u);
    const cq = dot(w, w) - within * within;
    const disc = bq * bq - uu * cq;
    if (disc > 0) {
      const root = Math.sqrt(disc);
      take((-bq - root) / uu, (-bq + root) / uu);
    }
  }
  // The band: |cross(v, p − b.a)| / |v| < within and 0 ≤ projection ≤ |v|².
  const v = sub(b.b, b.a);
  const vv = dot(v, v);
  if (vv > 0) {
    const lv = Math.sqrt(vv);
    let t0 = Number.NEGATIVE_INFINITY;
    let t1 = Number.POSITIVE_INFINITY;
    const limit = (k0: number, k1: number, min: number, max: number) => {
      // min < k0 + k1 t < max
      if (k1 === 0) {
        if (!(k0 > min && k0 < max)) t0 = Number.POSITIVE_INFINITY;
        return;
      }
      const r0 = (min - k0) / k1;
      const r1 = (max - k0) / k1;
      t0 = Math.max(t0, Math.min(r0, r1));
      t1 = Math.min(t1, Math.max(r0, r1));
    };
    const w = sub(a.a, b.a);
    limit(cross(v, w) / lv, cross(v, u) / lv, -within, within);
    limit(dot(v, w), dot(v, u), 0, vv);
    if (t0 < t1) take(t0, t1);
  }
  return lo < hi ? [lo, hi] : null;
}

/**
 * How long two strokes' centre lines run closer than `within`: the longer
 * of the stretch of each within `within` of the other, as the oracle's
 * overlap check measures it.
 */
export function overlapLength(a: Segment, b: Segment, within: number): number {
  const ab = nearInterval(a, b, within);
  const ba = nearInterval(b, a, within);
  return Math.max(
    ab ? (ab[1] - ab[0]) * dist(a.a, a.b) : 0,
    ba ? (ba[1] - ba[0]) * dist(b.a, b.b) : 0,
  );
}
