/**
 * Rule placement (plan 088, "Placement: by rule, not by solver"): where
 * each vertex of a plan is drawn, decided by rules and a bounded, ordered,
 * discrete search, never by a continuous optimiser.
 *
 * The rules. A first visit sits on its place's anchor. A revisit sits
 * `revisitOffset` beside its anchor, square to the stroke into it, on the
 * side with more room from the strokes and visits already at the place
 * (F1, F3). A noose vertex sits on the chord between its neighbours, at
 * the foot of the perpendicular from its anchor, kept far enough from
 * either end for its loop, so the line through it stays unbent (R4). A
 * crook's cups and a noose's loop start on the renderer's default side
 * (`defaultSide`: the outside of the turn).
 *
 * The search. The figure is then checked as plan 088's O2 checks it
 * (`wordFailures`), and scored: one per failure plus how far it misses. A
 * round looks at every vertex the failures involve and every move each
 * has, in a fixed order: a crook or noose drawn on its other side; then,
 * for any vertex but a noose's (which follows its neighbours), a step
 * square to the stroke into it either way, back and forward along it and
 * the four diagonals, by each of `steps`, capped by its slack. The move
 * that lowers the score most is made, the earliest on a tie, and the next
 * round begins; a round with no move that gains at least 0.01 ends the
 * search. If failures remain, the search starts again, from up to ten
 * starts in all: revisits on the roomier side, the other side and towards
 * the layout's centre, at `revisitOffset` and at the slack's edge; then,
 * at the edge, either side, with the first letter of a revisited place
 * (or a first letter with crooks) drawn ahead along its first stroke, and
 * then drawn back. A start that repeats an earlier one's positions is
 * skipped, and the best figure of all is kept. Everything stops when
 * `budget` units of checking work are spent.
 *
 * A run of nooses in a row is settled together, onto the chord between
 * the run's outer neighbours, so the line through them stays unbent;
 * placement checks that it does.
 *
 * Checking is incremental: the ink is split into elements (vertices,
 * corners, noose passes, strokes, loops, waves, the bar) whose results are kept by
 * pair, and a move re-checks only the elements whose geometry changed.
 *
 * Inputs are quantised to 0.001, as the SVG is written, and only
 * `+ − × ÷ √` and comparisons are used (`geometry.ts`), so every engine
 * places the same figure.
 */

import {
  along,
  cross,
  crossing,
  direction,
  dist,
  dot,
  halfPlane,
  normal,
  overlapLength,
  quantised,
  type Segment,
  scale,
  segmentDistance,
  signedSegmentDistance,
  sub,
  toSegment,
  trimmed,
} from "./geometry.ts";
import {
  CUP_SAMPLES as CUP_POINTS,
  defaultSide,
  type InkLoop,
  type InkWave,
  marksOf,
  type SigilFrame,
  type SigilGeometry,
  sigilFrame,
  type WordInk,
  wordInk,
} from "./ink.ts";
import type {
  PlacedVertex,
  PlacedWord,
  Point,
  SigilPlacementSettings,
  SigilPlan,
  SigilProfile,
  SigilWord,
} from "./types.ts";

/**
 * Placement's settings unless a profile gives its own: revisits 3 units
 * beside the earlier visit, inside Regardie's 5.6–8 (F1) less the slack
 * either side would leave; moves of 1.5 and 3 units and to the slack's
 * edge less 0.05, which the worst case (ללהאל, three vertices within 0.1
 * of their slack's edge) needs; and a budget of checking work that keeps
 * any word under about 100 ms on a 2026 desktop (the corpus's worst,
 * ללהללהללהל, about 80 ms).
 */
export const DEFAULT_SIGIL_PLACEMENT: SigilPlacementSettings = {
  revisitOffset: 3,
  steps: [1.5, 3, Number.POSITIVE_INFINITY],
  slackMargin: 0.05,
  budget: 300_000,
};

/** The placement settings `profile` places with. */
export function placementOf(profile: SigilProfile): SigilPlacementSettings {
  return { ...DEFAULT_SIGIL_PLACEMENT, ...profile.placement };
}

/**
 * The figure grammar's limits that placement checks, in sigil units
 * (plan 088's O2, whose limits are a stroke width or two at the smallest
 * size a sigil is published), with a margin where O2's own tolerance
 * would leave none.
 */
const LIMITS = {
  /** Centre lines closer than this overlap. */
  overlapDistance: 1,
  /** No overlap longer than this, nor than half the shorter stroke. */
  overlapLength: 8,
  /** A stroke stays this far from another vertex of the name. */
  vertexClearance: 2,
  /** …and this far from a loop it does not belong to. */
  loopClearance: 1,
  /**
   * A stroke may pass another visit to one of its own places (Regardie's
   * יהוה), but no nearer than a stroke width: nearer, the vertex's corner
   * runs into the stroke.
   */
  samePlaceClearance: 1,
  /** No ink but the last stroke this near the bar (the grammar's 1 and a margin). */
  barClearance: 1.05,
  /** No ink but a crook's own this near its cups, on their side. */
  crookClearance: 1.05,
  /** How much of a mark's own stroke is not measured, from where it meets the mark. */
  ownSkip: 1,
  /** The limit for a mark's own stroke, measured from `ownSkip` away: just under it. */
  ownClearance: 0.99,
  /** A noose's vertex lies this close to its neighbours' chord (O2 allows 0.03). */
  unbent: 0.01,
  /** cos 12°: an unmarked corner turns by at least 12° (the grammar's 10 and a margin). */
  cornerCos: 0.9781476007338057,
};

