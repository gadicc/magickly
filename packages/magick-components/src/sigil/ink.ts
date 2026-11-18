/**
 * The sigil renderer (plan 088, "Renderer"): placed words to ink by the
 * oracle's figure grammar (`oracle/figure.ts`), as shapes for placement to
 * check and as SVG path data. Per word: a start circle on the first
 * vertex, the first stroke leaving its rim; straight strokes vertex to
 * vertex; a crook as two cups per merged letter on the stroke into its
 * vertex (out of the first); a noose as a round loop tangent to the line
 * at its vertex; a bar across the last stroke at the last vertex. Words
 * run right to left, each in its own square region of one SVG.
 *
 * Sizes are in sigil units and scale with `SigilLayout.unit`. Only
 * `+ − × ÷ √` (`geometry.ts`) and every coordinate written through
 * `svgCoordinate`, so placed points quantised to 0.001 give the same path
 * data in every engine.
 */

import { svgCoordinate } from "../svgCoordinate.ts";
import {
  add,
  along,
  cross,
  direction,
  dist,
  dot,
  normal,
  quantise,
  type Segment,
  scale,
  sub,
} from "./geometry.ts";
import type {
  PlacedWord,
  Point,
  SigilLayout,
  SigilMarkSizes,
  SigilProfile,
} from "./types.ts";

/** What drawing needs of a layout: its geometry, not its tokens. */
export type SigilGeometry = Omit<SigilLayout<never>, "place">;

/**
 * The renderer's mark sizes unless a profile gives its own, each inside
 * the figure grammar's range and clear of its edges: a 1.5 start circle
 * (1–2.5), cups 2–2.6 wide (2–3.5), the narrowest only where a stroke is short and 1.2 deep (1–2), a 1.25 noose
 * (1–2), a 4-unit bar (3–6), and a unit of straight line beside marks.
 */
export const DEFAULT_SIGIL_MARKS: SigilMarkSizes = {
  startRadius: 1.5,
  cupChord: 2.6,
  cupMinChord: 2,
  cupDepth: 1.2,
  nooseRadius: 1.25,
  barLength: 4,
  minStraight: 1,
};

/** The mark sizes `profile` draws with. */
export function marksOf(profile: SigilProfile): SigilMarkSizes {
  return { ...DEFAULT_SIGIL_MARKS, ...profile.marks };
}

/** A command of the path, in layout coordinates. */
export type InkCommand =
  | { type: "M" | "L"; to: Point }
  | { type: "C"; c1: Point; c2: Point; to: Point }
  | { type: "A"; r: number; sweep: boolean; to: Point };

/** A loop: the start circle or a noose. */
export interface InkLoop {
  vertex: number;
  kind: "start" | "noose";
  center: Point;
  radius: number;
}

/** A crook's wave: `2 × crooks` cups in a row on a stroke. */
export interface InkWave {
  vertex: number;
  /** The stroke it lies on (vertex `stroke` to `stroke + 1`). */
  stroke: number;
  from: Point;
  to: Point;
  /** The side the cups bulge to, as a unit normal. */
  side: Point;
  depth: number;
  /** Points along the cups, for measuring how close other ink comes. */
  points: Point[];
}

/** A straight piece of a stroke, with the stroke it belongs to (vertex `i` to `i + 1`). */
export interface InkLine extends Segment {
  stroke: number;
}

/** One word's ink as shapes, and as path commands in drawing order. */
export interface WordInk {
  /** One per stroke, in order. */
  lines: InkLine[];
  loops: InkLoop[];
  waves: InkWave[];
  bar: Segment;
  commands: InkCommand[];
  /** Strokes whose cups had to be narrower than the profile's narrowest. */
  cramped: number[];
}

/** A circle as four quarter arcs from `start`, round `center`, back to `start`. */
function circleCommands(
  center: Point,
  start: Point,
  r: number,
  sweep: boolean,
): InkCommand[] {
  const u = scale(sub(start, center), 1 / r);
  // Quarter turns of u, in the direction `sweep` draws.
  const turn = (v: Point) => (sweep ? normal(v) : scale(normal(v), -1));
  const commands: InkCommand[] = [];
  let v = u;
  for (let k = 0; k < 4; k++) {
    v = turn(v);
    commands.push({
      type: "A",
      r,
      sweep,
      to: k === 3 ? start : along(center, v, r),
    });
  }
  return commands;
}

/** Samples along each cup, for measuring clearance (plenty at a cup's size). */
export const CUP_SAMPLES = 16;

/**
 * `count` cups from `from` along `d`, bulging to `side`, each `chord`
 * wide, as path commands and as points along them.
 */
