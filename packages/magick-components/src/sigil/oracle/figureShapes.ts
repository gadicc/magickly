/**
 * Shapes in a word's ink (plan 088, O2 and O3): maximal straight lines,
 * closed loops, cups and the waves they form, found from geometry alone,
 * whatever order, direction or grouping the SVG's commands had. Lines are
 * merged when collinear and touching (and, for read-back, overlapping);
 * curves are joined where one continues another with the same tangent and
 * curvature, so an arc split in two is one arc and two cups meeting in a
 * cusp stay two.
 */

import type { Point } from "../types.ts";
import type { InkPiece } from "./figure.ts";

/** A straight segment. */
export interface Segment {
  a: Point;
  b: Point;
}

/** A closed curve with the circle that fits it. */
export interface LoopShape {
  center: Point;
  radius: number;
  /** (max − min distance from the centre) / radius: 0 for a circle. */
  roundness: number;
  points: Point[];
}

/** An open curve with both ends on one line and all of it to one side. */
export interface CupShape {
  a: Point;
  b: Point;
  /** Greatest distance from the chord. */
  depth: number;
  /** +1 if it bulges to the left of a→b (positive cross product), else −1. */
  side: number;
  points: Point[];
}

/** Cups in a row on one line, meeting end to end. */
export interface WaveShape {
  a: Point;
  b: Point;
  /** In order from `a` to `b`, each oriented that way. */
  cups: CupShape[];
  /** Every cup bulges to the same side, as a crook's cups must. */
  sidesAgree: boolean;
}

/** A word's ink as shapes. */
export interface InkShapes {
  lines: Segment[];
  loops: LoopShape[];
  waves: WaveShape[];
  /** Curves that are neither loops nor cups. */
  unknown: Point[][];
}

/**
 * Tolerances for reading shapes, in sigil units: ink coordinates are
 * written to 0.001, so these sit well above rounding and well below
 * anything the grammar draws.
 */
export const SHAPE_TOLERANCE = {
  /** Points closer than this are the same point. */
  join: 0.05,
  /** A line's end within this of another line's extension is collinear with it… */
  collinear: 0.03,
  /** …if their directions differ by at most this, in degrees. */
  collinearAngle: 1,
  /** Curves continue each other when their tangents differ by at most this, in degrees. */
  tangent: 25,
  /** A loop is round when its roundness is at most this. */
  roundness: 0.2,
} as const;

export const sub = (p: Point, q: Point): Point => ({
  x: p.x - q.x,
  y: p.y - q.y,
});
export const dist = (p: Point, q: Point): number =>
  Math.hypot(p.x - q.x, p.y - q.y);
export const cross = (u: Point, v: Point): number => u.x * v.y - u.y * v.x;
export const dot = (u: Point, v: Point): number => u.x * v.x + u.y * v.y;
export const norm = (u: Point): Point => {
  const l = Math.hypot(u.x, u.y);
  return l === 0 ? { x: 0, y: 0 } : { x: u.x / l, y: u.y / l };
};

/** The angle between two directions, in degrees (0–180). */
export function angleBetween(u: Point, v: Point): number {
  return (Math.atan2(Math.abs(cross(u, v)), dot(u, v)) * 180) / Math.PI;
}

/** Distance from `p` to the segment `s`, and the parameter of its foot (0–1). */
export function toSegment(p: Point, s: Segment): { d: number; t: number } {
  const v = sub(s.b, s.a);
  const l2 = dot(v, v);
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, s.a), v) / l2));
  return { d: dist(p, { x: s.a.x + t * v.x, y: s.a.y + t * v.y }), t };
}

/** Distance from `p` to the infinite line through `s`. */
export function toLine(p: Point, s: Segment): number {
  const l = dist(s.a, s.b);
  return l === 0
    ? dist(p, s.a)
    : Math.abs(cross(sub(s.b, s.a), sub(p, s.a))) / l;
}

export function length(s: Segment): number {
  return dist(s.a, s.b);
}

