/**
 * O3, read-back from ink (plan 088): every reading a drawn figure allows,
 * found from its shapes alone, never from the order of the SVG's commands.
 * A figure passes only when each word has exactly one reading and it is
 * the plan. The steps:
 *
 * 1. Flatten the ink; merge collinear lines that touch or overlap, so a
 *    line drawn back over itself is one line.
 * 2. Join curves that continue each other with the same tangent and
 *    curvature; closed and round, they are loops; open with both ends on
 *    one line, cups; cups end to end on one line, waves. Any other curve
 *    makes the word unreadable.
 * 3. Cast the shapes every way they fit: a loop with a stroke leaving its
 *    rim as the start circle; every other loop as a noose on a line it is
 *    tangent to (within 0.4 units); a line centred across another's end as
 *    the bar, unless other ink runs into it (closer than half a stroke
 *    width). Ink that close to a crook's cups, on their side, makes the
 *    word unreadable.
 * 4. Build a graph: line ends, wave ends, noose feet and points where one
 *    line's end lies on another are nodes; crossings are not, so the trace
 *    goes straight through them.
 * 5. Trace every way from the circle to the bar that uses all the ink
 *    once. Along each, a vertex is the circle, a noose foot, a wave's far
 *    end (the start's own wave aside), the bar, and any turn of 10° or
 *    more; a turn between 2° and 10° gives both readings.
 * 6. Map vertices with `layout.placeAt`, count visits, and collect the
 *    distinct plans.
 */

import type {
  PlaceId,
  Point,
  SigilMark,
  SigilPlan,
  SigilVertex,
  SigilWord,
} from "../types.ts";
import {
  FIGURE_GRAMMAR,
  figureWords,
  fmt,
  type SigilFrame,
  type SigilGeometry,
} from "./figure.ts";
import {
  angleBetween,
  barCandidates,
  barIntrusion,
  dist,
  dot,
  type InkEnd,
  type InkShapes,
  inkEnds,
  inkShapes,
  length,
  nooseContacts,
  norm,
  rimEnds,
  type Segment,
  SHAPE_TOLERANCE,
  sub,
  waveIntrusions,
} from "./figureShapes.ts";

/** One reading of a word: its vertices as a plan word, and where each was drawn. */
export interface WordReading {
  word: SigilWord;
  points: Point[];
}

/** What one word's ink allows. */
export interface WordReadBack {
  /** Distinct readings, as plan words; more than `READING_LIMIT` is cut short. */
  readings: WordReading[];
  /** Why ink could not be read, when it could not. */
  problems: string[];
}

/** What a figure's ink allows, word by word. */
export interface ReadBack {
  words: WordReadBack[];
  problems: string[];
}

/** Readings beyond this many are not looked for: the figure is ambiguous anyway. */
export const READING_LIMIT = 8;
const TRAIL_LIMIT = 4000;
const CHOICE_LIMIT = 256;

/** Read-back's tolerances: a reader's, looser than the grammar O2 holds a renderer to. */
const READ = {
  /** Points closer than this, in units, are one node. */
  node: 0.06,
  /** A noose may sit this far, in units, off tangency. */
  nooseGap: 0.4,
  /** A bar may be this far, in degrees, from perpendicular. */
  barSkew: 15,
  /**
   * Ink closer than this, in units, to a bar or a crook's cups runs into
   * it: their inks overlap by half a stroke width and a reader cannot tell
   * the mark from the crossing.
   */
  touch: 0.5,
} as const;

interface Edge {
  kind: "line" | "wave" | "rim";
  from: number;
  to: number;
  cups: number;
}

interface Graph {
  nodes: Point[];
  edges: Edge[];
  start: number;
  end: number;
  nooses: Set<number>;
}

function nodeIndex(nodes: Point[], p: Point, tol: number): number {
  const i = nodes.findIndex((q) => dist(p, q) <= tol);
  if (i >= 0) return i;
  nodes.push(p);
  return nodes.length - 1;
}

function* product<T>(lists: T[][]): Generator<T[]> {
  if (lists.length === 0) {
    yield [];
    return;
  }
  const [first, ...rest] = lists;
  for (const item of first)
    for (const tail of product(rest)) yield [item, ...tail];
}

interface Choice {
  start: number;
  rim: InkEnd | null;
  bar: number;
  barAt: Point;
  nooses: { loop: number; line: number; foot: Point }[];
}

