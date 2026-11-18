/**
 * A deliberately simple drawer of a placed plan that follows the figure
 * grammar exactly, for the oracle's own tests (plan 088, "The oracle is
 * tested too"): no engine draws correct figures yet, so the known-good
 * figures come from here.
 *
 * NOT THE PRODUCT RENDERER. It places first visits on their anchors, moves
 * a revisit a fixed distance sideways, puts a noose on its neighbours'
 * chord, and takes hand placements where that is not enough. S2's
 * placement and renderer are written from plan 088, not from this.
 */

import { svgCoordinate } from "../../svgCoordinate.ts";
import type { PlacedVertex, PlacedWord, Point, SigilPlan } from "../types.ts";
import { type SigilGeometry, sigilFrame, wordOffset } from "./figure.ts";

/** The simple drawer's sizes, in units: each inside `FIGURE_GRAMMAR`'s ranges. */
export const SIMPLE_SIZES = {
  startRadius: 1.25,
  cupChord: 2,
  /** Half the chord: a semicircle. */
  cupDepth: 1,
  nooseRadius: 1.25,
  barLength: 3,
  /**
   * How far a revisit moves sideways from its anchor, per visit: far
   * enough that a word ending beside its start keeps its bar a stroke
   * width clear of the start circle (1.25 + 1.5 + 1 = 3.75 units).
   */
  revisitOffset: 4,
} as const;

export const round = (p: Point): Point => ({
  x: svgCoordinate(p.x),
  y: svgCoordinate(p.y),
});
export const pair = (p: Point) => `${svgCoordinate(p.x)},${svgCoordinate(p.y)}`;
const unitVector = (from: Point, to: Point): Point => {
  const l = Math.hypot(to.x - from.x, to.y - from.y);
  return l === 0
    ? { x: 1, y: 0 }
    : { x: (to.x - from.x) / l, y: (to.y - from.y) / l };
};
const along = (p: Point, d: Point, s: number): Point => ({
  x: p.x + d.x * s,
  y: p.y + d.y * s,
});
/** The left of a direction in SVG's y-down coordinates. */
const left = (d: Point): Point => ({ x: d.y, y: -d.x });

/**
 * A plan placed the simple way: anchors, rounded as SVG coordinates are so
 * a one-ulp nudge cannot move them; a revisit `revisitOffset × visit`
 * units sideways of its incoming stroke, towards the layout's centre; a
 * noose on the chord between its neighbours' points.
 * `overrides[word][vertex]` places a vertex by hand.
 */
export function placeSimply(
  plan: SigilPlan,
  layout: SigilGeometry,
  overrides: readonly (readonly (Point | undefined)[] | undefined)[] = [],
): PlacedWord[] {
  const unit = layout.unit;
  const centre = sigilFrame(layout).center;
  return plan.map((word, w) => {
    const points: Point[] = [];
    word.forEach((v, i) => {
      const fixed = overrides[w]?.[i];
      if (fixed) {
        points.push(fixed);
        return;
      }
      const anchor = round(layout.anchor(v.place));
      if (v.visit > 0 && i > 0) {
        // Sideways, towards the layout's centre, so it stays inside the ring.
        const l = left(unitVector(points[i - 1], anchor));
        const inward =
          (centre.x - anchor.x) * l.x + (centre.y - anchor.y) * l.y >= 0;
        const side = inward ? l : { x: -l.x, y: -l.y };
        points.push(
          round(
            along(anchor, side, SIMPLE_SIZES.revisitOffset * v.visit * unit),
          ),
        );
      } else points.push(anchor);
    });
    // Nooses onto their neighbours' chord, so the line through them is unbent.
    word.forEach((v, i) => {
      if (!v.marks.includes("noose") || overrides[w]?.[i]) return;
      const p = points[i - 1];
      const n = points[i + 1];
      const d = unitVector(p, n);
      const t = (points[i].x - p.x) * d.x + (points[i].y - p.y) * d.y;
      points[i] = along(p, d, t);
    });
    return word.map((v, i): PlacedVertex => ({ ...v, point: points[i] }));
  });
}

/** Ways to break a drawing on purpose; all off draws by the grammar. */
export interface DrawFaults {
  noBar?: boolean;
  /** Draw one cup fewer at this word's vertex. */
  dropCup?: { word: number; vertex: number };
  dropNoose?: { word: number; vertex: number };
  /** A noose at a vertex whose plan has none. */
  extraNoose?: { word: number; vertex: number };
  /** The start circle on the word's last vertex instead of its first. */
  startAtEnd?: boolean;
}

/** Choices a correct drawing may make; the grammar allows either. */
export interface DrawChoices {
  /** Nooses drawn to the right of the line instead of the left. */
  nooseRight?: readonly { word: number; vertex: number }[];
  /** Other sizes, for drawing marks the grammar does not allow. */
  sizes?: Partial<Record<keyof typeof SIMPLE_SIZES, number>>;
}

/**
 * An SVG of placed words by the figure grammar: words right to left, one
 * `<path>` each, the bar as its own subpath. Test-only (see the file's
 * comment).
 */
