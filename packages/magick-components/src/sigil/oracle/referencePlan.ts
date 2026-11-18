/**
 * The oracle's reference planner (plan 088, O1): the plan rules written
 * out naively from the list in plan 088 ("Plan: what each vertex says"),
 * by someone who has not seen `planSigil`. It favours being obviously
 * right over being fast or short; `planSigil` is checked against it over
 * the exhaustive corpus, and both against the hand fixtures.
 */

import type {
  PlaceId,
  Point,
  SigilLayout,
  SigilMark,
  SigilPlan,
  SigilProfile,
  SigilVertex,
} from "../types.ts";

/** A text's words as arrays of characters (code points), split on whitespace. */
export function referenceWords(text: string): string[][] {
  return text
    .split(/\s+/u)
    .filter((word) => word !== "")
    .map((word) => Array.from(word));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000 + 0;
}

function rounded(point: Point): Point {
  return { x: round3(point.x), y: round3(point.y) };
}

/**
 * Rule 4's test: does `v` lie within `tolerance` of the segment from `p`
 * to `n`, with its foot strictly between them?
 */
function passesThrough(p: Point, v: Point, n: Point, tolerance: number) {
  const dx = n.x - p.x;
  const dy = n.y - p.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return false;
  const t = ((v.x - p.x) * dx + (v.y - p.y) * dy) / lengthSquared;
  if (!(t > 0 && t < 1)) return false;
  const footX = p.x + t * dx;
  const footY = p.y + t * dy;
  const distance = Math.sqrt((v.x - footX) ** 2 + (v.y - footY) ** 2);
  return distance <= tolerance;
}

/** The plan of `words` on `layout` under `profile`, by rules 1–4. */
export function referencePlan<Token>(
  words: readonly (readonly Token[])[],
  layout: SigilLayout<Token>,
  profile: SigilProfile,
): SigilPlan {
  const plan: SigilVertex[][] = [];

  for (const word of words) {
    // Rule 1: map each token to its place, dropping tokens with none.
    const places: PlaceId[] = [];
    for (const token of word) {
      const place = layout.place(token);
      if (place !== null) places.push(place);
    }
    if (places.length === 0) continue;

    // Rule 2: merge runs of one place into one vertex.
    const runs: { place: PlaceId; length: number }[] = [];
    for (const place of places) {
      const last = runs[runs.length - 1];
      if (last && last.place === place) last.length += 1;
      else runs.push({ place, length: 1 });
    }

    const vertices: SigilVertex[] = [];
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];

      // Rule 3: count earlier vertices of this word at this place.
      let visit = 0;
      for (let j = 0; j < i; j++) if (runs[j].place === run.place) visit++;

      const crooks = run.length - 1;

      // Rule 4: the marks.
      const has: Record<SigilMark, boolean> = {
        start: i === 0,
        crook: crooks > 0,
        noose: false,
        end: i === runs.length - 1,
      };
      if (i > 0 && i < runs.length - 1 && crooks === 0) {
        const previous = runs[i - 1].place;
        const next = runs[i + 1].place;
        if (previous !== next) {
          has.noose = passesThrough(
            rounded(layout.anchor(previous)),
            rounded(layout.anchor(run.place)),
            rounded(layout.anchor(next)),
            profile.nooseTolerance * layout.unit,
          );
        }
      }
      const marks: SigilMark[] = [];
      if (has.start) marks.push("start");
      if (has.crook) marks.push("crook");
      if (has.noose) marks.push("noose");
      if (has.end) marks.push("end");

      vertices.push({ place: run.place, visit, crooks, marks });
    }
    plan.push(vertices);
  }

  return plan;
}
