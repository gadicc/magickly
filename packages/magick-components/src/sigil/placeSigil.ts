/**
 * Rule placement (plan 088, "Placement: by rule, not by solver"): where
 * each vertex of a plan is drawn, decided by rules and a small, ordered,
 * discrete search, never by a continuous optimiser.
 *
 * The rules. A first visit sits on its place's anchor. A revisit sits
 * `revisitOffset` beside its anchor, square to the stroke into it, on the
 * side with more room from the strokes and visits already at the place
 * (F1, F3). A noose vertex sits on the chord between its neighbours, at
 * the foot of the perpendicular from its anchor, so the line through it
 * stays unbent (R4).
 *
 * The search. The figure is then checked as the oracle's O2 checks it
 * (`wordFailures`): strokes overlapping, a stroke grazing another vertex
 * or loop, an unmarked corner too shallow to see, a crook without room,
 * ink outside the outer ring, a vertex outside its slack. While a check
 * fails, each vertex the failures involve, in path order, tries a fixed
 * list of moves from where it is: square to the stroke into it either
 * way, then back and forward along it, then the four diagonals, by each
 * of `steps`, capped by its slack. The first move that lowers the
 * failures' score (each failure counts one, plus how far it misses) is
 * kept, and the round starts again. It stops when nothing fails, when no
 * move helps, or when the budget of moves tried runs out. Noose vertices
 * never move themselves: they follow their neighbours' chord.
 *
 * Inputs are quantised to 0.001, as the SVG is written, and only
 * `+ − × ÷ √` and comparisons are used (`geometry.ts`), so every engine
 * places the same figure.
 */

import {
  along,
  cross,
  direction,
  dist,
  dot,
  normal,
  overlapLength,
  quantised,
  type Segment,
  scale,
  sub,
  toSegment,
} from "./geometry.ts";
import {
  type SigilFrame,
  type SigilGeometry,
  sigilFrame,
  type WordInk,
  wordInk,
} from "./ink.ts";
import type {
  PlacedVertex,
  PlacedWord,
  PlaceId,
  Point,
  SigilPlacementSettings,
  SigilPlan,
  SigilProfile,
  SigilWord,
} from "./types.ts";

/**
 * Placement's settings unless a profile gives its own. Revisits sit 3
 * units beside the earlier visit, inside Regardie's 5.6–8 (F1) less the
 * slack either side would leave; moves are 1.5 and 3 units and the
 * slack's edge, less 0.05, which the worst case (ללהאל, three vertices
 * within 0.1 of their slack's edge) needs.
 */
export const DEFAULT_SIGIL_PLACEMENT: SigilPlacementSettings = {
  revisitOffset: 3,
  steps: [1.5, 3, Number.POSITIVE_INFINITY],
  slackMargin: 0.05,
  budget: 1000,
};

/** The placement settings `profile` places with. */
export function placementOf(profile: SigilProfile): SigilPlacementSettings {
  return { ...DEFAULT_SIGIL_PLACEMENT, ...profile.placement };
}

/**
 * The figure grammar's limits that placement checks, in sigil units
 * (plan 088's O2; the oracle's `FIGURE_GRAMMAR`), with a little margin
 * where the oracle's own tolerance would leave none.
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
  /** A stroke into a revisit may pass the place's earlier visit, but not touch it. */
  samePlaceClearance: 1,
  /** cos 12°: an unmarked corner turns by at least 12° (the grammar's 10 and a margin). */
  cornerCos: 0.9781476007338057,
};

/** Why a placed word fails, and which vertices it involves. */
export interface PlacementFailure {
  check: "slack" | "outer" | "overlap" | "clearance" | "corner" | "crook";
  vertices: number[];
  /** How far it misses, in units; 0 for a plain miss. */
  excess: number;
}

/** The place among `places` nearest `p` within its slack, as the oracle reads one. */
function placeNear(
  p: Point,
  places: readonly PlaceId[],
  layout: SigilGeometry,
): PlaceId | null {
  let best: PlaceId | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const place of places) {
    const d = dist(p, quantised(layout.anchor(place)));
    if (d <= layout.slack(place) && d < bestD) {
      best = place;
      bestD = d;
    }
  }
  return best;
}

/**
 * The checks of plan 088's O2 that placement can fail, on one placed word
 * and its ink. Empty when the figure passes.
 */
