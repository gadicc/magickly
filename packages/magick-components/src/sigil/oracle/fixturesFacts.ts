/**
 * Checks a layout against what the hand fixtures' figures show
 * (`fixtures.ts`): the turns, headings, crossings and proportions of each
 * fixture's path, computed from the layout's anchors for the plan's
 * places. On the right layout nothing fails; on a mirrored or turned rose,
 * or one with letters swapped, something does. The conventions are in
 * `fixtures.ts`.
 */

import type { Point, SigilLayout, SigilPlan } from "../types.ts";
import type {
  Compass,
  FigureProportion,
  FigureTurn,
  FigureWord,
} from "./fixtures.ts";

/** What the facts are checked on: a fixture's plan and figure. */
export interface FactsSubject {
  id: string;
  plan: SigilPlan;
  figure: readonly FigureWord[];
  proportions?: readonly FigureProportion[];
}

/** One fact the layout does not reproduce. */
export interface FactFailure {
  fixture: string;
  word: number;
  fact: "shape" | "turn" | "heading" | "crossing" | "pass" | "proportion";
  detail: string;
}

const COMPASS_DEGREES: Readonly<Record<Compass, number>> = {
  E: 0,
  SE: 45,
  S: 90,
  SW: 135,
  W: 180,
  NW: -135,
  N: -90,
  NE: -45,
};

/**
 * How far a stroke's heading at the anchors may be from the figure's
 * compass point: half a quadrant. The figures are drawn by hand and
 * revisits are shifted, so a stroke can lie some 25° from its anchors'
 * direction; a rose turned by a right angle or more cannot pass.
 */
export const HEADING_TOLERANCE_DEGREES = 45;

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function length(a: Point): number {
  return Math.sqrt(dot(a, a));
}

/**
 * The turn at `v` between `p` and `n`, as the anchors make it: `straight`
 * when `v` lies within `tolerance` of the segment p–n with its foot
 * between them (as R4 measures it), `back` when the line returns past `p`
 * within `tolerance` of itself, otherwise `right` or `left` by the sign
 * of the cross product (y down, so positive is clockwise on the page).
 */
export function anchorTurn(
  p: Point,
  v: Point,
  n: Point,
  tolerance: number,
): FigureTurn | null {
  const chord = sub(n, p);
  const chordLength = length(chord);
  if (chordLength > 0) {
    const t = dot(sub(v, p), chord) / (chordLength * chordLength);
    const off = Math.abs(cross(chord, sub(v, p))) / chordLength;
    if (t > 0 && t < 1 && off <= tolerance) return "straight";
  }
  const into = sub(v, p);
  const out = sub(n, v);
  const turn = cross(into, out);
  if (dot(into, out) < 0 && Math.abs(turn) / length(into) <= tolerance)
    return "back";
  if (turn > 0) return "right";
  if (turn < 0) return "left";
  return null;
}

/** The angle from `heading`'s compass point to `stroke`'s direction, in degrees, 0–180. */
function headingError(stroke: Point, heading: Compass): number {
  const degrees = (Math.atan2(stroke.y, stroke.x) * 180) / Math.PI;
  const difference = Math.abs(degrees - COMPASS_DEGREES[heading]) % 360;
  return difference > 180 ? 360 - difference : difference;
}

/** Whether segments a–b and c–d cross at a point inside both. */
function properlyCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const abc = cross(sub(b, a), sub(c, a));
  const abd = cross(sub(b, a), sub(d, a));
  const cda = cross(sub(d, c), sub(a, c));
  const cdb = cross(sub(d, c), sub(b, c));
  return abc * abd < 0 && cda * cdb < 0;
}

/**
 * Every fact of `subject`'s figure that `layout`'s anchors do not
 * reproduce, with R4's straightness judged at `nooseTolerance` units.
 */
