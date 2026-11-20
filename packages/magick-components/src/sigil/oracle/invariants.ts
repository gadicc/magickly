/**
 * O2, invariants (plan 088): a drawn figure against its plan and layout,
 * with thresholds fixed by the figure grammar (`FIGURE_GRAMMAR`), never
 * tuned to an engine's output. Every check reads ink, as O3 does, so it
 * judges whatever engine drew the figure. `checkStability` adds the 1-ulp
 * check: the same drawing when every anchor moves by one ulp.
 */

import type { PlaceId, Point, SigilLayout, SigilPlan } from "../types.ts";
import type { UnroundedAnchor } from "./anchors.ts";
import {
  figureWords,
  fmt,
  FIGURE_GRAMMAR as G,
  type SigilFrame,
  type SigilGeometry,
  sigilFrame,
} from "./figure.ts";
import {
  angleBetween,
  barCandidates,
  barIntrusion,
  dist,
  dot,
  inkEnds,
  inkShapes,
  type LoopShape,
  length,
  loopContacts,
  nooseContacts,
  norm,
  rimEnds,
  type Segment,
  SHAPE_TOLERANCE,
  sub,
  toLine,
  toSegment,
  waveIntrusions,
} from "./figureShapes.ts";
import { readWordShapes } from "./readBack.ts";

/** Which invariant a failure breaks. */
export type InvariantCheck =
  | "figure"
  | "words"
  | "outer-ring"
  | "shape"
  | "start-circle"
  | "bar"
  | "noose"
  | "crook"
  | "slack"
  | "overlap"
  | "clearance"
  | "bar-clearance"
  | "crook-clearance"
  | "loop-clearance"
  | "domain";

/** One broken invariant. */
export interface InvariantFailure {
  check: InvariantCheck;
  /** The word (reading order), or null for the figure as a whole. */
  word: number | null;
  place?: PlaceId;
  message: string;
}

/** Slack on every size check, in units: well above the SVG's 0.001 rounding. */
const SIZE_TOLERANCE = 0.05;

const inRange = (
  value: number,
  [lo, hi]: readonly [number, number],
  unit: number,
) =>
  value >= (lo - SIZE_TOLERANCE) * unit &&
  value <= (hi + SIZE_TOLERANCE) * unit;

function placeNear(
  point: Point,
  places: readonly PlaceId[],
  layout: SigilGeometry,
): PlaceId | null {
  let best: PlaceId | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const place of places) {
    const d = dist(point, layout.anchor(place));
    if (d <= layout.slack(place) + SIZE_TOLERANCE * layout.unit && d < bestD) {
      best = place;
      bestD = d;
    }
  }
  return best;
}

function overlapLength(a: Segment, b: Segment, within: number): number {
  const l = length(a);
  const steps = Math.max(1, Math.ceil(l / 0.02));
  let inside = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = {
      x: a.a.x + t * (a.b.x - a.a.x),
      y: a.a.y + t * (a.b.y - a.a.y),
    };
    if (toSegment(p, b).d < within) inside++;
  }
  return (inside / (steps + 1)) * l;
}