/** Why a placed word fails, and which vertices it involves. */
export interface PlacementFailure {
  check:
    | "slack"
    | "outer"
    | "overlap"
    | "clearance"
    | "corner"
    | "noose"
    | "crook"
    | "bar-clearance"
    | "crook-clearance"
    | "loop-clearance";
  vertices: number[];
  /** How far it misses, in units; 0 for a plain miss. */
  excess: number;
}

/** A piece of a word's figure that checks are made on. */
type Element =
  | { kind: "vertex"; i: number; p: Point }
  | { kind: "corner" | "pass"; i: number; a: Point; b: Point; c: Point }
  | { kind: "line"; seg: Segment; first: number; last: number }
  | { kind: "loop"; loop: InkLoop }
  | { kind: "wave"; wave: InkWave; cramped: boolean }
  | { kind: "bar"; seg: Segment };

/** What the checks need besides the elements. */
interface Context {
  word: SigilWord;
  layout: SigilGeometry;
  frame: SigilFrame;
  anchors: readonly Point[];
  unit: number;
}

/** The vertices a check involves; a noose vertex moves with its neighbours. */
function involve(word: SigilWord, vertices: number[]): number[] {
  const out: number[] = [];
  for (const i of vertices) {
    if (i < 0 || i >= word.length) continue;
    out.push(i);
    if (word[i].marks.includes("noose")) out.push(i - 1, i + 1);
  }
  return out;
}

/** Distance from `p` to the line through `a` and `c`. */
function toLine(p: Point, a: Point, c: Point): number {
  const l = dist(a, c);
  return l === 0 ? dist(p, a) : Math.abs(cross(sub(c, a), sub(p, a))) / l;
}

/** A word's elements, in an order its plan fixes. */
function elements(
  word: SigilWord,
  points: Point[],
  ink: WordInk,
  unit: number,
): Element[] {
  const n = word.length;
  const out: Element[] = points.map((p, i) => ({ kind: "vertex", i, p }));
  for (let i = 1; i < n - 1; i++)
    if (word[i].crooks === 0)
      out.push({
        kind: word[i].marks.includes("noose") ? "pass" : "corner",
        i,
        a: points[i - 1],
        b: points[i],
        c: points[i + 1],
      });
  // Strokes as O2 reads them: pieces through a noose are one line. That
  // holds only while the noose's line is unbent, which its "pass" element
  // checks; the elements stay the same whatever the geometry, as the
  // incremental judgement needs.
  for (const piece of ink.lines) {
    const prev = out[out.length - 1];
    if (
      prev?.kind === "line" &&
      prev.last === piece.stroke &&
      word[piece.stroke].marks.includes("noose")
    ) {
      prev.seg = { a: prev.seg.a, b: piece.b };
      prev.last = piece.stroke + 1;
    } else
      out.push({
        kind: "line",
        seg: { a: piece.a, b: piece.b },
        first: piece.stroke,
        last: piece.stroke + 1,
      });
  }
  for (const loop of ink.loops) out.push({ kind: "loop", loop });
  for (const wave of ink.waves)
    out.push({
      kind: "wave",
      wave,
      cramped: ink.cramped.includes(wave.stroke),
    });
  out.push({ kind: "bar", seg: ink.bar });
  return out;
}

/** An element's geometry as numbers, to see whether a move changed it. */
function signature(e: Element): number[] {
  switch (e.kind) {
    case "vertex":
      return [e.p.x, e.p.y];
    case "corner":
    case "pass":
      return [e.a.x, e.a.y, e.b.x, e.b.y, e.c.x, e.c.y];
    case "line":
    case "bar":
      return [e.seg.a.x, e.seg.a.y, e.seg.b.x, e.seg.b.y];
    case "loop":
      return [e.loop.center.x, e.loop.center.y];
    case "wave":
      return [
        e.wave.from.x,
        e.wave.from.y,
        e.wave.to.x,
        e.wave.to.y,
        e.wave.side.x,
        e.wave.side.y,
        e.cramped ? 1 : 0,
      ];
  }
}

const same = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** The vertices an element is drawn from. */
function verticesOf(e: Element, n: number): number[] {
  switch (e.kind) {
    case "vertex":
      return [e.i];
    case "corner":
    case "pass":
      return [e.i - 1, e.i, e.i + 1];
    case "line": {
      const out: number[] = [];
      for (let i = e.first; i <= e.last; i++) out.push(i);
      return out;
    }
    case "loop":
      return [e.loop.vertex];
    case "wave":
      return [e.wave.stroke, e.wave.stroke + 1];
    case "bar":
      return [n - 2, n - 1];
  }
}