function cups(
  from: Point,
  d: Point,
  side: Point,
  count: number,
  chord: number,
  depth: number,
): { commands: InkCommand[]; points: Point[] } {
  // A cubic whose control points stand over its ends at 4/3 of the depth
  // peaks at the depth, with tangents square to the line: a cusp where
  // two cups meet.
  const lift = (depth * 4) / 3;
  const commands: InkCommand[] = [];
  const points: Point[] = [from];
  let p = from;
  for (let k = 0; k < count; k++) {
    const q = along(p, d, chord);
    const c1 = along(p, side, lift);
    const c2 = along(q, side, lift);
    commands.push({ type: "C", c1, c2, to: q });
    for (let j = 1; j <= CUP_SAMPLES; j++) {
      const t = j / CUP_SAMPLES;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const e = t * t * t;
      points.push({
        x: a * p.x + b * c1.x + c * c2.x + e * q.x,
        y: a * p.y + b * c1.y + c * c2.y + e * q.y,
      });
    }
    p = q;
  }
  return { commands, points };
}

/** +1 or −1: the side of a turn from `d1` to `d2` its outside lies on. */
function outside(d1: Point, d2: Point): 1 | -1 {
  return cross(d1, d2) > 0 ? -1 : 1;
}

/**
 * The side, ±1 of `normal` of its line, a crook or noose at vertex `i` is
 * drawn on unless placement chose (`PlacedVertex.side`): a crook's cups on
 * the outside of the turn at its vertex, where the next stroke does not
 * go (at the first vertex, the turn at the second); a noose on the
 * outside of the next turn, or of the one before; a lone word's cups
 * towards the middle of the layout.
 */
export function defaultSide(
  points: readonly Point[],
  i: number,
  bound?: { center: Point },
): 1 | -1 {
  const n = points.length;
  const d = (k: number) => direction(points[k], points[k + 1]);
  if (n === 1) return bound && points[0].y > bound.center.y ? -1 : 1;
  if (i === 0) return n > 2 ? outside(d(0), d(1)) : 1;
  if (i === n - 1) return 1;
  // A noose's line runs from i − 1 to i + 1 straight; a crook's turns at i.
  if (i + 1 < n - 1) return outside(d(i), d(i + 1));
  if (i - 1 > 0) return outside(d(i - 2), d(i - 1));
  return outside(d(i - 1), d(i));
}

/**
 * The ink of one placed word, in layout coordinates. `unit` scales the
 * profile's sizes; points should already be quantised.
 */
export function wordInk(
  word: PlacedWord,
  unit: number,
  profile: SigilProfile,
  bound?: { center: Point; radius: number },
): WordInk {
  const m = marksOf(profile);
  const rs = m.startRadius * unit;
  const depth = m.cupDepth * unit;
  const pts = word.map((v) => v.point);
  const n = pts.length;
  const lines: InkLine[] = [];
  const loops: InkLoop[] = [];
  const waves: InkWave[] = [];
  const commands: InkCommand[] = [];
  const cramped: number[] = [];
  const sideOf = (i: number) => word[i].side ?? defaultSide(pts, i, bound);

  const x = { x: 1, y: 0 };
  const d0 = n > 1 ? direction(pts[0], pts[1]) : x;
  const rim = along(pts[0], d0, rs);
  commands.push({ type: "M", to: rim });
  commands.push(...circleCommands(pts[0], rim, rs, true));
  loops.push({ vertex: 0, kind: "start", center: pts[0], radius: rs });

  /** The chord of the cups on stroke `s` (vertex s to s + 1), from its room. */
  const chordOn = (s: number) => {
    const cupsAtStart = s === 0 ? 2 * word[0].crooks : 0;
    const cupsAtEnd = 2 * word[s + 1].crooks;
    const count = cupsAtStart + cupsAtEnd;
    const room =
      dist(pts[s], pts[s + 1]) - (s === 0 ? rs : 0) - m.minStraight * unit;
    const chord = Math.min(m.cupChord * unit, room / count);
    if (chord < m.cupMinChord * unit) cramped.push(s);
    return Math.max(chord, m.cupMinChord * unit);
  };

  /**
   * A one-vertex word's cups run along +x from the rim, so near the outer
   * ring they narrow to stay inside it.
   */
  const loneChord = () => {
    const count = 2 * word[0].crooks;
    if (!bound) return m.cupChord * unit;
    // How far +x from the rim the bound is: |rim + λx − centre| = radius.
    const w = sub(rim, bound.center);
    const room =
      -w.x +
      Math.sqrt(
        Math.max(0, w.x * w.x - (dot(w, w) - bound.radius * bound.radius)),
      );
    const chord = Math.min(m.cupChord * unit, (room - 0.02 * unit) / count);
    if (chord < m.cupMinChord * unit) cramped.push(0);
    return Math.max(chord, m.cupMinChord * unit);
  };

  let pen = rim;
  if (word[0].crooks > 0) {
    const chord = n > 1 ? chordOn(0) : loneChord();
    const count = 2 * word[0].crooks;
    const side = scale(normal(d0), sideOf(0));
    const wave = cups(rim, d0, side, count, chord, depth);
    const end = along(rim, d0, count * chord);
    commands.push(...wave.commands);
    waves.push({
      vertex: 0,
      stroke: 0,
      from: rim,
      to: end,
      side,
      depth,
      points: wave.points,
    });
    pen = end;
  }

  for (let i = 1; i < n; i++) {
    const p = pts[i];
    const d = direction(pts[i - 1], p);
    const v = word[i];
    if (v.crooks > 0) {
      const chord = chordOn(i - 1);
      const count = 2 * v.crooks;
      const start = along(p, d, -count * chord);
      lines.push({ a: pen, b: start, stroke: i - 1 });
      commands.push({ type: "L", to: start });
      const side = scale(normal(d), sideOf(i));
      const wave = cups(start, d, side, count, chord, depth);
      commands.push(...wave.commands);
      waves.push({
        vertex: i,
        stroke: i - 1,
        from: start,
        to: p,
        side,
        depth,
        points: wave.points,
      });
    } else {
      lines.push({ a: pen, b: p, stroke: i - 1 });
      commands.push({ type: "L", to: p });
    }
    pen = p;
    if (v.marks.includes("noose") && i < n - 1) {
      const r = m.nooseRadius * unit;
      const s = sideOf(i);
      const center = along(p, normal(d), s * r);
      loops.push({ vertex: i, kind: "noose", center, radius: r });
      commands.push(...circleCommands(center, p, r, s > 0));
    }
  }

  const last = pts[n - 1];
  const dl = n > 1 ? direction(pts[n - 2], last) : x;
  const half = (m.barLength * unit) / 2;
  const bar = {
    a: along(last, normal(dl), half),
    b: along(last, normal(dl), -half),
  };
  commands.push({ type: "M", to: bar.a }, { type: "L", to: bar.b });
  return { lines, loops, waves, bar, commands, cramped };
}