function polylineLength(points: Point[]): number {
  let l = 0;
  for (let i = 1; i < points.length; i++) l += dist(points[i - 1], points[i]);
  return l;
}

/** The point at arc length `s` along a polyline. */
function pointAlong(points: Point[], s: number): Point {
  let left = s;
  for (let i = 1; i < points.length; i++) {
    const l = dist(points[i - 1], points[i]);
    if (left <= l && l > 0) {
      const t = left / l;
      return {
        x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
        y: points[i - 1].y + t * (points[i].y - points[i - 1].y),
      };
    }
    left -= l;
  }
  return points[points.length - 1];
}

function mergeLines(
  pieces: Segment[],
  unit: number,
  overlapping: boolean,
): Segment[] {
  const tol = SHAPE_TOLERANCE.collinear * unit;
  const sinAngle = Math.sin((SHAPE_TOLERANCE.collinearAngle * Math.PI) / 180);
  const parent = pieces.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++) {
      const p = pieces[i];
      const q = pieces[j];
      const u = norm(sub(p.b, p.a));
      const v = norm(sub(q.b, q.a));
      if (Math.abs(cross(u, v)) > sinAngle) continue;
      if (
        toLine(q.a, p) > tol ||
        toLine(q.b, p) > tol ||
        toLine(p.a, q) > tol ||
        toLine(p.b, q) > tol
      )
        continue;
      parent[find(i)] = find(j);
    }
  const groups = new Map<number, Segment[]>();
  for (let i = 0; i < pieces.length; i++) {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), pieces[i]]);
  }
  const join = SHAPE_TOLERANCE.join * unit;
  const lines: Segment[] = [];
  for (const group of groups.values()) {
    const ref = group.reduce((best, s) =>
      length(s) > length(best) ? s : best,
    );
    const dir = norm(sub(ref.b, ref.a));
    const at = (p: Point) => dot(sub(p, ref.a), dir);
    const intervals = group
      .map((s) =>
        at(s.a) <= at(s.b)
          ? { s0: at(s.a), s1: at(s.b), p0: s.a, p1: s.b }
          : { s0: at(s.b), s1: at(s.a), p0: s.b, p1: s.a },
      )
      .sort((x, y) => x.s0 - y.s0 || x.s1 - y.s1);
    const chains: (typeof intervals)[number][] = [];
    for (const interval of intervals) {
      const chain = overlapping
        ? chains.find((c) => interval.s0 <= c.s1 + join)
        : chains.find(
            (c) => Math.abs(interval.s0 - c.s1) <= join && interval.s1 > c.s1,
          );
      if (!chain) chains.push({ ...interval });
      else if (interval.s1 > chain.s1) {
        chain.s1 = interval.s1;
        chain.p1 = interval.p1;
      }
    }
    for (const c of chains) lines.push({ a: c.p0, b: c.p1 });
  }
  return lines;
}

interface CurveEnd {
  piece: number;
  end: 0 | 1;
  point: Point;
  /** Direction of travel leaving the curve through this end. */
  out: Point;
  /** Signed curvature travelling towards this end. */
  k: number;
}

function curvature(p0: Point, p1: Point, p2: Point): number {
  const a = dist(p0, p1);
  const b = dist(p1, p2);
  const c = dist(p0, p2);
  if (a * b * c === 0) return 0;
  return (2 * cross(sub(p1, p0), sub(p2, p0))) / (a * b * c);
}

function curveEnds(points: Point[], piece: number, unit: number): CurveEnd[] {
  const total = polylineLength(points);
  const s = Math.min(0.15 * unit, total / 3);
  const ends: CurveEnd[] = [];
  for (const end of [0, 1] as const) {
    const q2 = end === 1 ? points[points.length - 1] : points[0];
    const q1 = pointAlong(points, end === 1 ? total - s : s);
    const q0 = pointAlong(points, end === 1 ? total - 2 * s : 2 * s);
    ends.push({
      piece,
      end,
      point: q2,
      out: norm(sub(q2, q1)),
      k: curvature(q0, q1, q2),
    });
  }
  return ends;
}