/** Least distance from any of `points` to segment `s`. */
function pointsToSegment(points: readonly Point[], s: Segment): number {
  let d = Number.POSITIVE_INFINITY;
  for (const p of points) d = Math.min(d, toSegment(p, s).d);
  return d;
}

/**
 * How close a segment comes to a wave's cups: the least distance to them,
 * or, where it crosses the wave's line between its ends, minus how far it
 * would have to move along that line to clear them.
 */
function segmentToWave(s: Segment, w: InkWave, unit: number): number {
  const chord = { a: w.from, b: w.to };
  const c = crossing(s, chord);
  if (c) return -Math.min(c.t, 1 - c.t) * dist(w.from, w.to);
  // The cups lie within their depth of their line: farther than that from
  // it, the segment's distance to them is at least the difference.
  const far = segmentDistance(s, chord) - w.depth;
  if (far > FAR * unit) return far;
  return pointsToSegment(w.points, s);
}

/** The bulge side of a wave's line as a linear function: ≥ 0 on its side. */
function sideOf(w: InkWave): (p: Point) => number {
  return (p) => dot(sub(p, w.from), w.side);
}

/**
 * Least distance from any of a wave's cup points to the arc of `loop` on
 * the side its cups bulge to.
 */
function waveToArc(w: InkWave, loop: InkLoop): number {
  const side = sideOf(w);
  const c = loop.center;
  const r = loop.radius;
  // Where the circle meets the wave's line: the ends of the arc.
  const h = side(c);
  const ends: Point[] = [];
  if (Math.abs(h) < r) {
    const foot = along(c, w.side, -h);
    const half = Math.sqrt(r * r - h * h);
    const t = normal(w.side);
    ends.push(along(foot, t, half), along(foot, t, -half));
  }
  let best = Number.POSITIVE_INFINITY;
  for (const p of w.points) {
    const l = dist(p, c);
    const nearest =
      l === 0 ? along(c, w.side, r) : along(c, scale(sub(p, c), 1 / l), r);
    if (side(nearest) >= 0) best = Math.min(best, Math.abs(l - r));
    else for (const e of ends) best = Math.min(best, dist(p, e));
  }
  return best;
}

/** Checks on one element alone. */
function single(e: Element, ctx: Context): PlacementFailure[] {
  const { word, layout, frame, anchors, unit } = ctx;
  const n = word.length;
  const out: PlacementFailure[] = [];
  const outer = (far: number, vertices: number[]) => {
    if (far > frame.radius)
      out.push({
        check: "outer",
        vertices: involve(word, vertices),
        excess: (far - frame.radius) / unit,
      });
  };
  switch (e.kind) {
    case "vertex": {
      const slack = layout.slack(word[e.i].place);
      const off = dist(e.p, anchors[e.i]);
      if (off > slack)
        out.push({
          check: "slack",
          vertices: involve(word, [e.i]),
          excess: (off - slack) / unit,
        });
      break;
    }
    case "pass": {
      // A noose's line is unbent: its vertex on the chord of its
      // neighbours, within the SVG's rounding.
      const off = toLine(e.b, e.a, e.c);
      if (off > LIMITS.unbent * unit)
        out.push({
          check: "noose",
          vertices: verticesOf(e, n),
          excess: off / unit,
        });
      break;
    }
    case "corner": {
      const c = dot(direction(e.a, e.b), direction(e.b, e.c));
      if (c > LIMITS.cornerCos)
        out.push({
          check: "corner",
          vertices: verticesOf(e, n),
          excess: (c - LIMITS.cornerCos) * 100,
        });
      break;
    }
    case "loop":
      outer(dist(e.loop.center, frame.center) + e.loop.radius, [e.loop.vertex]);
      break;
    case "wave": {
      const vs = verticesOf(e, n);
      let far = 0;
      for (const p of e.wave.points) far = Math.max(far, dist(p, frame.center));
      outer(far, vs);
      if (e.cramped)
        out.push({ check: "crook", vertices: involve(word, vs), excess: 1 });
      break;
    }
    case "bar":
      outer(
        Math.max(dist(e.seg.a, frame.center), dist(e.seg.b, frame.center)),
        [n - 1],
      );
      break;
  }
  return out;
}

/** The order pairs are checked in: `pair(a, b)` has `a` first in it. */
const KIND_ORDER = [
  "vertex",
  "corner",
  "pass",
  "line",
  "loop",
  "wave",
  "bar",
] as const;