function checkWord(
  index: number,
  pieces: Parameters<typeof inkShapes>[0],
  word: SigilPlan[number],
  layout: SigilGeometry,
  frame: SigilFrame,
): InvariantFailure[] {
  const unit = layout.unit;
  const failures: InvariantFailure[] = [];
  const fail = (check: InvariantCheck, message: string, place?: PlaceId) =>
    failures.push({ check, word: index, ...(place ? { place } : {}), message });
  const places = [...new Set(word.map((v) => v.place))];

  // Domain: what the grammar covers at all.
  for (const v of word) {
    if (v.crooks > G.crook.maxCrooks)
      fail(
        "domain",
        `${v.crooks} crooks at one vertex; the grammar covers ${G.crook.maxCrooks}`,
        v.place,
      );
    if (v.visit >= G.maxVisits)
      fail(
        "domain",
        `visit ${v.visit + 1} to one place; the grammar covers ${G.maxVisits}`,
        v.place,
      );
  }

  // Every mark inside the outer ring (or square).
  const square = frame.shape === "square";
  let reach = 0;
  for (const piece of pieces)
    for (const p of piece.points)
      reach = Math.max(
        reach,
        square
          ? Math.max(
              Math.abs(p.x - frame.center.x),
              Math.abs(p.y - frame.center.y),
            )
          : dist(p, frame.center),
      );
  if (reach > frame.radius + SIZE_TOLERANCE * unit)
    fail(
      "outer-ring",
      `ink reaches ${reach.toFixed(2)} from the centre${square ? " along an axis" : ""}; the bound is ${frame.radius}`,
    );

  const merged = inkShapes(pieces, unit, true);
  const drawn = inkShapes(pieces, unit, false);
  for (const curve of merged.unknown)
    fail(
      "shape",
      `a curve at ${fmt(curve[0])} is neither a loop nor a cup`,
      placeNear(curve[0], places, layout) ??
        layout.placeAt(curve[0]) ??
        undefined,
    );

  // The bar: one, centred on the last vertex, across the last stroke.
  const bars = barCandidates(merged, unit, 30);
  const last = word[word.length - 1];
  const barLines = new Set<number>();
  if (bars.length === 0) fail("bar", "no end bar", last.place);
  else {
    const unique = [...new Set(bars.map((b) => b.line))];
    if (unique.length > 1)
      fail("bar", `${unique.length} lines could be the end bar`, last.place);
    for (const b of bars) barLines.add(b.line);
    const bar = bars[0];
    const s = merged.lines[bar.line];
    if (!inRange(length(s), G.bar.length, unit))
      fail("bar", `the bar is ${length(s).toFixed(2)} long`, last.place);
    const skew = Math.abs(90 - angleBetween(norm(sub(s.b, s.a)), bar.arriving));
    if (skew > G.bar.perpendicularTolerance)
      fail(
        "bar",
        `the bar is ${skew.toFixed(1)}° off perpendicular to the last stroke`,
        last.place,
      );
    const mid = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
    if (dist(mid, bar.at) > G.bar.centreTolerance * unit)
      fail(
        "bar",
        `the bar's middle is ${dist(mid, bar.at).toFixed(2)} from the last vertex`,
        last.place,
      );
    if (placeNear(bar.at, [last.place], layout) === null)
      fail(
        "bar",
        `the bar is at ${fmt(bar.at)}, not at ${last.place}`,
        last.place,
      );
  }

  // The start circle: one loop a stroke leaves from the rim of, on the first vertex.
  const ends = inkEnds(merged);
  const first = word[0];
  const lone = word.length === 1;
  const starts = merged.loops
    .map((loop, i) => ({ loop, i }))
    .filter(({ loop }) =>
      lone
        ? bars.some(
            (b) => b.end === null && dist(b.at, loop.center) <= 0.3 * unit,
          )
        : rimEnds(loop, ends, unit).length > 0,
    );
  let startLoop: LoopShape | null = null;
  if (starts.length !== 1)
    fail("start-circle", `${starts.length} start circles`, first.place);
  if (starts.length >= 1) {
    startLoop = starts[0].loop;
    if (!inRange(startLoop.radius, G.startCircle.radius, unit))
      fail(
        "start-circle",
        `the start circle's radius is ${startLoop.radius.toFixed(2)}`,
        first.place,
      );
    if (placeNear(startLoop.center, [first.place], layout) === null)
      fail(
        "start-circle",
        `the start circle is at ${fmt(startLoop.center)}, not at ${first.place}`,
        first.place,
      );
  }

  // Nooses: every other loop is one, counted at its place.
  const nooseFeet: { foot: Point; line: number; loop: LoopShape }[] = [];
  const nooseCount = new Map<PlaceId | null, number>();
  for (const loop of merged.loops) {
    if (loop === startLoop) continue;
    const [contact] = nooseContacts(
      loop,
      merged,
      unit,
      Number.POSITIVE_INFINITY,
      barLines,
    );
    const tangent = contact && contact.gap <= G.noose.tangencyTolerance * unit;
    const at = tangent ? contact.foot : loop.center;
    const place = placeNear(at, places, layout) ?? layout.placeAt(at);
    nooseCount.set(place, (nooseCount.get(place) ?? 0) + 1);
    if (!tangent)
      fail(
        "noose",
        `a loop at ${fmt(loop.center)} is not tangent to a stroke`,
        place ?? undefined,
      );
    else {
      nooseFeet.push({ foot: contact.foot, line: contact.line, loop });
      const s = merged.lines[contact.line];
      const t = dot(sub(contact.foot, s.a), norm(sub(s.b, s.a)));
      if (
        t < G.stroke.minStraight * unit - SIZE_TOLERANCE ||
        t > length(s) - G.stroke.minStraight * unit + SIZE_TOLERANCE
      )
        fail(
          "noose",
          `the noose at ${fmt(contact.foot)} is not on an unbent line`,
          place ?? undefined,
        );
    }
    if (!inRange(loop.radius, G.noose.radius, unit))
      fail(
        "noose",
        `a noose's radius is ${loop.radius.toFixed(2)}`,
        place ?? undefined,
      );
  }
  const nooseExpected = new Map<PlaceId, number>();
  for (const v of word)
    if (v.marks.includes("noose"))
      nooseExpected.set(v.place, (nooseExpected.get(v.place) ?? 0) + 1);
  for (const place of new Set([
    ...nooseCount.keys(),
    ...nooseExpected.keys(),
  ])) {
    const found = nooseCount.get(place) ?? 0;
    const expected = place === null ? 0 : (nooseExpected.get(place) ?? 0);
    if (found > expected)
      fail(
        "noose",
        `${found - expected} noose(s) at ${place ?? "no place"} where none belongs`,
        place ?? undefined,
      );
    else if (found < expected)
      fail(
        "noose",
        `${expected - found} noose(s) missing at ${place}`,
        place ?? undefined,
      );
  }

  // Crooks: two cups each, in waves on a stroke, counted at their vertex.
  const lineEnds = ends.filter((e) => e.kind === "line");
  const join = SHAPE_TOLERANCE.join * unit;
  const onStroke = (p: Point, along: Point) =>
    lineEnds.some(
      (e) => dist(e.point, p) <= join && angleBetween(e.into, along) <= 5,
    );
  const cupCount = new Map<PlaceId | null, number>();
  for (const wave of merged.waves) {
    const dir = norm(sub(wave.b, wave.a));
    const back = { x: -dir.x, y: -dir.y };
    if (!wave.sidesAgree)
      fail("crook", `a wave at ${fmt(wave.a)} has cups on both sides`);
    for (const cup of wave.cups) {
      const chord = dist(cup.a, cup.b);
      if (
        !inRange(chord, G.crook.chord, unit) ||
        !inRange(cup.depth, G.crook.depth, unit)
      )
        fail(
          "crook",
          `a cup at ${fmt(cup.a)} is ${chord.toFixed(2)} wide and ${cup.depth.toFixed(2)} deep`,
        );
    }
    // The stroke continues straight from one end; the vertex is at the other,
    // or at the start circle's centre when the wave leaves its rim.
    const atA = onStroke(wave.a, back);
    const atB = onStroke(wave.b, dir);
    const fromRim =
      startLoop !== null &&
      [wave.a, wave.b].some(
        (p) =>
          Math.abs(dist(p, startLoop.center) - startLoop.radius) <= 0.15 * unit,
      );
    if (!atA && !atB && !lone)
      fail("crook", `a wave at ${fmt(wave.a)} is not on a stroke`);
    const vertexAt =
      fromRim && startLoop
        ? startLoop.center
        : atA && !atB
          ? wave.b
          : atB && !atA
            ? wave.a
            : null;
    const crooked = places.filter((p) =>
      word.some((v) => v.place === p && v.crooks > 0),
    );
    const place =
      (vertexAt
        ? placeNear(vertexAt, crooked, layout)
        : (placeNear(wave.a, crooked, layout) ??
          placeNear(wave.b, crooked, layout))) ??
      layout.placeAt(vertexAt ?? wave.b);
    cupCount.set(place, (cupCount.get(place) ?? 0) + wave.cups.length);
  }
  const cupExpected = new Map<PlaceId, number>();
  for (const v of word)
    if (v.crooks > 0)
      cupExpected.set(
        v.place,
        (cupExpected.get(v.place) ?? 0) + G.crook.cupsPerCrook * v.crooks,
      );
  for (const place of new Set([...cupCount.keys(), ...cupExpected.keys()])) {
    const found = cupCount.get(place) ?? 0;
    const expected = place === null ? 0 : (cupExpected.get(place) ?? 0);
    if (found !== expected)
      fail(
        "crook",
        `${found} cup(s) at ${place ?? "no place"}, ${expected} planned`,
        place ?? undefined,
      );
  }

  // Strokes as drawn (overlaps kept apart), without the bar.
  const barSegments = [...barLines].map((i) => merged.lines[i]);
  const onBar = (s: Segment) =>
    barSegments.some(
      (b) => toSegment(s.a, b).d <= join && toSegment(s.b, b).d <= join,
    );
  const strokes = drawn.lines.filter((s) => !onBar(s));

  // Nothing but the last stroke near the bar, nothing but its own strokes near a crook.
  if (bars.length > 0) {
    const touch = barIntrusion(merged, bars[0], unit, G.barClearance * unit);
    if (touch.distance < (G.barClearance - SIZE_TOLERANCE) * unit)
      fail(
        "bar-clearance",
        `other ink comes ${touch.distance.toFixed(2)} from the end bar at ${fmt(touch.at)}`,
        last.place,
      );
  }
  for (const touch of waveIntrusions(merged, unit, G.crookClearance * unit))
    if (touch.distance < (G.crookClearance - SIZE_TOLERANCE) * unit)
      fail(
        "crook-clearance",
        `other ink comes ${touch.distance.toFixed(2)} from the crook at ${fmt(touch.at)}`,
        placeNear(touch.at, places, layout) ?? undefined,
      );

  // No two loops touching: a noose through the start circle is one mark.
  for (const touch of loopContacts(merged, unit))
    if (touch.distance < (G.loopClearance - SIZE_TOLERANCE) * unit)
      fail(
        "loop-clearance",
        `loops at ${fmt(merged.loops[touch.a].center)} and ${fmt(merged.loops[touch.b].center)} come ${touch.distance.toFixed(2)} apart`,
        placeNear(touch.at, places, layout) ?? undefined,
      );

  // No two strokes lying on each other.
  for (let i = 0; i < strokes.length; i++)
    for (let j = i + 1; j < strokes.length; j++) {
      const a = strokes[i];
      const b = strokes[j];
      const within = G.overlap.distance * unit;
      const overlap = Math.max(
        overlapLength(a, b, within),
        overlapLength(b, a, within),
      );
      const limit = Math.min(
        G.overlap.length * unit,
        G.overlap.fractionOfShorter * Math.min(length(a), length(b)),
      );
      if (overlap > limit + SIZE_TOLERANCE * unit)
        fail(
          "overlap",
          `strokes at ${fmt(a.a)} and ${fmt(b.a)} lie on each other for ${overlap.toFixed(2)} units`,
        );
    }

  // The drawn vertices: from the reading that matches the plan, else any reading, else the ink's corners.
  const read = readWordShapes(merged, layout, false);
  const matching = read.readings.find(
    (r) =>
      r.word.length === word.length &&
      r.word.every((v, i) => v.place === word[i].place),
  );
  const reading = matching ?? read.readings[0];
  let vertices: Point[];
  if (reading) vertices = reading.points;
  else {
    vertices = [];
    const rim = startLoop
      ? rimEnds(startLoop, ends, unit).map((e) => e.point)
      : [];
    for (const e of lineEnds) {
      if (rim.some((p) => dist(p, e.point) <= join)) continue;
      if (
        merged.waves.some(
          (w) => dist(w.a, e.point) <= join || dist(w.b, e.point) <= join,
        )
      )
        continue;
      vertices.push(e.point);
    }
    if (startLoop) vertices.push(startLoop.center);
    for (const n of nooseFeet) vertices.push(n.foot);
    for (const b of bars) vertices.push(b.at);
  }

  // Every vertex within its place's slack.
  if (matching)
    matching.points.forEach((p, i) => {
      const place = word[i].place;
      if (
        dist(p, layout.anchor(place)) >
        layout.slack(place) + SIZE_TOLERANCE * unit
      )
        fail(
          "slack",
          `vertex ${i} is ${dist(p, layout.anchor(place)).toFixed(2)} from ${place}`,
          place,
        );
    });
  else {
    for (const p of vertices)
      if (placeNear(p, places, layout) === null)
        fail("slack", `a vertex at ${fmt(p)} is at none of the word's places`);
    for (const place of places)
      if (!vertices.some((p) => placeNear(p, [place], layout) !== null))
        fail("slack", `nothing is drawn at ${place}`, place);
  }

  // No stroke near another vertex of the name, nor touching another vertex's loop.
  const loops: { loop: LoopShape; at: Point }[] = [
    ...(startLoop ? [{ loop: startLoop, at: startLoop.center }] : []),
    ...nooseFeet.map((n) => ({ loop: n.loop, at: n.foot })),
  ];
  const waveAt = (p: Point) =>
    merged.waves.filter((w) => dist(w.a, p) <= join || dist(w.b, p) <= join);
  for (const s of strokes) {
    const incident = (v: Point) => {
      if (dist(v, s.a) <= join || dist(v, s.b) <= join) return true;
      // The first stroke leaves from the start circle's rim, not its centre.
      if (
        startLoop &&
        dist(v, startLoop.center) <= join &&
        rimEnds(startLoop, ends, unit).some(
          (e) => dist(e.point, s.a) <= join || dist(e.point, s.b) <= join,
        )
      )
        return true;
      // A noose's own line, and a crook's own stroke, run through or up to it.
      if (
        nooseFeet.some((n) => dist(n.foot, v) <= join) &&
        toSegment(v, s).d <= join
      )
        return true;
      return waveAt(v).some((w) =>
        [w.a, w.b].some(
          (e) =>
            (dist(e, s.a) <= join || dist(e, s.b) <= join) &&
            toLine(v, s) <= join,
        ),
      );
    };
    // A stroke into or out of a revisit may pass the place's earlier visit
    // (Regardie's יהוה, p. 59, crosses just beside the shared place); that
    // cannot be misread as another letter.
    // Its places are its vertices', not where its ink stops: the first
    // stroke stops at the start circle's rim, and a crooked stroke at its
    // wave, either of which may lie outside the vertex's slack.
    const vertexPoints = (end: Point): Point[] => {
      const points = [end];
      if (
        startLoop &&
        rimEnds(startLoop, ends, unit).some((e) => dist(e.point, end) <= join)
      )
        points.push(startLoop.center);
      for (const w of waveAt(end)) points.push(w.a, w.b);
      return points;
    };
    const ownPlaces = new Set(
      [s.a, s.b]
        .flatMap(vertexPoints)
        .map((p) => placeNear(p, places, layout))
        .filter((p) => p !== null),
    );
    for (const v of vertices) {
      if (incident(v)) continue;
      const place = placeNear(v, places, layout);
      // A vertex of the stroke's own place may stand beside it, but its
      // corner must not run into the stroke: a stroke width at least.
      const own = place !== null && ownPlaces.has(place);
      const d = toSegment(v, s).d;
      const min = own ? G.samePlaceClearance : G.vertexClearance;
      if (d < min * unit - SIZE_TOLERANCE * unit)
        fail(
          "clearance",
          `a stroke from ${fmt(s.a)} passes ${d.toFixed(2)} from the vertex at ${fmt(v)}`,
          placeNear(v, places, layout) ?? undefined,
        );
    }
    for (const { loop, at } of loops) {
      if (incident(at)) continue;
      if (
        startLoop === loop &&
        rimEnds(loop, ends, unit).some((e) => toSegment(e.point, s).d <= join)
      )
        continue;
      const d = Math.min(...loop.points.map((p) => toSegment(p, s).d));
      if (d < G.markClearance * unit - SIZE_TOLERANCE * unit)
        fail(
          "clearance",
          `a stroke from ${fmt(s.a)} comes ${d.toFixed(2)} from the loop at ${fmt(loop.center)}`,
          placeNear(at, places, layout) ?? undefined,
        );
    }
  }
  return failures;
}