function joinCurves(curves: Point[][], unit: number): Point[][][] {
  const join = SHAPE_TOLERANCE.join * unit;
  const ends = curves.flatMap((points, i) => curveEnds(points, i, unit));
  const pairs: { e: number; f: number; score: number }[] = [];
  for (let e = 0; e < ends.length; e++)
    for (let f = e + 1; f < ends.length; f++) {
      const x = ends[e];
      const y = ends[f];
      if (dist(x.point, y.point) > join) continue;
      const angle = angleBetween(x.out, { x: -y.out.x, y: -y.out.y });
      if (angle > SHAPE_TOLERANCE.tangent) continue;
      const scale = Math.max(Math.abs(x.k), Math.abs(y.k));
      const mismatch = Math.abs(x.k + y.k);
      if (mismatch > 0.35 * scale + 0.05 / unit) continue;
      pairs.push({
        e,
        f,
        score: angle + (scale ? (20 * mismatch) / scale : 0),
      });
    }
  pairs.sort((p, q) => p.score - q.score);
  const partner = new Map<number, number>();
  for (const { e, f } of pairs) {
    if (partner.has(e) || partner.has(f)) continue;
    partner.set(e, f);
    partner.set(f, e);
  }
  // Each piece's ends are ends[2i] (start) and ends[2i + 1] (end).
  const seen = new Set<number>();
  const chains: Point[][][] = [];
  const walk = (startPiece: number, enterEnd: 0 | 1) => {
    const chain: Point[][] = [];
    let piece = startPiece;
    let enter = enterEnd;
    while (!seen.has(piece)) {
      seen.add(piece);
      const points = curves[piece];
      chain.push(enter === 0 ? points : [...points].reverse());
      const leave = (1 - enter) as 0 | 1;
      const next = partner.get(2 * piece + leave);
      if (next === undefined) break;
      piece = Math.floor(next / 2);
      enter = (next % 2) as 0 | 1;
    }
    return chain;
  };
  for (let i = 0; i < curves.length; i++) {
    if (seen.has(i)) continue;
    const startFree = !partner.has(2 * i);
    const endFree = !partner.has(2 * i + 1);
    if (startFree) chains.push(walk(i, 0));
    else if (endFree) chains.push(walk(i, 1));
  }
  for (let i = 0; i < curves.length; i++)
    if (!seen.has(i)) chains.push(walk(i, 0));
  return chains;
}

function concat(chain: Point[][]): Point[] {
  const points: Point[] = [];
  for (const part of chain)
    points.push(...(points.length ? part.slice(1) : part));
  return points;
}

function fitLoop(points: Point[]): LoopShape {
  // Centroid of the curve, weighted by length, then mean distance.
  let cx = 0;
  let cy = 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = dist(points[i - 1], points[i]);
    cx += ((points[i - 1].x + points[i].x) / 2) * l;
    cy += ((points[i - 1].y + points[i].y) / 2) * l;
    total += l;
  }
  const center = total ? { x: cx / total, y: cy / total } : points[0];
  const ds = points.map((p) => dist(p, center));
  const radius = ds.reduce((s, d) => s + d, 0) / ds.length;
  const roundness = radius ? (Math.max(...ds) - Math.min(...ds)) / radius : 1;
  return { center, radius, roundness, points };
}

function asCup(points: Point[], unit: number): CupShape | null {
  const a = points[0];
  const b = points[points.length - 1];
  const chord = dist(a, b);
  if (chord < 0.3 * unit) return null;
  const v = sub(b, a);
  let depth = 0;
  let side = 0;
  for (const p of points) {
    const d = cross(v, sub(p, a)) / chord;
    if (Math.abs(d) > depth) {
      depth = Math.abs(d);
      side = Math.sign(d);
    }
  }
  if (depth < 0.1 * unit) return null;
  const slack = 0.05 * unit;
  for (const p of points) {
    const d = (cross(v, sub(p, a)) / chord) * side;
    const t = dot(sub(p, a), v) / (chord * chord);
    if (d < -slack || t < -0.1 || t > 1.1) return null;
  }
  return { a, b, depth, side, points };
}