/** The ways the loops and lines can be cast as start circle, bar and nooses. */
function choices(
  shapes: InkShapes,
  unit: number,
  problems: string[],
  strict: boolean,
): Choice[] {
  const ends = inkEnds(shapes);
  const candidates = barCandidates(shapes, unit, READ.barSkew);
  const bars = candidates.filter(
    (bar) =>
      !strict ||
      barIntrusion(shapes, bar, unit, FIGURE_GRAMMAR.strokeWidth * unit)
        .distance >=
        READ.touch * unit,
  );
  if (candidates.length > 0 && bars.length === 0)
    problems.push("the end bar runs into other ink");
  else if (bars.length === 0) problems.push("no end bar");
  const starts = shapes.loops.flatMap((loop, i) => {
    const rims = rimEnds(loop, ends, unit).map((rim) => ({ start: i, rim }));
    const lone = bars.some(
      (b) => b.end === null && dist(b.at, loop.center) <= 0.3 * unit,
    );
    return lone ? [...rims, { start: i, rim: null }] : rims;
  });
  if (starts.length === 0)
    problems.push("no start circle with a stroke leaving its rim");
  const found: Choice[] = [];
  for (const { start, rim } of starts)
    for (const bar of bars) {
      if ((rim === null) !== (bar.end === null)) continue;
      const others = shapes.loops
        .map((loop, i) => ({ loop, i }))
        .filter(({ i }) => i !== start);
      const options = others.map(({ loop, i }) =>
        nooseContacts(
          loop,
          shapes,
          unit,
          READ.nooseGap * unit,
          new Set([bar.line]),
        ).map((c) => ({ loop: i, line: c.line, foot: c.foot })),
      );
      const stray = options.findIndex((o) => o.length === 0);
      if (stray >= 0) {
        problems.push(
          `a loop at ${fmt(others[stray].loop.center)} is neither the start circle nor a noose`,
        );
        continue;
      }
      for (const nooses of product(options)) {
        found.push({ start, rim, bar: bar.line, barAt: bar.at, nooses });
        if (found.length >= CHOICE_LIMIT) return found;
      }
    }
  return found;
}

function buildGraph(shapes: InkShapes, choice: Choice, unit: number): Graph {
  const tol = READ.node * unit;
  const join = SHAPE_TOLERANCE.join * unit;
  const nodes: Point[] = [];
  const edges: Edge[] = [];
  const loop = shapes.loops[choice.start];
  const start = nodeIndex(nodes, loop.center, tol);
  // Points where a line must be split: another edge's end on it, or a noose's foot.
  const marks: Point[] = choice.nooses.map((n) => n.foot);
  const ends: Point[] = [
    ...shapes.lines.flatMap((s, i) => (i === choice.bar ? [] : [s.a, s.b])),
    ...shapes.waves.flatMap((w) => [w.a, w.b]),
  ];
  shapes.lines.forEach((s: Segment, i) => {
    if (i === choice.bar) return;
    const l = length(s);
    const dir = norm(sub(s.b, s.a));
    const cuts = [0, l];
    for (const p of [...marks, ...ends]) {
      const t = dot(sub(p, s.a), dir);
      if (t <= join || t >= l - join) continue;
      const foot = { x: s.a.x + t * dir.x, y: s.a.y + t * dir.y };
      if (dist(foot, p) <= join) cuts.push(t);
    }
    cuts.sort((x, y) => x - y);
    for (let k = 1; k < cuts.length; k++) {
      if (cuts[k] - cuts[k - 1] <= join) continue;
      const a = {
        x: s.a.x + cuts[k - 1] * dir.x,
        y: s.a.y + cuts[k - 1] * dir.y,
      };
      const b = { x: s.a.x + cuts[k] * dir.x, y: s.a.y + cuts[k] * dir.y };
      edges.push({
        kind: "line",
        from: nodeIndex(nodes, a, tol),
        to: nodeIndex(nodes, b, tol),
        cups: 0,
      });
    }
  });
  for (const w of shapes.waves)
    edges.push({
      kind: "wave",
      from: nodeIndex(nodes, w.a, tol),
      to: nodeIndex(nodes, w.b, tol),
      cups: w.cups.length,
    });
  if (choice.rim)
    edges.push({
      kind: "rim",
      from: start,
      to: nodeIndex(nodes, choice.rim.point, tol),
      cups: 0,
    });
  const nooses = new Set(
    choice.nooses.map((n) => nodeIndex(nodes, n.foot, tol)),
  );
  const end = nodeIndex(nodes, choice.barAt, tol);
  return { nodes, edges, start, end, nooses };
}