/** Checks between two elements; `a` comes first in `KIND_ORDER`. */
function pair(a: Element, b: Element, ctx: Context): PlacementFailure[] {
  const { word, unit } = ctx;
  const n = word.length;
  const out: PlacementFailure[] = [];
  const fail = (check: PlacementFailure["check"], limit: number, d: number) => {
    if (d < limit * unit)
      out.push({
        check,
        vertices: involve(word, [...verticesOf(a, n), ...verticesOf(b, n)]),
        excess: (limit * unit - d) / unit,
      });
  };
  const skip = LIMITS.ownSkip * unit;

  if (a.kind === "vertex" && b.kind === "line") {
    // No stroke near another vertex of the name. A stroke may pass another
    // visit to one of its own vertices' places (Regardie's יהוה), but not
    // touch it.
    if (a.i >= b.first && a.i <= b.last) return out;
    const place = word[a.i].place;
    const own = place === word[b.first].place || place === word[b.last].place;
    fail(
      "clearance",
      own ? LIMITS.samePlaceClearance : LIMITS.vertexClearance,
      toSegment(a.p, b.seg).d,
    );
  } else if (a.kind === "line" && b.kind === "line") {
    const overlap = overlapLength(a.seg, b.seg, LIMITS.overlapDistance * unit);
    const limit = Math.min(
      LIMITS.overlapLength * unit,
      0.5 * Math.min(dist(a.seg.a, a.seg.b), dist(b.seg.a, b.seg.b)),
    );
    if (overlap > limit)
      out.push({
        check: "overlap",
        vertices: involve(word, [...verticesOf(a, n), ...verticesOf(b, n)]),
        excess: (overlap - limit) / unit,
      });
  } else if (a.kind === "line" && b.kind === "loop") {
    if (b.loop.vertex >= a.first && b.loop.vertex <= a.last) return out;
    fail(
      "clearance",
      LIMITS.loopClearance,
      toSegment(b.loop.center, a.seg).d - b.loop.radius,
    );
  } else if (a.kind === "line" && b.kind === "wave") {
    // No ink but a crook's own near its cups, on their side. Its own are
    // the stroke it lies on, collinear with it, and the stroke leaving its
    // vertex, measured from a stroke width away.
    const w = b.wave;
    if (w.stroke >= a.first && w.stroke < a.last) return out;
    // Measured from a stroke width along it, the stroke leaving the
    // vertex is exactly that far from the cups' end there, so it is held
    // to O2's own limit rather than placement's margin.
    const fromVertex = dist(a.seg.a, w.to) === 0;
    const own = fromVertex ? trimmed(a.seg, skip, 0) : a.seg;
    const part = own && halfPlane(own, sideOf(w));
    if (part)
      fail(
        "crook-clearance",
        fromVertex ? LIMITS.ownClearance : LIMITS.crookClearance,
        segmentToWave(part, w, unit),
      );
  } else if (a.kind === "line" && b.kind === "bar") {
    // The last stroke meets the bar square at its middle and only there.
    if (a.last === n - 1 && word[n - 1].crooks === 0) return out;
    fail(
      "bar-clearance",
      LIMITS.barClearance,
      signedSegmentDistance(a.seg, b.seg),
    );
  } else if (a.kind === "loop" && b.kind === "loop") {
    // No two loops touching: a noose through the start circle reads as one
    // interlocked mark. Rings that cross count how far they overlap.
    const d = dist(a.loop.center, b.loop.center);
    const ra = a.loop.radius;
    const rb = b.loop.radius;
    const gap =
      d >= ra + rb
        ? d - ra - rb
        : d <= Math.abs(ra - rb)
          ? Math.abs(ra - rb) - d
          : -Math.min(ra + rb - d, d - Math.abs(ra - rb));
    fail("loop-clearance", LIMITS.loopClearance, gap);
  } else if (a.kind === "loop" && b.kind === "wave") {
    // The start circle whose rim the first stroke's crook leaves is its own.
    if (b.wave.vertex === 0 && a.loop.kind === "start") return out;
    fail("crook-clearance", LIMITS.crookClearance, waveToArc(b.wave, a.loop));
  } else if (a.kind === "loop" && b.kind === "bar") {
    // A lone word's bar runs through its own start circle.
    if (n === 1) return out;
    fail(
      "bar-clearance",
      LIMITS.barClearance,
      toSegment(a.loop.center, b.seg).d - a.loop.radius,
    );
  } else if (a.kind === "wave" && b.kind === "wave") {
    for (const [w, o] of [
      [a.wave, b.wave],
      [b.wave, a.wave],
    ]) {
      const side = sideOf(w);
      let d = segmentToWave({ a: o.from, b: o.to }, w, unit);
      if (d > 0 && d - o.depth <= FAR * unit)
        for (const q of o.points)
          if (side(q) >= 0)
            for (const p of w.points) d = Math.min(d, dist(p, q));
      fail("crook-clearance", LIMITS.crookClearance, d);
    }
  } else if (a.kind === "wave" && b.kind === "bar") {
    // A crook at the last vertex ends where the bar crosses: its own.
    if (a.wave.vertex === n - 1) return out;
    fail(
      "bar-clearance",
      LIMITS.barClearance,
      segmentToWave(b.seg, a.wave, unit),
    );
    const part = halfPlane(b.seg, sideOf(a.wave));
    if (part)
      fail(
        "crook-clearance",
        LIMITS.crookClearance,
        segmentToWave(part, a.wave, unit),
      );
  }
  return out;
}