function reverseCup(cup: CupShape): CupShape {
  return {
    a: cup.b,
    b: cup.a,
    depth: cup.depth,
    side: -cup.side,
    points: [...cup.points].reverse(),
  };
}

function groupWaves(cups: CupShape[], unit: number): WaveShape[] {
  const join = SHAPE_TOLERANCE.join * unit;
  const line = 0.1 * unit;
  // Neighbours share an end and lie on one line.
  const ends = cups.flatMap((cup, i) => [
    { cup: i, end: 0, point: cup.a },
    { cup: i, end: 1, point: cup.b },
  ]);
  const partner = new Map<number, number>();
  const candidates: { e: number; f: number; off: number }[] = [];
  for (let e = 0; e < ends.length; e++)
    for (let f = e + 1; f < ends.length; f++) {
      if (ends[e].cup === ends[f].cup) continue;
      if (dist(ends[e].point, ends[f].point) > join) continue;
      const p = cups[ends[e].cup];
      const q = cups[ends[f].cup];
      const off = Math.max(toLine(q.a, p), toLine(q.b, p));
      if (off <= line) candidates.push({ e, f, off });
    }
  candidates.sort((x, y) => x.off - y.off);
  for (const { e, f } of candidates) {
    if (partner.has(e) || partner.has(f)) continue;
    partner.set(e, f);
    partner.set(f, e);
  }
  const seen = new Set<number>();
  const waves: WaveShape[] = [];
  const walk = (start: number, enter: 0 | 1) => {
    const chain: CupShape[] = [];
    let i = start;
    let e = enter;
    while (!seen.has(i)) {
      seen.add(i);
      chain.push(e === 0 ? cups[i] : reverseCup(cups[i]));
      const next = partner.get(2 * i + (1 - e));
      if (next === undefined) break;
      i = Math.floor(next / 2);
      e = (next % 2) as 0 | 1;
    }
    const side = chain[0].side;
    waves.push({
      a: chain[0].a,
      b: chain[chain.length - 1].b,
      cups: chain,
      sidesAgree: chain.every((cup) => cup.side === side),
    });
  };
  for (let i = 0; i < cups.length; i++) {
    if (seen.has(i)) continue;
    if (!partner.has(2 * i)) walk(i, 0);
    else if (!partner.has(2 * i + 1)) walk(i, 1);
  }
  // Cups closing on themselves cannot happen on a line; anything left is a ring of cups.
  for (let i = 0; i < cups.length; i++) if (!seen.has(i)) walk(i, 0);
  return waves;
}

/**
 * The shapes in one word's ink (layout coordinates). With `overlapping`,
 * collinear lines that overlap merge into one, as a reader sees ink drawn
 * twice (O3); without it only lines that continue one another merge, so
 * two strokes laid on each other stay two and their overlap can be
 * measured (O2).
 */
export function inkShapes(
  pieces: readonly InkPiece[],
  unit: number,
  overlapping: boolean,
): InkShapes {
  const lines = mergeLines(
    pieces
      .filter((piece) => piece.kind === "line")
      .map((piece) => ({ a: piece.points[0], b: piece.points[1] })),
    unit,
    overlapping,
  );
  const loops: LoopShape[] = [];
  const unknown: Point[][] = [];
  const cups: CupShape[] = [];
  const open: Point[][] = [];
  for (const piece of pieces) {
    if (piece.kind !== "curve") continue;
    if (piece.closed) loops.push(fitLoop(piece.points));
    else open.push(piece.points);
  }
  const join = SHAPE_TOLERANCE.join * unit;
  for (const chain of joinCurves(open, unit)) {
    const points = concat(chain);
    const closed = dist(points[0], points[points.length - 1]) <= join;
    if (closed && polylineLength(points) > 4 * join) {
      const loop = fitLoop(points);
      if (loop.roundness <= SHAPE_TOLERANCE.roundness) loops.push(loop);
      else unknown.push(points);
      continue;
    }
    const cup = asCup(points, unit);
    if (cup) cups.push(cup);
    else unknown.push(points);
  }
  return { lines, loops, waves: groupWaves(cups, unit), unknown };
}