/** Every trail from start to end using each edge once, as (edge, reversed) steps. */
function trails(graph: Graph): { edge: number; reversed: boolean }[][] {
  const found: { edge: number; reversed: boolean }[][] = [];
  const used = new Array(graph.edges.length).fill(false);
  const steps: { edge: number; reversed: boolean }[] = [];
  const visit = (node: number) => {
    if (found.length >= TRAIL_LIMIT) return;
    if (steps.length === graph.edges.length) {
      if (node === graph.end) found.push([...steps]);
      return;
    }
    graph.edges.forEach((e, i) => {
      if (used[i]) return;
      // The rim is only ever left from the circle's centre.
      if (e.kind === "rim" && !(e.from === node && steps.length === 0)) return;
      if (
        e.kind !== "rim" &&
        steps.length === 0 &&
        graph.edges.some((x) => x.kind === "rim")
      )
        return;
      let reversed: boolean;
      if (e.from === node) reversed = false;
      else if (e.to === node) reversed = true;
      else return;
      used[i] = true;
      steps.push({ edge: i, reversed });
      visit(reversed ? e.from : e.to);
      steps.pop();
      used[i] = false;
    });
  };
  visit(graph.start);
  return found;
}

interface RawVertex {
  point: Point;
  crooks: number;
  noose: boolean;
}

/** The vertex sequences a trail allows: one, or more where a turn is unclear. */
function vertexReadings(
  graph: Graph,
  trail: { edge: number; reversed: boolean }[],
): RawVertex[][] {
  const from = (s: { edge: number; reversed: boolean }) =>
    s.reversed ? graph.edges[s.edge].to : graph.edges[s.edge].from;
  const to = (s: { edge: number; reversed: boolean }) =>
    s.reversed ? graph.edges[s.edge].from : graph.edges[s.edge].to;
  const direction = (s: { edge: number; reversed: boolean }) =>
    norm(sub(graph.nodes[to(s)], graph.nodes[from(s)]));

  let readings: RawVertex[][] = [
    [{ point: graph.nodes[graph.start], crooks: 0, noose: false }],
  ];
  let afterStart = true;
  for (let i = 0; i < trail.length; i++) {
    const step = trail[i];
    const edge = graph.edges[step.edge];
    const node = to(step);
    const last = i === trail.length - 1;
    if (edge.kind === "rim") continue;
    let crooks = 0;
    if (edge.kind === "wave") {
      // A crook is two cups; an odd count cannot be read.
      crooks = edge.cups % 2 === 0 ? edge.cups / 2 : Number.NaN;
      if (afterStart) {
        for (const r of readings) r[0].crooks += crooks;
        crooks = 0;
      }
    }
    afterStart = false;
    const noose = graph.nooses.has(node);
    if (last) {
      for (const r of readings)
        r.push({ point: graph.nodes[node], crooks, noose });
      continue;
    }
    const turn = angleBetween(direction(step), direction(trail[i + 1]));
    const marked = crooks !== 0 || noose;
    if (marked || turn >= FIGURE_GRAMMAR.turn.visible) {
      for (const r of readings)
        r.push({ point: graph.nodes[node], crooks, noose });
    } else if (turn > FIGURE_GRAMMAR.turn.straight) {
      readings = readings.flatMap((r) => [
        r,
        [...r, { point: graph.nodes[node], crooks, noose }],
      ]);
    }
    if (readings.length > READING_LIMIT * 4)
      readings = readings.slice(0, READING_LIMIT * 4);
  }
  return readings;
}

function toWord(
  raw: RawVertex[],
  layout: SigilGeometry,
  problems: string[],
): SigilWord | null {
  const vertices: SigilVertex[] = [];
  const seen: PlaceId[] = [];
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (Number.isNaN(v.crooks)) {
      problems.push(`a crook at ${fmt(v.point)} has an odd number of cups`);
      return null;
    }
    const place = layout.placeAt(v.point);
    if (place === null) {
      problems.push(`a vertex at ${fmt(v.point)} is at no place`);
      return null;
    }
    const marks: SigilMark[] = [];
    if (i === 0) marks.push("start");
    if (v.crooks > 0) marks.push("crook");
    if (v.noose) marks.push("noose");
    if (i === raw.length - 1) marks.push("end");
    vertices.push({
      place,
      visit: seen.filter((p) => p === place).length,
      crooks: v.crooks,
      marks,
    });
    seen.push(place);
  }
  return vertices;
}