export function figureFactFailures(
  subject: FactsSubject,
  layout: Pick<SigilLayout<unknown>, "anchor" | "slack" | "unit">,
  nooseTolerance: number,
): FactFailure[] {
  const failures: FactFailure[] = [];
  const tolerance = nooseTolerance * layout.unit;
  const fail = (word: number, fact: FactFailure["fact"], detail: string) =>
    failures.push({ fixture: subject.id, word, fact, detail });

  if (subject.figure.length !== subject.plan.length)
    fail(
      -1,
      "shape",
      `${subject.figure.length} figure words for ${subject.plan.length} plan words`,
    );

  subject.plan.forEach((vertices, w) => {
    const figure = subject.figure[w];
    if (!figure) return;
    const points = vertices.map((vertex) => layout.anchor(vertex.place));
    const last = vertices.length - 1;

    if (figure.turns.length !== vertices.length)
      fail(
        w,
        "shape",
        `${figure.turns.length} turns for ${vertices.length} vertices`,
      );
    if (figure.headings.length !== Math.max(0, last))
      fail(
        w,
        "shape",
        `${figure.headings.length} headings for ${last} strokes`,
      );

    for (let i = 0; i <= last; i++) {
      const recorded = figure.turns[i] ?? null;
      const turning =
        i > 0 && i < last && vertices[i - 1].place !== vertices[i + 1].place;
      if (turning !== (recorded !== null)) {
        fail(
          w,
          "shape",
          `vertex ${i}: a turn ${turning ? "is due" : "is not recorded"} here`,
        );
        continue;
      }
      if (recorded === null) continue;
      const actual = anchorTurn(
        points[i - 1],
        points[i],
        points[i + 1],
        tolerance,
      );
      if (actual !== recorded)
        fail(
          w,
          "turn",
          `vertex ${i} (${vertices[i].place}): ${actual} at the anchors, ${recorded} in the figure`,
        );
    }

    for (let i = 0; i < last; i++) {
      const heading = figure.headings[i];
      if (!heading) continue;
      const error = headingError(sub(points[i + 1], points[i]), heading);
      if (error > HEADING_TOLERANCE_DEGREES)
        fail(w, "heading", `stroke ${i}: ${error.toFixed(1)}° from ${heading}`);
    }

    const recorded = new Set(figure.crossings.map(([i, j]) => `${i},${j}`));
    for (const [i, j] of figure.crossings)
      if (!(i + 1 < j && j < last))
        fail(w, "shape", `crossing ${i},${j} is not two strokes apart`);
    for (let i = 0; i < last; i++) {
      for (let j = i + 2; j < last; j++) {
        const crosses = properlyCross(
          points[i],
          points[i + 1],
          points[j],
          points[j + 1],
        );
        const key = `${i},${j}`;
        if (crosses && !recorded.has(key))
          fail(
            w,
            "crossing",
            `strokes ${key} cross at the anchors, not in the figure`,
          );
        if (!crosses && recorded.has(key))
          fail(
            w,
            "crossing",
            `strokes ${key} cross in the figure, not at the anchors`,
          );
      }
    }

    for (const { stroke, place } of figure.passes ?? []) {
      if (!(stroke >= 0 && stroke < last)) {
        fail(w, "shape", `no stroke ${stroke} to pass ${place}`);
        continue;
      }
      const from = points[stroke];
      const along = sub(points[stroke + 1], from);
      const to = sub(layout.anchor(place), from);
      const t = dot(to, along) / dot(along, along);
      const off = Math.abs(cross(along, to)) / length(along);
      if (!(t > 0 && t < 1 && off <= layout.slack(place)))
        fail(
          w,
          "pass",
          `stroke ${stroke} misses ${place} (${off.toFixed(2)} off, t ${t.toFixed(2)})`,
        );
    }
  });

  for (const proportion of subject.proportions ?? []) {
    const vertices = subject.plan[proportion.word];
    const distance = ([a, b]: readonly [number, number]) =>
      length(
        sub(layout.anchor(vertices[a].place), layout.anchor(vertices[b].place)),
      );
    const shorter = distance(proportion.shorter);
    const longer = distance(proportion.longer);
    if (!(shorter < proportion.factor * longer))
      fail(
        proportion.word,
        "proportion",
        `|${proportion.shorter}| is ${(shorter / longer).toFixed(2)} of |${proportion.longer}|, not under ${proportion.factor}`,
      );
  }

  return failures;
}