/** Options for `checkInvariants`. */
export interface InvariantOptions {
  /** The outer bound, when the layout's slack-disc hull is not the right one. */
  bound?: { center: Point; radius: number };
}

/**
 * O2: every invariant of plan 088's O2 row that a single drawing can break,
 * for `svg` drawn from `plan` on `layout`. An empty list passes.
 */
export function checkInvariants(
  svg: string,
  plan: SigilPlan,
  layout: SigilGeometry,
  options: InvariantOptions = {},
): InvariantFailure[] {
  const frame = sigilFrame(layout, options.bound);
  const { words, issues } = figureWords(svg, layout, frame);
  const failures: InvariantFailure[] = issues.map((message) => ({
    check: /region/.test(message) ? "words" : "figure",
    word: null,
    message,
  }));
  const drawnWords = words.filter((w) => w.length > 0).length;
  if (drawnWords !== plan.length || words.length !== plan.length)
    failures.push({
      check: "words",
      word: null,
      message: `${drawnWords} word region(s) have ink, ${plan.length} word(s) planned`,
    });
  plan.forEach((word, i) => {
    const pieces = words[i] ?? [];
    if (pieces.length === 0) return;
    failures.push(...checkWord(i, pieces, word, layout, frame));
  });
  return failures;
}

const float = new Float64Array(1);
const bits = new BigInt64Array(float.buffer);

