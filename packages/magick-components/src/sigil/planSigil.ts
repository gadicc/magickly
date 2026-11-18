/**
 * The sigil planner (plan 088, "Plan: what each vertex says"): a text's
 * words to what each vertex of each word says, with no drawing decisions
 * left. It knows nothing of the rose: places, anchors and the unit come
 * from the layout, and the rule's one number from the profile, so the same
 * planner serves a kamea. Written from the plan's rule list, rules 1–4,
 * which the comments below cite.
 */

import type {
  PlaceId,
  Point,
  SigilLayout,
  SigilMark,
  SigilPlan,
  SigilProfile,
  SigilVertex,
} from "./types.ts";

/**
 * Rule 1's split: `text` on whitespace (JavaScript's `\s`, so a no-break or
 * em space splits and a hyphen, maqaf or joiner does not), each word as its
 * characters (code points). Empty words are left out; characters the layout
 * has no place for are the planner's to drop.
 */
export function sigilWords(text: string): string[][] {
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => [...word]);
}

/** A coordinate as the SVG writes it, to 0.001, so planning sees what is drawn. */
const quantise = (value: number) => Math.round(value * 1000) / 1000 + 0;

function quantisedAnchor(layout: SigilLayout<unknown>, place: PlaceId): Point {
  const a = layout.anchor(place);
  return { x: quantise(a.x), y: quantise(a.y) };
}

/**
 * Rule 4's geometry: whether `v` lies within `tolerance` of the segment
 * from `p` to `n` with its foot strictly between them. Only `+ − × ÷ √`, so
 * every engine agrees.
 */
function passesThrough(p: Point, v: Point, n: Point, tolerance: number) {
  const dx = n.x - p.x;
  const dy = n.y - p.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return false;
  const t = ((v.x - p.x) * dx + (v.y - p.y) * dy) / l2;
  if (!(t > 0 && t < 1)) return false;
  const off = Math.abs(dx * (v.y - p.y) - dy * (v.x - p.x)) / Math.sqrt(l2);
  return off <= tolerance;
}

/**
 * The plan of `words` (each a list of tokens) on `layout` under `profile`
 * (plan 088, rules 1–4): one array per word left with a place, one vertex
 * per run of equal places, each with its visit count, crooks and marks.
 * `sigilWords` splits a text into words of characters.
 */
export function planSigil<Token>(
  words: readonly (readonly Token[])[],
  layout: SigilLayout<Token>,
  profile: SigilProfile,
): SigilPlan {
  const plan: SigilVertex[][] = [];
  for (const tokens of words) {
    // Rule 1: tokens without a place are dropped, and so is an empty word.
    const places = tokens
      .map((token) => layout.place(token))
      .filter((place): place is PlaceId => place !== null);
    if (places.length === 0) continue;

    // Rule 2: a run of one place is one vertex with a crook per extra letter.
    const runs: { place: PlaceId; crooks: number }[] = [];
    for (const place of places) {
      const last = runs[runs.length - 1];
      if (last && last.place === place) last.crooks += 1;
      else runs.push({ place, crooks: 0 });
    }

    const tolerance = profile.nooseTolerance * layout.unit;
    const word = runs.map((run, i): SigilVertex => {
      // Rule 3: earlier vertices of this word at this place.
      let visit = 0;
      for (let j = 0; j < i; j++) if (runs[j].place === run.place) visit++;

      // Rule 4: marks, in SIGIL_MARK_ORDER.
      const marks: SigilMark[] = [];
      if (i === 0) marks.push("start");
      if (run.crooks > 0) marks.push("crook");
      const prev = runs[i - 1];
      const next = runs[i + 1];
      if (
        run.crooks === 0 &&
        prev &&
        next &&
        prev.place !== next.place &&
        passesThrough(
          quantisedAnchor(layout, prev.place),
          quantisedAnchor(layout, run.place),
          quantisedAnchor(layout, next.place),
          tolerance,
        )
      )
        marks.push("noose");
      if (i === runs.length - 1) marks.push("end");
      return { place: run.place, visit, crooks: run.crooks, marks };
    });
    plan.push(word);
  }
  return plan;
}