/**
 * Beyond this many units, a lower bound on a distance is as good as the
 * distance: no limit placement checks comes near it.
 */
const FAR = 3;

/** Less gain than this in the score is not worth a move. */
const MIN_GAIN = 0.01;

/**
 * What checking an element against another costs, in units of checking
 * work: a wave's cups are checked point by point, so it weighs one a cup.
 */
function weight(e: Element): number {
  return e.kind === "wave" ? Math.max(1, e.wave.points.length / CUP_POINTS) : 1;
}

/** A failure list's score: one per failure and how far each misses. */
function score(fs?: readonly PlacementFailure[]): number {
  let total = 0;
  if (fs) for (const f of fs) total += 1 + f.excess;
  return total;
}

/**
 * Every check on a word's elements, single and pairwise, with the results
 * kept so that a move re-checks only the elements it changed.
 */
class Judgement {
  private elements: Element[];
  private readonly singles: PlacementFailure[][];
  /** `pairs[i × size + j]` for i < j; undefined where the pair passes. */
  private readonly pairs: (PlacementFailure[] | undefined)[];
  private readonly signatures: number[][];
  private readonly weights = { total: 0 };
  score: number;
  /** Units of checking work done: an element looked at, or a pair checked. */
  work: number;

  constructor(
    elements: Element[],
    private readonly ctx: Context,
    work = 0,
  ) {
    const size = elements.length;
    this.elements = elements;
    this.signatures = elements.map(signature);
    this.singles = elements.map((e) => single(e, ctx));
    this.pairs = new Array(size * size);
    for (let i = 0; i < size; i++)
      for (let j = i + 1; j < size; j++)
        this.pairs[i * size + j] = this.check(elements, i, j);
    this.weights.total = elements.reduce((t, e) => t + weight(e), 0);
    this.work = work + this.weights.total * this.weights.total;
    this.score = this.total();
  }

  private check(elements: Element[], i: number, j: number) {
    const a = elements[i];
    const b = elements[j];
    const failures =
      KIND_ORDER.indexOf(a.kind) <= KIND_ORDER.indexOf(b.kind)
        ? pair(a, b, this.ctx)
        : pair(b, a, this.ctx);
    return failures.length ? failures : undefined;
  }

  private total(): number {
    let total = 0;
    for (const fs of this.singles) total += score(fs);
    for (const fs of this.pairs) total += score(fs);
    return total;
  }

  /** Every failure now. */
  failures(): PlacementFailure[] {
    const out: PlacementFailure[] = [];
    for (const fs of this.singles) out.push(...fs);
    for (const fs of this.pairs) if (fs) out.push(...fs);
    return out;
  }

  /**
   * The score `elements` (this word's, moved) would have, and a way to
   * adopt them, re-checking only the elements that changed.
   */
  propose(elements: Element[]): { score: number; adopt: () => void } {
    const size = elements.length;
    const signatures = elements.map(signature);
    const changed: number[] = [];
    for (let i = 0; i < size; i++)
      if (!same(signatures[i], this.signatures[i])) changed.push(i);
    const isChanged = new Set(changed);
    const singles = new Map<number, PlacementFailure[]>();
    const pairs = new Map<number, PlacementFailure[] | undefined>();
    let delta = 0;
    for (const i of changed) {
      const s = single(elements[i], this.ctx);
      singles.set(i, s);
      delta += score(s) - score(this.singles[i]);
      for (let j = 0; j < size; j++) {
        if (j === i || (isChanged.has(j) && j < i)) continue;
        const key = i < j ? i * size + j : j * size + i;
        const fs =
          i < j ? this.check(elements, i, j) : this.check(elements, j, i);
        pairs.set(key, fs);
        delta += score(fs) - score(this.pairs[key]);
      }
    }
    for (const i of changed)
      this.work += this.weights.total * weight(elements[i]);
    return {
      score: this.score + delta,
      adopt: () => {
        this.elements = elements;
        for (const i of changed) {
          this.signatures[i] = signatures[i];
          this.singles[i] = singles.get(i) ?? [];
        }
        for (const [key, fs] of pairs) this.pairs[key] = fs;
        // Summed afresh, so rounding in the deltas never accumulates.
        this.score = this.total();
      },
    };
  }
}

/**
 * What a placed word fails of placement's checks (plan 088's O2: overlap,
 * clearance of vertices, loops, the bar and crooks, visible corners,
 * unbent nooses, room for crooks, the outer ring and each place's slack),
 * drawn on `layout` under `profile`. Empty when every mark stands clear;
 * `placeSigilWords` gives the same for the words it places.
 */