/** The double next to `x` towards `sign`'s infinity: one ulp away. */
export function nextDouble(x: number, sign: 1 | -1): number {
  if (Number.isNaN(x) || !Number.isFinite(x)) return x;
  if (x === 0) return sign * Number.MIN_VALUE;
  float[0] = x;
  // BigInt(), not a 1n literal: the app's tsconfig targets ES2018 and
  // type-checks this file through the package's source.
  bits[0] += BigInt(x > 0 === sign > 0 ? 1 : -1);
  return float[0];
}

/** Where the 1-ulp check nudges: after a layout's rounding, or before it. */
export interface NudgeSource {
  /**
   * The anchors before the layout rounded them (`anchors.ts`). Given, the
   * nudge moves these and `quantise` rounds the result, as the layout
   * does; a nudge then changes a drawing only where an anchor lies at a
   * rounding boundary, which is where engines' trig can disagree.
   */
  unrounded: UnroundedAnchor;
  /** The layout's own rounding of a coordinate. */
  quantise: (value: number) => number;
}

/**
 * A layout whose anchors are moved by one ulp, each axis and place its own
 * way: the rounded anchors, or with `source` the unrounded ones, rounded
 * again afterwards.
 */
export function nudgedLayout<Token>(
  layout: SigilLayout<Token>,
  sign: (place: number, axis: 0 | 1) => 1 | -1,
  source?: NudgeSource,
): SigilLayout<Token> {
  const index = new Map(layout.places.map((p, i) => [p, i]));
  // One ulp of zero is a subnormal, which no engine's trig produces
  // (cos(π/2) is 6e-17) and which aborts nlopt; zero moves by one ulp of
  // the layout's unit instead.
  const nudge = (x: number, s: 1 | -1) =>
    x === 0 ? s * Number.EPSILON * layout.unit : nextDouble(x, s);
  return {
    ...layout,
    place: (token) => layout.place(token),
    anchor(place) {
      const i = index.get(place) ?? 0;
      if (!source) {
        const a = layout.anchor(place);
        return { x: nudge(a.x, sign(i, 0)), y: nudge(a.y, sign(i, 1)) };
      }
      const u = source.unrounded(place);
      return {
        x: source.quantise(nudge(u.x, sign(i, 0))),
        y: source.quantise(nudge(u.y, sign(i, 1))),
      };
    },
    slack: (place) => layout.slack(place),
    placeAt: (point) => layout.placeAt(point),
  };
}