/** A line or wave end, with the direction the ink leaves it in. */
export interface InkEnd {
  point: Point;
  /** Unit direction from this end into the line or wave. */
  into: Point;
  kind: "line" | "wave";
  index: number;
}

/** Every end of every line and wave. */
export function inkEnds(shapes: InkShapes): InkEnd[] {
  const ends: InkEnd[] = [];
  shapes.lines.forEach((s, index) => {
    ends.push({ point: s.a, into: norm(sub(s.b, s.a)), kind: "line", index });
    ends.push({ point: s.b, into: norm(sub(s.a, s.b)), kind: "line", index });
  });
  shapes.waves.forEach((w, index) => {
    ends.push({ point: w.a, into: norm(sub(w.b, w.a)), kind: "wave", index });
    ends.push({ point: w.b, into: norm(sub(w.a, w.b)), kind: "wave", index });
  });
  return ends;
}

/**
 * Ends that leave `loop`'s rim straight outwards: where a start circle's
 * first stroke (or first wave) begins.
 */
export function rimEnds(
  loop: LoopShape,
  ends: InkEnd[],
  unit: number,
): InkEnd[] {
  const tol = 0.1 * unit + 0.05 * loop.radius;
  return ends.filter(
    (e) =>
      Math.abs(dist(e.point, loop.center) - loop.radius) <= tol &&
      angleBetween(sub(e.point, loop.center), e.into) <= 12,
  );
}

/** A line read as a bar: its index, and the end of the stroke it is centred on. */
export interface BarCandidate {
  line: number;
  /** The last stroke's end at the bar's middle, or the start circle's centre on a one-vertex word. */
  at: Point;
  /** The last stroke's direction arriving at `at`, or +x on a one-vertex word. */
  arriving: Point;
  /** Index of the stroke (line or wave end) the bar sits on; null on a one-vertex word. */
  end: InkEnd | null;
}

/**
 * Lines that could be a word's end bar: centred on the end of another line
 * or wave, across it within `maxSkew` degrees of perpendicular, with
 * nothing else at their own ends; or, on a one-vertex word, centred on a
 * loop's centre.
 */
export function barCandidates(
  shapes: InkShapes,
  unit: number,
  maxSkew: number,
): BarCandidate[] {
  const ends = inkEnds(shapes);
  const join = SHAPE_TOLERANCE.join * unit;
  const near = 0.3 * unit;
  const found: BarCandidate[] = [];
  shapes.lines.forEach((bar, line) => {
    const mid = { x: (bar.a.x + bar.b.x) / 2, y: (bar.a.y + bar.b.y) / 2 };
    const dir = norm(sub(bar.b, bar.a));
    const others = ends.filter((e) => !(e.kind === "line" && e.index === line));
    if (
      others.some(
        (e) => dist(e.point, bar.a) <= join || dist(e.point, bar.b) <= join,
      )
    )
      return;
    for (const e of others) {
      if (dist(e.point, mid) > near) continue;
      const arriving = { x: -e.into.x, y: -e.into.y };
      if (Math.abs(90 - angleBetween(dir, arriving)) > maxSkew) continue;
      found.push({ line, at: e.point, arriving, end: e });
    }
    const otherLines = shapes.lines.length - 1;
    if (otherLines === 0)
      for (const loop of shapes.loops)
        if (dist(loop.center, mid) <= near)
          found.push({
            line,
            at: loop.center,
            arriving: { x: 1, y: 0 },
            end: null,
          });
  });
  return found;
}

/** Where a loop touches a line as a noose: the line and the foot of the loop's centre on it. */
export interface NooseContact {
  line: number;
  foot: Point;
  /** |distance from centre to line − radius|. */
  gap: number;
}