/** Every reading of one word's shapes (O3). */
export function readWordShapes(
  shapes: InkShapes,
  layout: SigilGeometry,
  /**
   * False reads past ink run into a bar or a crook, for O2, which reports
   * that itself and still wants the figure's vertices.
   */
  strict = true,
): WordReadBack {
  const unit = layout.unit;
  const problems: string[] = [];
  if (shapes.unknown.length)
    problems.push(
      `${shapes.unknown.length} curve(s) are neither loops nor cups, first at ${fmt(shapes.unknown[0][0])}`,
    );
  const mixed = shapes.waves.find((w) => !w.sidesAgree);
  if (mixed) problems.push(`a wave at ${fmt(mixed.a)} has cups on both sides`);
  // Measured from a stroke width along its own strokes, as O2 measures.
  const crossed = strict
    ? waveIntrusions(shapes, unit, FIGURE_GRAMMAR.strokeWidth * unit).find(
        (touch) => touch.distance < READ.touch * unit,
      )
    : undefined;
  if (crossed)
    problems.push(`ink runs through the crook at ${fmt(crossed.at)}`);
  if (problems.length) return { readings: [], problems };

  const readings = new Map<string, WordReading>();
  for (const choice of choices(shapes, unit, problems, strict)) {
    if (choice.rim === null) {
      // A one-vertex word: circle, bar, and perhaps a wave leaving the rim.
      const extra = shapes.lines.length - 1;
      const loose = shapes.waves.filter(
        (w) =>
          Math.abs(
            dist(w.a, shapes.loops[choice.start].center) -
              shapes.loops[choice.start].radius,
          ) >
            0.15 * unit &&
          Math.abs(
            dist(w.b, shapes.loops[choice.start].center) -
              shapes.loops[choice.start].radius,
          ) >
            0.15 * unit,
      );
      if (extra > 0 || loose.length || choice.nooses.length) continue;
      const cups = shapes.waves.reduce((n, w) => n + w.cups.length, 0);
      const raw = [
        {
          point: shapes.loops[choice.start].center,
          crooks: cups % 2 === 0 ? cups / 2 : Number.NaN,
          noose: false,
        },
      ];
      const word = toWord(raw, layout, problems);
      if (word)
        readings.set(JSON.stringify(word), {
          word,
          points: raw.map((r) => r.point),
        });
      continue;
    }
    const graph = buildGraph(shapes, choice, unit);
    for (const trail of trails(graph))
      for (const raw of vertexReadings(graph, trail)) {
        const word = toWord(raw, layout, problems);
        if (!word) continue;
        readings.set(JSON.stringify(word), {
          word,
          points: raw.map((r) => r.point),
        });
        if (readings.size > READING_LIMIT) break;
      }
    if (readings.size > READING_LIMIT) break;
  }
  if (readings.size === 0 && problems.length === 0)
    problems.push("no trail from the start circle to the bar uses all the ink");
  return { readings: [...readings.values()], problems: [...new Set(problems)] };
}

/** Every reading `svg`'s ink allows on `layout`, word by word (O3). */
export function readBack(
  svg: string,
  layout: SigilGeometry,
  frame?: SigilFrame,
): ReadBack {
  const { words, issues } = figureWords(svg, layout, frame);
  return {
    words: words.map((pieces) =>
      pieces.length === 0
        ? { readings: [], problems: ["an empty word region"] }
        : readWordShapes(inkShapes(pieces, layout.unit, true), layout),
    ),
    problems: issues,
  };
}

/** A way a figure fails read-back. */
export interface ReadBackFailure {
  word: number | null;
  message: string;
}

/** O3's verdict on `svg` against the expected `plan`. */
export interface ReadBackResult {
  ok: boolean;
  failures: ReadBackFailure[];
  readBack: ReadBack;
}

function describe(word: SigilWord): string {
  return word
    .map(
      (v) =>
        `${v.place}${v.visit ? `'${v.visit}` : ""}${v.crooks ? `~${v.crooks}` : ""}${v.marks.includes("noose") ? "@" : ""}`,
    )
    .join(" ");
}

/**
 * O3: passes only when the ink has exactly one reading per word and it
 * equals `plan` (places, visits, crooks and marks).
 */
export function checkReadBack(
  svg: string,
  plan: SigilPlan,
  layout: SigilGeometry,
  frame?: SigilFrame,
): ReadBackResult {
  const result = readBack(svg, layout, frame);
  const failures: ReadBackFailure[] = result.problems.map((message) => ({
    word: null,
    message,
  }));
  if (result.words.length !== plan.length)
    failures.push({
      word: null,
      message: `${result.words.length} word(s) drawn, ${plan.length} planned`,
    });
  result.words.forEach((w, i) => {
    const expected = plan[i];
    if (w.readings.length === 0)
      failures.push({
        word: i,
        message: `no reading: ${w.problems.join("; ") || "unknown"}`,
      });
    else if (w.readings.length > 1)
      failures.push({
        word: i,
        message: `${w.readings.length >= READING_LIMIT ? "at least " : ""}${w.readings.length} readings: ${w.readings
          .slice(0, 3)
          .map((r) => describe(r.word))
          .join(" | ")}`,
      });
    else if (
      expected &&
      JSON.stringify(w.readings[0].word) !== JSON.stringify(expected)
    )
      failures.push({
        word: i,
        message: `reads ${describe(w.readings[0].word)}, planned ${describe(expected)}`,
      });
  });
  return { ok: failures.length === 0, failures, readBack: result };
}