export function wordFailures(
  word: PlacedWord,
  layout: SigilGeometry,
  profile: SigilProfile,
): PlacementFailure[] {
  const frame = sigilFrame(layout);
  const ink = wordInk(word, layout.unit, profile, frame);
  const ctx: Context = {
    word,
    layout,
    frame,
    anchors: word.map((v) => quantised(layout.anchor(v.place))),
    unit: layout.unit,
  };
  return new Judgement(
    elements(
      word,
      word.map((v) => v.point),
      ink,
      layout.unit,
    ),
    ctx,
  ).failures();
}

/** `point` moved by up to `step` along `d`, kept within `limit` of `anchor`. */
function capped(
  point: Point,
  d: Point,
  step: number,
  anchor: Point,
  limit: number,
  least: number,
): Point | null {
  // The largest λ ≤ step with |point + λd − anchor| ≤ limit.
  const w = sub(point, anchor);
  const b = dot(w, d);
  const c = dot(w, w) - limit * limit;
  const disc = b * b - c;
  if (disc < 0) return null;
  const lambda = Math.min(step, -b + Math.sqrt(disc));
  if (lambda < least) return null;
  return quantised(along(point, d, lambda));
}

/**
 * Noose vertices in a row: each its anchor's foot on the chord from `p`
 * to `n` (the run's outer neighbours), in order, at least `keep` from
 * either end and `gap` from each other (less, evenly, if the chord is too
 * short), so every loop and a stroke width of line stand between them.
 */
function nooseFeet(
  anchors: readonly Point[],
  p: Point,
  n: Point,
  keep: number,
  gap: number,
): Point[] {
  const d = direction(p, n);
  const l = dist(p, n);
  const count = anchors.length;
  // Shrink the spacing evenly when the chord cannot hold it all.
  const room = 2 * keep + (count - 1) * gap;
  const shrink = room > l ? l / room : 1;
  const k = keep * shrink;
  const g = gap * shrink;
  const t = anchors.map((a) => dot(sub(a, p), d));
  for (let i = 0; i < count; i++)
    t[i] = Math.max(t[i], i === 0 ? k : t[i - 1] + g);
  for (let i = count - 1; i >= 0; i--)
    t[i] = Math.min(t[i], i === count - 1 ? l - k : t[i + 1] - g);
  return t.map((ti) => quantised(along(p, d, ti)));
}

/**
 * The side, ±1, of `normal(d)` at which a point `reach` from `at` lies
 * farther from `others`; + on a tie.
 */
function roomier(
  at: Point,
  d: Point,
  reach: number,
  others: readonly Segment[],
): 1 | -1 {
  const room = (s: number) => {
    const probe = along(at, normal(d), s * reach);
    let min = Number.POSITIVE_INFINITY;
    for (const o of others) min = Math.min(min, toSegment(probe, o).d);
    return min;
  };
  return room(-1) > room(1) ? -1 : 1;
}

/**
 * Where a start puts revisits: beside the earlier visit on the side with
 * more room, on the other side, or towards the layout's centre.
 */
type RevisitWay = "beside" | "other" | "inward";

/** One word's vertices at their rule positions, nooses still on their anchors. */
function rulePositions(
  word: SigilWord,
  anchors: readonly Point[],
  offset: number,
  way: RevisitWay,
  center: Point,
  lead: number,
): Point[] {
  const points: Point[] = [];
  const revisited = new Set(
    word.filter((v) => v.visit > 0).map((v) => v.place),
  );
  word.forEach((v, i) => {
    if (v.visit === 0 || i === 0) {
      // A place visited again may first be drawn ahead, towards where the
      // line goes next, leaving room beside it for the returns; so may a
      // first letter with crooks, whose cups then start further along.
      const next = word[i + 1] ? anchors[i + 1] : anchors[i];
      const ahead = revisited.has(v.place) || (i === 0 && v.crooks > 0);
      points.push(
        lead !== 0 && ahead && word[i + 1]
          ? quantised(along(anchors[i], direction(anchors[i], next), lead))
          : anchors[i],
      );
      return;
    }
    // Beside the earlier visits, on the side away from the visits and the
    // strokes already drawn at the place (F1, F3).
    const d = direction(points[i - 1], anchors[i]);
    const here: Segment[] = [];
    for (let j = 0; j < i; j++)
      if (word[j].place === v.place) {
        here.push({ a: points[j], b: points[j] });
        if (j > 0) here.push({ a: points[j - 1], b: points[j] });
        if (j + 1 < i) here.push({ a: points[j], b: points[j + 1] });
      }
    const inward = direction(anchors[i], center, normal(d));
    const towards =
      way === "inward"
        ? inward
        : scale(
            normal(d),
            roomier(anchors[i], d, offset, here) * (way === "other" ? -1 : 1),
          );
    points.push(quantised(along(anchors[i], towards, offset)));
  });
  return points;
}

/** A word placed, with what its figure still fails of placement's checks. */
export interface PlacedSigilWord {
  word: PlacedWord;
  /** Empty when every mark stands clear; otherwise the figure is drawn best effort. */
  failures: readonly PlacementFailure[];
  /** The checking work it took. */
  work: number;
}