export function wordFailures(
  word: PlacedWord,
  ink: WordInk,
  layout: SigilGeometry,
  frame: SigilFrame,
): PlacementFailure[] {
  const unit = layout.unit;
  const failures: PlacementFailure[] = [];
  const pts = word.map((v) => v.point);
  const n = word.length;
  const places = [...new Set(word.map((v) => v.place))];

  // Every vertex within its place's slack.
  word.forEach((v, i) => {
    const off = dist(v.point, quantised(layout.anchor(v.place)));
    if (off > layout.slack(v.place))
      failures.push({
        check: "slack",
        vertices: [i],
        excess: (off - layout.slack(v.place)) / unit,
      });
  });

  // Every mark inside the outer ring.
  const outside = (p: Point, reach: number, vertex: number) => {
    const r = dist(p, frame.center) + reach;
    if (r > frame.radius)
      failures.push({
        check: "outer",
        vertices: [vertex],
        excess: (r - frame.radius) / unit,
      });
  };
  for (const loop of ink.loops) outside(loop.center, loop.radius, loop.vertex);
  for (const wave of ink.waves)
    for (const p of [wave.from, wave.to]) {
      outside(p, 0, wave.vertex);
      outside(along(p, wave.side, wave.depth), 0, wave.vertex);
    }
  outside(ink.bar.a, 0, n - 1);
  outside(ink.bar.b, 0, n - 1);

  // Crooks with room on their stroke.
  for (const s of ink.cramped)
    failures.push({ check: "crook", vertices: [s, s + 1], excess: 1 });

  // Unmarked corners that a reader can see.
  for (let i = 1; i < n - 1; i++) {
    const v = word[i];
    if (v.crooks > 0 || v.marks.includes("noose")) continue;
    const c = dot(direction(pts[i - 1], pts[i]), direction(pts[i], pts[i + 1]));
    if (c > LIMITS.cornerCos)
      failures.push({
        check: "corner",
        vertices: [i - 1, i, i + 1],
        excess: (c - LIMITS.cornerCos) * 100,
      });
  }

  // Strokes as the oracle reads them: pieces that continue each other in a
  // line (through a noose) are one, and involve every vertex along it.
  const lines: { a: Point; b: Point; first: number; last: number }[] = [];
  for (const piece of ink.lines) {
    const prev = lines[lines.length - 1];
    if (
      prev &&
      dist(prev.b, piece.a) === 0 &&
      Math.abs(cross(direction(prev.a, prev.b), direction(piece.a, piece.b))) <
        1e-3 &&
      dot(direction(prev.a, prev.b), direction(piece.a, piece.b)) > 0
    ) {
      prev.b = piece.b;
      prev.last = piece.stroke + 1;
    } else
      lines.push({
        a: piece.a,
        b: piece.b,
        first: piece.stroke,
        last: piece.stroke + 1,
      });
  }
  const span = (s: { first: number; last: number }) =>
    Array.from({ length: s.last - s.first + 1 }, (_, k) => s.first + k);
  const length = (s: Segment) => dist(s.a, s.b);
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      const overlap = overlapLength(a, b, LIMITS.overlapDistance * unit);
      const limit = Math.min(
        LIMITS.overlapLength * unit,
        0.5 * Math.min(length(a), length(b)),
      );
      if (overlap > limit)
        failures.push({
          check: "overlap",
          vertices: [...span(a), ...span(b)],
          excess: (overlap - limit) / unit,
        });
    }

  // No stroke near another vertex of the name, nor touching another loop.
  for (const s of lines) {
    const ends = span(s);
    const own = new Set(
      [s.a, s.b]
        .map((p) => placeNear(p, places, layout))
        .filter((p) => p !== null),
    );
    word.forEach((v, i) => {
      if (ends.includes(i)) return;
      const d = toSegment(v.point, s).d;
      // A stroke may pass another visit to a place its own ink ends at, as
      // the oracle reads the ends (a start circle's rim can lie outside
      // its place's slack, and then the stroke owns no place there).
      const min = own.has(v.place)
        ? LIMITS.samePlaceClearance
        : LIMITS.vertexClearance;
      if (d < min * unit)
        failures.push({
          check: "clearance",
          vertices: [...ends, i],
          excess: (min * unit - d) / unit,
        });
    });
    for (const loop of ink.loops) {
      if (ends.includes(loop.vertex)) continue;
      const d = toSegment(loop.center, s).d - loop.radius;
      if (d < LIMITS.loopClearance * unit)
        failures.push({
          check: "clearance",
          vertices: [...ends, loop.vertex],
          excess: (LIMITS.loopClearance * unit - d) / unit,
        });
    }
  }
  return failures;
}