/** Lines `loop` is tangent to within `tolerance`, with its foot within the line. */
export function nooseContacts(
  loop: LoopShape,
  shapes: InkShapes,
  unit: number,
  tolerance: number,
  exclude: ReadonlySet<number> = new Set(),
): NooseContact[] {
  const join = SHAPE_TOLERANCE.join * unit;
  const contacts: NooseContact[] = [];
  shapes.lines.forEach((s, line) => {
    if (exclude.has(line)) return;
    const l = length(s);
    if (l === 0) return;
    const dir = norm(sub(s.b, s.a));
    const t = dot(sub(loop.center, s.a), dir);
    if (t < -join || t > l + join) return;
    const gap = Math.abs(toLine(loop.center, s) - loop.radius);
    if (gap > tolerance) return;
    const tt = Math.max(0, Math.min(l, t));
    contacts.push({
      line,
      foot: { x: s.a.x + tt * dir.x, y: s.a.y + tt * dir.y },
      gap,
    });
  });
  return contacts.sort((x, y) => x.gap - y.gap);
}

/** Least distance between two segments: 0 where they cross. */
export function segmentDistance(p: Segment, q: Segment): number {
  const d1 = cross(sub(p.b, p.a), sub(q.a, p.a));
  const d2 = cross(sub(p.b, p.a), sub(q.b, p.a));
  const d3 = cross(sub(q.b, q.a), sub(p.a, q.a));
  const d4 = cross(sub(q.b, q.a), sub(p.b, q.a));
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(
    toSegment(p.a, q).d,
    toSegment(p.b, q).d,
    toSegment(q.a, p).d,
    toSegment(q.b, p).d,
  );
}

/**
 * `s` without the stretch within `skip` of each of `ends` it starts or
 * finishes at, so ink meeting a mark at its own vertex is not measured
 * where it must touch; `null` when nothing is left.
 */
function clipped(
  s: Segment,
  ends: readonly Point[],
  skip: number,
  join: number,
): Segment | null {
  const l = length(s);
  const dir = norm(sub(s.b, s.a));
  let t0 = 0;
  let t1 = l;
  for (const e of ends) {
    if (dist(e, s.a) <= join) t0 = Math.max(t0, skip);
    if (dist(e, s.b) <= join) t1 = Math.min(t1, l - skip);
  }
  if (t1 <= t0) return null;
  return {
    a: { x: s.a.x + t0 * dir.x, y: s.a.y + t0 * dir.y },
    b: { x: s.a.x + t1 * dir.x, y: s.a.y + t1 * dir.y },
  };
}

function pointsToSegment(points: readonly Point[], s: Segment): number {
  let d = Number.POSITIVE_INFINITY;
  for (const p of points) d = Math.min(d, toSegment(p, s).d);
  return d;
}

function pointsToPoints(a: readonly Point[], b: readonly Point[]): number {
  let d = Number.POSITIVE_INFINITY;
  for (const p of a) for (const q of b) d = Math.min(d, dist(p, q));
  return d;
}

/** How close other ink comes to a mark, and where. */
export interface Intrusion {
  distance: number;
  at: Point;
}

/**
 * How close ink that is not its own comes to the bar on `bar.line`. Its
 * own ink is the last stroke, which it crosses at its middle (measured
 * from `skip` away from it), and on a one-vertex word the start circle it
 * runs through; everything else counts, start circle and nooses included.
 */
export function barIntrusion(
  shapes: InkShapes,
  bar: BarCandidate,
  unit: number,
  skip: number,
): Intrusion {
  const join = SHAPE_TOLERANCE.join * unit;
  const s = shapes.lines[bar.line];
  let distance = Number.POSITIVE_INFINITY;
  shapes.lines.forEach((line, i) => {
    if (i === bar.line) return;
    const part = clipped(line, [bar.at], skip, join);
    if (part) distance = Math.min(distance, segmentDistance(part, s));
  });
  for (const loop of shapes.loops) {
    if (bar.end === null && dist(loop.center, bar.at) <= 0.3 * unit) continue;
    distance = Math.min(distance, pointsToSegment(loop.points, s));
  }
  for (const wave of shapes.waves) {
    // A crook at the last vertex ends where the bar crosses: its own.
    if (dist(wave.a, bar.at) <= join || dist(wave.b, bar.at) <= join) continue;
    for (const cup of wave.cups)
      distance = Math.min(distance, pointsToSegment(cup.points, s));
  }
  return { distance, at: bar.at };
}