/** Placed words kept for reuse, by layout, profile, budget and plan word. */
const placedCache = new WeakMap<
  SigilGeometry,
  WeakMap<SigilProfile, Map<string, PlacedSigilWord>>
>();
/** Placed words kept per layout and profile, oldest dropped first. */
const CACHE_SIZE = 256;
/**
 * The least share of `budget` a word is given, however much its text's
 * earlier words spent: an eighth, some three times what ללהאל, the
 * hardest of the 72 names, needs.
 */
const BUDGET_FLOOR = 1 / 8;

/**
 * A placed word frozen, so the cache can hand the same one to every
 * caller. Each vertex's marks are copied first: they are the caller's
 * plan's own arrays, which placement must not freeze.
 */
function frozen(placed: PlacedSigilWord): PlacedSigilWord {
  for (const v of placed.word) {
    (v as { marks: PlacedVertex["marks"] }).marks = Object.freeze([...v.marks]);
    Object.freeze(v.point);
    Object.freeze(v);
  }
  for (const f of placed.failures) {
    Object.freeze(f.vertices);
    Object.freeze(f);
  }
  Object.freeze(placed.word);
  Object.freeze(placed.failures);
  return Object.freeze(placed);
}

/**
 * A text's words placed (`placeSigil`), each with what its figure still
 * fails.
 *
 * Budget: a text's words share twice one word's `budget`, in order. Each
 * new word is given what is left, up to the whole budget and never less
 * than an eighth of it, and what it spends is taken off; a word met again
 * in the same text costs nothing. So several hard words cost at most two
 * hard words' time and an eighth for each beyond, and what a word is
 * given depends on the words before it alone.
 *
 * Cache: a word's placement depends only on its plan word, its budget,
 * the layout and the profile, so placed words are kept by all four (up to
 * `CACHE_SIZE` per layout and profile) and handed out frozen; a word met
 * again, in the same text or the next keystroke's, is not placed again.
 * The cache keys on the layout's and profile's identity, so it assumes
 * neither object changes behind it. A text always draws the same figure,
 * whatever the cache holds.
 */
export function placeSigilWords(
  plan: SigilPlan,
  layout: SigilGeometry,
  profile: SigilProfile,
): PlacedSigilWord[] {
  const settings = placementOf(profile);
  let byProfile = placedCache.get(layout);
  if (!byProfile) placedCache.set(layout, (byProfile = new WeakMap()));
  let cache = byProfile.get(profile);
  if (!cache) byProfile.set(profile, (cache = new Map()));
  let left = 2 * settings.budget;
  const floor = BUDGET_FLOOR * settings.budget;
  const here = new Map<string, PlacedSigilWord>();
  return plan.map((word) => {
    const key = JSON.stringify(word);
    const again = here.get(key);
    if (again) return again;
    const budget = Math.max(floor, Math.min(settings.budget, left));
    const cacheKey = `${budget} ${key}`;
    let result = cache.get(cacheKey);
    if (!result) {
      result = frozen(placeWord(word, layout, profile, budget));
      cache.set(cacheKey, result);
      if (cache.size > CACHE_SIZE)
        cache.delete(cache.keys().next().value as string);
    }
    left = Math.max(0, left - result.work);
    here.set(key, result);
    return result;
  });
}

/**
 * The plan placed on `layout`: every vertex given the point it is drawn
 * at, quantised to 0.001, and every crook and noose the side it is drawn
 * on, by the rules and search in this module's comment. Deterministic,
 * and the same in every engine. `placeSigilWords` says, too, which words
 * could not be placed with every mark clear.
 */
export function placeSigil(
  plan: SigilPlan,
  layout: SigilGeometry,
  profile: SigilProfile,
): PlacedWord[] {
  return placeSigilWords(plan, layout, profile).map((p) => p.word);
}