/** Where a figure's words sit (the figure grammar's frame). */
export interface SigilFrame {
  /** The centre of the layout's places' bounding box, quantised. */
  center: Point;
  /** The disc about `center` every mark stays within. */
  radius: number;
  /** Each word's square region's side: the disc and 10 units each side. */
  pitch: number;
}

/**
 * The frame of `layout`: a disc about the centre of the anchors' bounding
 * box reaching every place's slack, rounded up to a whole unit, and words
 * `pitch` apart. On the rose: radius 40 and pitch 100, today's viewBox.
 */
export function sigilFrame(layout: SigilGeometry): SigilFrame {
  const unit = layout.unit;
  const anchors = layout.places.map((place) => layout.anchor(place));
  const xs = anchors.map((p) => p.x);
  const ys = anchors.map((p) => p.y);
  const center = {
    x: quantise((Math.min(...xs) + Math.max(...xs)) / 2),
    y: quantise((Math.min(...ys) + Math.max(...ys)) / 2),
  };
  let reach = 0;
  for (const place of layout.places)
    reach = Math.max(
      reach,
      dist(layout.anchor(place), center) + layout.slack(place),
    );
  const radius = Math.ceil(reach / unit - 1e-9) * unit;
  return { center, radius, pitch: 2 * (radius + 10 * unit) };
}

/** Word `index`'s offset: words run right to left (R2, decision 5). */
export function wordOffset(frame: SigilFrame, index: number): Point {
  return { x: -index * frame.pitch, y: 0 };
}

/** The viewBox of `words` words (at least one region), as its four numbers. */
export function sigilViewBox(
  frame: SigilFrame,
  words: number,
): [number, number, number, number] {
  const width = frame.pitch * Math.max(1, words);
  return [
    svgCoordinate(frame.center.x + frame.pitch / 2 - width),
    svgCoordinate(frame.center.y - frame.pitch / 2),
    svgCoordinate(width),
    svgCoordinate(frame.pitch),
  ];
}

const pair = (p: Point) => `${svgCoordinate(p.x)},${svgCoordinate(p.y)}`;

/** Path data for commands, moved by `offset`. */
export function pathData(
  commands: readonly InkCommand[],
  offset: Point,
): string {
  const at = (p: Point) => pair(add(p, offset));
  return commands
    .map((c) => {
      if (c.type === "C") return `C ${at(c.c1)} ${at(c.c2)} ${at(c.to)}`;
      if (c.type === "A") {
        const r = svgCoordinate(c.r);
        return `A ${r},${r} 0 0,${c.sweep ? 1 : 0} ${at(c.to)}`;
      }
      return `${c.type} ${at(c.to)}`;
    })
    .join(" ");
}

/**
 * The path data of placed words on `layout`: every word's ink, word `i`
 * moved into its region, as one path so it can be drawn on.
 */
export function sigilPathData(
  words: readonly PlacedWord[],
  layout: SigilGeometry,
  profile: SigilProfile,
): string {
  const frame = sigilFrame(layout);
  return words
    .map((word, i) =>
      pathData(
        wordInk(word, layout.unit, profile, frame).commands,
        wordOffset(frame, i),
      ),
    )
    .join(" ");
}