/** `s` cut to the half-plane where `side(p) ≥ 0`, or null if none of it is there. */
function halfPlane(s: Segment, side: (p: Point) => number): Segment | null {
  const da = side(s.a);
  const db = side(s.b);
  if (da < 0 && db < 0) return null;
  if (da >= 0 && db >= 0) return s;
  const t = da / (da - db);
  const cut = {
    x: s.a.x + t * (s.b.x - s.a.x),
    y: s.a.y + t * (s.b.y - s.a.y),
  };
  return da >= 0 ? { a: s.a, b: cut } : { a: cut, b: s.b };
}

/**
 * How close ink that is not its own comes to each wave's cups, on the side
 * they bulge to: ink there runs through them and wipes them out, while a
 * narrow return along the far side of their line (F1's wedge at a crooked
 * vertex) leaves them standing. Its own ink is the stroke it lies on and
 * the stroke leaving its vertex (measured from `skip` away from the
 * wave's ends), the start circle whose rim it leaves, and a bar centred
 * on its end.
 */
export function waveIntrusions(
  shapes: InkShapes,
  unit: number,
  skip: number,
): Intrusion[] {
  const join = SHAPE_TOLERANCE.join * unit;
  return shapes.waves.map((wave, w) => {
    const points = wave.cups.flatMap((cup) => cup.points);
    const ends = [wave.a, wave.b];
    const chord = Math.max(dist(wave.a, wave.b), Number.EPSILON);
    const v = sub(wave.b, wave.a);
    const bulge = wave.cups[0].side;
    const side = (p: Point) => (bulge * cross(v, sub(p, wave.a))) / chord;
    const onSide = (ps: readonly Point[]) => ps.filter((p) => side(p) >= 0);
    let distance = Number.POSITIVE_INFINITY;
    for (const line of shapes.lines) {
      const mid = {
        x: (line.a.x + line.b.x) / 2,
        y: (line.a.y + line.b.y) / 2,
      };
      if (ends.some((e) => dist(e, mid) <= 0.3 * unit)) continue;
      const own = clipped(line, ends, skip, join);
      const part = own && halfPlane(own, side);
      if (part) distance = Math.min(distance, pointsToSegment(points, part));
    }
    for (const loop of shapes.loops) {
      const onRim = ends.some(
        (e) => Math.abs(dist(e, loop.center) - loop.radius) <= 0.15 * unit,
      );
      if (!onRim)
        distance = Math.min(
          distance,
          pointsToPoints(points, onSide(loop.points)),
        );
    }
    shapes.waves.forEach((other, o) => {
      if (o === w) return;
      for (const cup of other.cups)
        distance = Math.min(
          distance,
          pointsToPoints(points, onSide(cup.points)),
        );
    });
    return { distance, at: wave.b };
  });
}

/** The least distance between two loops' inks, for every pair, closest first. */
export function loopContacts(
  shapes: InkShapes,
): { a: number; b: number; distance: number; at: Point }[] {
  const contacts: { a: number; b: number; distance: number; at: Point }[] = [];
  for (let a = 0; a < shapes.loops.length; a++)
    for (let b = a + 1; b < shapes.loops.length; b++) {
      const p = shapes.loops[a];
      const q = shapes.loops[b];
      // Rings whose centres are farther apart than their radii and a margin cannot touch.
      if (dist(p.center, q.center) > p.radius + q.radius + 4) continue;
      contacts.push({
        a,
        b,
        distance: pointsToPoints(p.points, q.points),
        at: p.center,
      });
    }
  return contacts.sort((x, y) => x.distance - y.distance);
}