/** A failure list's score: one per failure and how far each misses. */
function score(failures: readonly PlacementFailure[]): number {
  let total = 0;
  for (const f of failures) total += 1 + f.excess;
  return total;
}

/** `point` moved by up to `step` along `d`, kept within `limit` of `anchor`. */
function capped(
  point: Point,
  d: Point,
  step: number,
  anchor: Point,
  limit: number,
): Point | null {
  // The largest λ ≤ step with |point + λd − anchor| ≤ limit.
  const w = sub(point, anchor);
  const b = dot(w, d);
  const c = dot(w, w) - limit * limit;
  const disc = b * b - c;
  if (disc < 0) return null;
  const lambda = Math.min(step, -b + Math.sqrt(disc));
  if (lambda < 0.05) return null;
  return quantised(along(point, d, lambda));
}

/** The noose vertex at `i`: its anchor's foot on its neighbours' chord. */
function nooseFoot(anchor: Point, p: Point, n: Point): Point {
  const d = direction(p, n);
  return quantised(along(p, d, dot(sub(anchor, p), d)));
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

/** One word's vertices at their rule positions, nooses still on their anchors. */
function rulePositions(
  word: SigilWord,
  anchors: readonly Point[],
  unit: number,
  settings: SigilPlacementSettings,
): Point[] {
  const points: Point[] = [];
  word.forEach((v, i) => {
    if (v.visit === 0 || i === 0) {
      points.push(anchors[i]);
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
    const offset = settings.revisitOffset * unit;
    const side = roomier(anchors[i], d, offset, here);
    points.push(quantised(along(anchors[i], normal(d), side * offset)));
  });
  return points;
}

/** Nooses onto their neighbours' chords. */
function settleNooses(word: SigilWord, anchors: Point[], points: Point[]) {
  for (let i = 1; i < word.length - 1; i++)
    if (word[i].marks.includes("noose"))
      points[i] = nooseFoot(anchors[i], points[i - 1], points[i + 1]);
}

/**
 * The plan placed on `layout`: every vertex given the point it is drawn
 * at, quantised to 0.001, by the rules and search in this module's
 * comment. Deterministic, and the same in every engine.
 */
export function placeSigil(
  plan: SigilPlan,
  layout: SigilGeometry,
  profile: SigilProfile,
): PlacedWord[] {
  const settings = placementOf(profile);
  const frame = sigilFrame(layout);
  const unit = layout.unit;
  return plan.map((word) => {
    const anchors = word.map((v) => quantised(layout.anchor(v.place)));
    const points = rulePositions(word, anchors, unit, settings);
    settleNooses(word, anchors, points);
    const placed = (pts: Point[]): PlacedVertex[] =>
      word.map((v, i) => ({ ...v, point: pts[i] }));
    const judge = (pts: Point[]) => {
      const w = placed(pts);
      return wordFailures(w, wordInk(w, unit, profile, frame), layout, frame);
    };

    let failures = judge(points);
    let current = score(failures);
    let tried = 0;
    while (failures.length > 0 && tried < settings.budget) {
      const involved = [...new Set(failures.flatMap((f) => f.vertices))]
        .filter((i) => i < word.length && !word[i].marks.includes("noose"))
        .sort((a, b) => a - b);
      let improved = false;
      search: for (const i of involved) {
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
            if (tried >= settings.budget) break search;
            const moved = capped(points[i], d, step * unit, anchors[i], limit);
            if (!moved) continue;
            tried++;
            const candidate = [...points];
            candidate[i] = moved;
            settleNooses(word, anchors, candidate);
            const f = judge(candidate);
            const s = score(f);
            if (s < current) {
              points.splice(0, points.length, ...candidate);
              failures = f;
              current = s;
              improved = true;
              break search;
            }
          }
      }
      if (!improved) break;
    }
    return placed(points);
  });
}