/** One word placed with up to `budget` units of checking work. */
function placeWord(
  word: SigilWord,
  layout: SigilGeometry,
  profile: SigilProfile,
  budget: number,
): PlacedSigilWord {
  const settings = placementOf(profile);
  const marks = marksOf(profile);
  const frame = sigilFrame(layout);
  const unit = layout.unit;
  const keep = (marks.minStraight + marks.nooseRadius) * unit;
  // Between two nooses in a row: both loops and a stroke width of line.
  const gap = (2 * marks.nooseRadius + marks.minStraight) * unit;
  const least = 0.05 * unit;
  const n = word.length;
  const anchors = word.map((v) => quantised(layout.anchor(v.place)));
  const ctx: Context = { word, layout, frame, anchors, unit };
  const noose = word.map((v) => v.marks.includes("noose"));
  const settle = (pts: Point[]) => {
    // A run of nooses in a row lies on one chord, between the run's outer
    // neighbours, so the line through all of them stays unbent.
    for (let i = 1; i < n - 1; i++) {
      if (!noose[i]) continue;
      let j = i;
      while (j + 1 < n - 1 && noose[j + 1]) j++;
      const feet = nooseFeet(
        anchors.slice(i, j + 1),
        pts[i - 1],
        pts[j + 1],
        keep,
        gap,
      );
      for (let k = i; k <= j; k++) pts[k] = feet[k - i];
      i = j;
    }
  };
  type Sides = (1 | -1 | undefined)[];
  const placed = (pts: Point[], sds: Sides): PlacedVertex[] =>
    word.map((v, i) => {
      const side = sds[i];
      return side ? { ...v, point: pts[i], side } : { ...v, point: pts[i] };
    });
  const build = (pts: Point[], sds: Sides) =>
    elements(word, pts, wordInk(placed(pts, sds), unit, profile, frame), unit);
  let work = 0;
  const spent = () => work >= budget;

  /** The search from one start; its figure and what is left failing. */
  const search = (points: Point[]) => {
    settle(points);
    const sides: Sides = word.map((v, i) =>
      v.crooks > 0 || noose[i] ? defaultSide(points, i, frame) : undefined,
    );
    const judgement = new Judgement(build(points, sides), ctx, work);
    while (judgement.score > 0 && judgement.work < budget) {
      const involved = [
        ...new Set(judgement.failures().flatMap((f) => f.vertices)),
      ].sort((a, b) => a - b);
      // Every move of every vertex involved is judged; the best is taken,
      // the earliest on a tie, if it gains enough to be worth a round.
      const round: {
        best?: {
          score: number;
          adopt: () => void;
          pts: Point[];
          sds: Sides;
        };
      } = {};
      const consider = (pts: Point[], sds: Sides) => {
        const proposal = judgement.propose(build(pts, sds));
        if (
          proposal.score < judgement.score - MIN_GAIN &&
          (!round.best || proposal.score < round.best.score)
        )
          round.best = { ...proposal, pts, sds };
      };
      for (const i of involved) {
        if (judgement.work >= budget) break;
        const side = sides[i];
        if (side) {
          const flipped = [...sides];
          flipped[i] = side > 0 ? -1 : 1;
          consider(points, flipped);
        }
        if (noose[i]) continue;
        const t =
          i > 0
            ? direction(points[i - 1], points[i])
            : direction(
                points[0],
                points[1] ?? along(points[0], { x: 1, y: 0 }, 1),
              );
        const nn = normal(t);
        const diagonal = (a: Point, b: Point) =>
          scale({ x: a.x + b.x, y: a.y + b.y }, Math.SQRT1_2);
        const back = scale(t, -1);
        const directions = [
          nn,
          scale(nn, -1),
          back,
          t,
          diagonal(nn, back),
          diagonal(scale(nn, -1), back),
          diagonal(nn, t),
          diagonal(scale(nn, -1), t),
        ];
        const limit = layout.slack(word[i].place) - settings.slackMargin * unit;
        for (const step of settings.steps)
          for (const d of directions) {
            const moved = capped(
              points[i],
              d,
              step * unit,
              anchors[i],
              limit,
              least,
            );
            if (!moved) continue;
            const candidate = [...points];
            candidate[i] = moved;
            settle(candidate);
            consider(candidate, sides);
          }
      }
      const chosen = round.best;
      if (!chosen) break;
      chosen.adopt();
      points.splice(0, n, ...chosen.pts);
      sides.splice(0, n, ...chosen.sds);
    }
    work = judgement.work;
    return {
      points,
      sides,
      score: judgement.score,
      failures: judgement.failures(),
    };
  };

  // Revisits beside their places by `revisitOffset`, on the roomier side,
  // the other side and towards the centre; the same at the slack's edge;
  // and then at the edge with each revisited place's first visit drawn
  // ahead by the revisit offset. The first start whose figure passes is
  // kept, else the one that fails least; a start that puts every vertex
  // where an earlier one did is skipped.
  const edge =
    Math.min(...word.map((v) => layout.slack(v.place))) -
    settings.slackMargin * unit;
  const offset = settings.revisitOffset * unit;
  const starts: [number, RevisitWay, number][] = [
    [offset, "beside", 0],
    [offset, "other", 0],
    [offset, "inward", 0],
    [edge, "beside", 0],
    [edge, "other", 0],
    [edge, "inward", 0],
    [edge, "beside", offset],
    [edge, "other", offset],
    [edge, "beside", -offset],
    [edge, "other", -offset],
  ];
  const tried = new Set<string>();
  let best: ReturnType<typeof search> | undefined;
  for (const [by, way, lead] of starts) {
    if (best && (best.score === 0 || spent())) break;
    const points = rulePositions(word, anchors, by, way, frame.center, lead);
    const key = JSON.stringify(points);
    if (tried.has(key)) continue;
    tried.add(key);
    const result = search(points);
    if (!best || result.score < best.score) best = result;
  }
  const chosen = best as ReturnType<typeof search>;
  return {
    word: placed(chosen.points, chosen.sides),
    failures: chosen.failures,
    work,
  };
}