export function drawPlaced(
  words: readonly PlacedWord[],
  layout: SigilGeometry,
  faults: DrawFaults = {},
  choices: DrawChoices = {},
): string {
  const unit = layout.unit;
  const frame = sigilFrame(layout);
  const s = { ...SIMPLE_SIZES, ...choices.sizes };
  const paths = words.map((word, w) => {
    const offset = wordOffset(frame, w);
    const pts = word.map((v) => ({
      x: v.point.x + offset.x,
      y: v.point.y + offset.y,
    }));
    const at = (fault?: { word: number; vertex: number }, i?: number) =>
      fault !== undefined && fault.word === w && fault.vertex === i;
    const cups = (from: Point, d: Point, count: number, side: Point) => {
      // Semicircles of one side in a row along d.
      let out = "";
      let p = from;
      for (let k = 0; k < count; k++) {
        const c = s.cupChord * unit;
        const h = s.cupDepth * unit;
        const q = along(p, d, c);
        // The circle through both ends and the cup's deepest point.
        const r = ((c * c) / 4 + h * h) / (2 * h);
        const large = h > c / 2 ? 1 : 0;
        // Sweep 1 runs clockwise on screen, which in SVG's y-down coordinates
        // bulges to the left of d.
        const sweep = side.x * left(d).x + side.y * left(d).y > 0 ? 1 : 0;
        out += ` A ${svgCoordinate(r)},${svgCoordinate(r)} 0 ${large},${sweep} ${pair(q)}`;
        p = q;
      }
      return { d: out, end: p };
    };
    const loop = (centre: Point, from: Point, r: number) => {
      const opposite = { x: 2 * centre.x - from.x, y: 2 * centre.y - from.y };
      return ` A ${r},${r} 0 0,1 ${pair(opposite)} A ${r},${r} 0 0,1 ${pair(from)}`;
    };
    const n = pts.length;
    const circleAt = faults.startAtEnd ? n - 1 : 0;
    const dir0 = n > 1 ? unitVector(pts[0], pts[1]) : { x: 1, y: 0 };
    let d = "";
    // Start circle, drawn from the rim facing the next vertex.
    const centre = pts[circleAt];
    const facing =
      faults.startAtEnd && n > 1 ? unitVector(pts[n - 1], pts[n - 2]) : dir0;
    const rim = along(centre, facing, s.startRadius * unit);
    d += `M ${pair(rim)}${loop(centre, rim, s.startRadius * unit)}`;
    let pen = rim;
    if (faults.startAtEnd) {
      pen = pts[0];
      d += ` M ${pair(pen)}`;
    }
    const crooks0 = word[0].crooks * 2 - (at(faults.dropCup, 0) ? 1 : 0);
    if (crooks0 > 0) {
      const from = faults.startAtEnd
        ? along(pts[0], dir0, s.startRadius * unit)
        : rim;
      if (faults.startAtEnd) d += ` M ${pair(from)}`;
      const c = cups(from, dir0, crooks0, left(dir0));
      d += c.d;
      pen = c.end;
    }
    for (let i = 1; i < n; i++) {
      const dir = unitVector(pts[i - 1], pts[i]);
      const count = word[i].crooks * 2 - (at(faults.dropCup, i) ? 1 : 0);
      if (word[i].crooks > 0) {
        const start = along(
          pts[i],
          dir,
          -2 * word[i].crooks * s.cupChord * unit,
        );
        d += ` L ${pair(start)}`;
        // Away from where the line turns next, so the outgoing stroke clears them.
        const out = i + 1 < n ? unitVector(pts[i], pts[i + 1]) : dir;
        const turnsLeft = out.x * left(dir).x + out.y * left(dir).y > 0;
        const side = turnsLeft
          ? { x: -left(dir).x, y: -left(dir).y }
          : left(dir);
        const c = cups(start, dir, count, side);
        d += c.d;
        if (count < word[i].crooks * 2) d += ` L ${pair(pts[i])}`;
      } else d += ` L ${pair(pts[i])}`;
      const noose =
        (word[i].marks.includes("noose") && !at(faults.dropNoose, i)) ||
        at(faults.extraNoose, i);
      if (noose) {
        const r = s.nooseRadius * unit;
        const right = choices.nooseRight?.some(
          (c) => c.word === w && c.vertex === i,
        );
        d += loop(along(pts[i], left(dir), right ? -r : r), pts[i], r);
      }
    }
    if (!faults.noBar) {
      const last = pts[n - 1];
      const dir = n > 1 ? unitVector(pts[n - 2], last) : { x: 1, y: 0 };
      const half = (s.barLength * unit) / 2;
      d += ` M ${pair(along(last, left(dir), half))} L ${pair(along(last, left(dir), -half))}`;
    }
    return `<path d="${d.trim()}"/>`;
  });
  const width = frame.pitch * words.length;
  const x0 = frame.center.x + frame.pitch / 2 - width;
  const y0 = frame.center.y - frame.pitch / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${width} ${frame.pitch}" fill="none" stroke="black" stroke-width="${unit}">${paths.join("")}</svg>`;
}