/** Draws `text` on `layout` as an SVG, whatever the engine. */
export type SigilDraw<Token = string> = (
  text: string,
  layout: SigilLayout<Token>,
) => string | Promise<string>;

/** The 1-ulp check's verdict: the nudges whose drawing differs or that threw. */
export interface StabilityResult {
  stable: boolean;
  /** Names of the nudges that changed the SVG. */
  changed: string[];
}

/** The nudges tried: every anchor up, every anchor down, and alternating by place and axis. */
export const NUDGES: readonly {
  name: string;
  sign: (place: number, axis: 0 | 1) => 1 | -1;
}[] = [
  { name: "up", sign: () => 1 },
  { name: "down", sign: () => -1 },
  {
    name: "alternating",
    sign: (place, axis) => ((place + axis) % 2 === 0 ? 1 : -1),
  },
];

/**
 * O2's 1-ulp check: `draw` must give the identical SVG when every anchor
 * of `layout` moves by one ulp, each way. Engines differ in the last bit
 * of trig; a drawing that changes under a one-ulp nudge differs between
 * them. A layout that rounds its anchors erases a nudge of the rounded
 * value, so give `source` to nudge before the rounding; `anchors.ts`
 * checks separately that no unrounded anchor sits near a boundary.
 */
export async function checkStability<Token>(
  draw: SigilDraw<Token>,
  text: string,
  layout: SigilLayout<Token>,
  source?: NudgeSource,
): Promise<StabilityResult> {
  if (source)
    for (const place of layout.places) {
      const u = source.unrounded(place);
      const a = layout.anchor(place);
      if (source.quantise(u.x) !== a.x || source.quantise(u.y) !== a.y)
        throw new Error(
          `checkStability: the unrounded anchor of ${place} does not round to the layout's`,
        );
    }
  const reference = await draw(text, layout);
  const changed: string[] = [];
  for (const nudge of NUDGES) {
    let svg: string;
    try {
      svg = await draw(text, nudgedLayout(layout, nudge.sign, source));
    } catch (error) {
      changed.push(`${nudge.name} (threw: ${String(error).slice(0, 80)})`);
      continue;
    }
    if (svg !== reference) changed.push(nudge.name);
  }
  return { stable: changed.length === 0, changed };
}
