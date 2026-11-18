/**
 * The oracle's view of a drawn sigil (plan 088, O2 and O3): the figure
 * grammar a renderer must follow, as data (`FIGURE_GRAMMAR`) and in prose
 * below, and a parser that turns an SVG of the sigil alone into ink in
 * layout coordinates, one set per word. `figureShapes.ts` finds lines,
 * loops, cups and waves in that ink for both checks; `figureDrawer.ts` is
 * a deliberately simple drawer for the oracle's own tests, not the product
 * renderer. Test-only: nothing the package publishes imports this
 * directory. (The package's source holds code only, so this is the
 * oracle's readme.)
 *
 * The figure input
 *
 * An SVG string of the sigil alone: no rose, no labels. O2 and O3 read its
 * stroked `path`, `circle`, `ellipse`, `line`, `polyline` and `polygon`
 * elements under any `transform`, flatten every line, arc and Bézier curve to
 * polylines in the SVG's user coordinates, and then forget the commands:
 * their order, direction, grouping into subpaths and elements, and splitting
 * make no difference. Filled shapes, text and other elements are reported as
 * breaking the grammar. Today's `RoseSigilImage` gives this with
 * `showRose={false}` and no `debug` or `animation`: its only ink is then the
 * red path.
 *
 * Curved ink must be drawn with curves (arcs, Béziers, circles) and strokes
 * with straight segments; a curve approximated by many short lines reads as
 * many short strokes.
 *
 * The figure grammar
 *
 * `FIGURE_GRAMMAR` below holds the numbers. Lengths are in sigil
 * units (`SigilLayout.unit`: 1 on the rose, whose rings are 10 apart), so the
 * grammar scales to a kamea's cells.
 *
 * **Legibility.** The sizes are chosen for the smallest rendering we expect
 * to publish: a one-word figure 100 units across shown at 125 px, a
 * thumbnail beside an angel's name (plan 031; the image route's raster
 * default is 1024 px and the page larger still). That is 1.25 px per unit,
 * and with the 1-unit stroke SVG draws by default a stroke is 1.25 px wide.
 * Two rules follow and fix most of the sizes: a gap or a hole must be at
 * least one stroke width to show at all, and a mark must stand clear of the
 * line by at least a stroke width to read as a mark rather than a thick spot.
 * No size was taken from any engine's output.
 *
 * - **Start circle (R1).** A circle centred on the word's first vertex,
 *   radius 1 to 2.5. At 1 its hole is one stroke width across, the smallest
 *   that shows; above 2.5 it would reach a quarter of the way to the nearest
 *   other place (10 units on the rose). The first stroke (or the first
 *   crook's wave) leaves from the rim, straight outwards towards the next
 *   vertex. On a one-vertex word nothing leaves it.
 * - **Stroke (R2).** A straight segment from vertex to vertex, nothing else.
 *   Each keeps at least 1 unit of straight line beside its marks, so its
 *   direction shows.
 * - **Crook (R3).** Per crook, two cups: arcs with both ends on the line,
 *   bulging to one side, chord 2 to 3.5, depth 1 to 2, the cups of a wave all
 *   on one side and meeting end to end in cusps. A cup 1 deep stands one
 *   stroke width clear of the line's ink; a smaller one reads as a kink. Where
 *   along the line: the `2 × crooks` cups lie on the incoming stroke and the
 *   last ends at the vertex; at a word's first vertex they lie on the
 *   outgoing stroke, starting at the start circle's rim; on a one-vertex word
 *   they run along +x from the rim. At most 2 crooks at one vertex: three
 *   crooks' six cups (12 units at the smallest chord) do not fit on the
 *   rose's shortest stroke (ד to ל, 10 units). The 72 names and the
 *   templates need at most two.
 * - **Noose (R4).** A closed round loop, radius 1 to 2, tangent to one side
 *   of the line (its centre `radius ± 0.25` from the line) and touching it at
 *   the vertex. The line through it is unbent: the strokes either side are
 *   collinear (within 0.03 units, the SVG's rounding and no more), and run at
 *   least 1 unit each way from the vertex. A loop straddling the line, as
 *   today's bead does, is not a noose. Radius 1 is the start circle's
 *   smallest, for the same reason.
 * - **End bar (R5, decision 6).** A straight segment centred on the last
 *   vertex (within 0.25), perpendicular to the last stroke (within 5°),
 *   length 3 to 6: at 3 it stands a stroke width clear of the line on each
 *   side; at 6 it stays well short of the next place. On a one-vertex word it
 *   is perpendicular to +x, through the start circle.
 * - **Turns.** A vertex with no mark is read only where the line turns by at
 *   least 10°: over the shortest stroke that moves the far end 1.7 units,
 *   about two stroke widths at the smallest size. A turn of 2° or less reads
 *   as straight. Between the two a reader cannot tell, so read-back gives the
 *   figure two readings and fails it.
 * - **Overlap.** Two strokes overlap where their centre lines are closer than
 *   1 unit (their inks touch). No pair may overlap for more than 8 units, nor
 *   for more than half the shorter stroke. The 8 is not from legibility
 *   alone: F1's returns are narrow wedges, whose inks touch near the shared
 *   vertex for 1 / sin(angle). On the rose the narrowest wedge that cannot be
 *   avoided is ללהאל's return from He, about 7.9° when He and both Lameds sit
 *   at the edge of their slack, touching for 7.3 units. Half the shorter
 *   stroke keeps a short stroke drawn back over itself from passing.
 * - **Clearance.** No stroke passes within 2 units of a drawn vertex of the
 *   name other than its own ends (a clear gap of one stroke width between
 *   inks), and none comes within 1 unit of another vertex's loop. Strokes
 *   through places outside the name are free (F2). A stroke into or out of a
 *   revisit may pass the same place's earlier visit (Regardie's יהוה, p. 59,
 *   crosses beside the shared place); that cannot be misread as another
 *   letter.
 * - **Outer bound.** Every mark of a word lies within its layout's outer
 *   bound: for the rose the disc of radius 40, its outer ring (letters at 35,
 *   slack 4.6). For any layout, unless one is supplied, the disc about the
 *   centre of the anchors' bounding box that reaches every place's slack,
 *   rounded up to a whole unit (which gives 40 on the rose).
 * - **Words (R2, decision 5).** One SVG; word `i` (reading order) is drawn in
 *   the layout's coordinates translated by `(−i × pitch, 0)`, so words run
 *   right to left; `pitch` is the bound's diameter plus 10 units each side
 *   (100 on the rose, today's viewBox width). Each word's ink stays inside
 *   its square region. Regardie's p. 60 lays the four sigils of יוד הא ואו הא
 *   left to right; decision 5 keeps our renderer right to left.
 * - **Domain.** At most 2 crooks at a vertex and at most 4 visits to a place:
 *   four points two units apart fit in the 4.6-unit slack, and Taphthartharath
 *   on Mercury's kamea (vol. 4, p. 79) visits 40 four times. Plans outside
 *   the domain fail O2 as `domain`.
 *
 * The worst case on the rose, ללהאל (two strokes and a noose within the
 * slack at Aleph), is feasible: He at (0, −30.45) and the Lameds at
 * (±4.488, 34.7) give an Aleph 2.1 units off the first stroke and wedge
 * tips touching for 7.3 units (`invariants.test.ts` draws it). It needs
 * He and both Lameds within 0.1 unit of the edge of their slack, so a
 * placement that only tries a few offsets may not find it.
 */

import type { Point, SigilLayout } from "../types.ts";

/**
 * The figure grammar (plan 088, "Renderer"). Lengths are in sigil units
 * (`SigilLayout.unit`), angles in degrees; ranges are inclusive. Sizes come
 * from legibility at the smallest size a figure is published at
 * (`minPixelsPerUnit`), never from any engine's output; the module's
 * comment gives the reasoning for each.
 */
export const FIGURE_GRAMMAR = {
  /** Stroke width the sizes assume: SVG's default, 1 unit. */
  strokeWidth: 1,
  /**
   * The smallest rendering the grammar keeps legible: 1.25 px per unit, a
   * one-word figure (100 units across on the rose) at 125 px, the size of
   * a thumbnail beside an angel's name. A unit is then 1.25 px, so a gap of
   * one stroke width is the narrowest that shows.
   */
  minPixelsPerUnit: 1.25,
  /** R1: a circle centred on the word's first vertex; the first stroke leaves from its rim. */
  startCircle: { radius: [1, 2.5] as const, centreTolerance: 0.25 },
  /** Strokes are straight; each keeps at least this much straight line beside its marks. */
  stroke: { minStraight: 1 },
  /**
   * R3: per crook, two cups on the line, bulging to one side and meeting in
   * a cusp. A wave of `2 × crooks` cups lies on the incoming stroke and ends
   * at the vertex; at a word's first vertex it lies on the outgoing stroke
   * and starts at the start circle's rim; on a one-vertex word it runs along
   * +x from the rim.
   */
  crook: {
    cupsPerCrook: 2,
    chord: [2, 3.5] as const,
    depth: [1, 2] as const,
    /**
     * More crooks at one vertex than this is outside the grammar's domain:
     * three crooks' six cups (12 units at the smallest chord) would not fit
     * on the rose's shortest stroke (ד to ל, 10 units).
     */
    maxCrooks: 2,
  },
  /**
   * R4: a closed round loop tangent to one side of an unbent line, touching
   * it at the vertex. The two strokes through the vertex are collinear.
   */
  noose: { radius: [1, 2] as const, tangencyTolerance: 0.25 },
  /**
   * R5: a straight bar centred on the last vertex, perpendicular to the last
   * stroke (to +x on a one-vertex word).
   */
  bar: {
    length: [3, 6] as const,
    centreTolerance: 0.25,
    perpendicularTolerance: 5,
  },
  /**
   * A vertex without a mark is read only at a visible turn. At or under
   * `straight` the line reads as unbent; between the two, a reader cannot
   * tell, so the figure has two readings.
   */
  turn: { straight: 2, visible: 10 },
  /**
   * Two strokes overlap where their centre lines are closer than `distance`
   * (one stroke width: their inks touch). No pair may overlap for more than
   * `length` units or `fractionOfShorter` of the shorter stroke, whichever is
   * less. 8 units admits the narrow wedge F1 shows within the rose's slack
   * (ללהאל's return from He, about 7°: 1 / sin 7° ≈ 8.2 units of touching ink).
   */
  overlap: { distance: 1, length: 8, fractionOfShorter: 0.5 },
  /**
   * No stroke passes closer than this to a drawn vertex of the name other
   * than its own ends: two stroke widths, a clear gap of one between inks.
   */
  vertexClearance: 2,
  /** No stroke touches another vertex's loop (start circle or noose): one stroke width. */
  markClearance: 1,
  /**
   * Visits to one place a word may make and still read (the grammar's
   * domain): four points two units apart fit in the rose's 4.6-unit slack,
   * and Taphthartharath on Mercury's kamea (vol. 4, p. 79) visits 40 four
   * times.
   */
  maxVisits: 4,
  /** Margin between a word's outer bound and its region's edge (R2, decision 5). */
  wordMargin: 10,
} as const;

/** Layout geometry the oracle uses; the token mapping is the planner's business. */
export type SigilGeometry = Omit<SigilLayout<never>, "place">;

/**
 * Where a figure's words sit: each word is drawn in the layout's own
 * coordinates, translated by `(-index × pitch, 0)`, so words run right to
 * left (R2, decision 5). Every mark stays within `radius` of `center`
 * (layout coordinates); a word's region is the square of side `pitch`
 * around its translated centre.
 */
export interface SigilFrame {
  center: Point;
  radius: number;
  pitch: number;
  unit: number;
}

/**
 * The frame of `layout`: unless `bound` is given, a disc about the centre
 * of the anchors' bounding box reaching every place's slack, rounded up to
 * a whole unit. On the rose that is radius 40, the rose's outer ring
 * (letters at 35, slack 4.6), and a pitch of 100, today's viewBox.
 */
export function sigilFrame(
  layout: SigilGeometry,
  bound?: { center: Point; radius: number },
): SigilFrame {
  const unit = layout.unit;
  const margin = FIGURE_GRAMMAR.wordMargin * unit;
  if (bound) return { ...bound, pitch: 2 * (bound.radius + margin), unit };
  const anchors = layout.places.map((place) => layout.anchor(place));
  const xs = anchors.map((p) => p.x);
  const ys = anchors.map((p) => p.y);
  // Quantised as SVG coordinates are, so a 1-ulp nudge of the anchors
  // cannot move the frame.
  const q = (v: number) => Math.round(v * 1000) / 1000 + 0;
  const center = {
    x: q((Math.min(...xs) + Math.max(...xs)) / 2),
    y: q((Math.min(...ys) + Math.max(...ys)) / 2),
  };
  let reach = 0;
  for (const place of layout.places) {
    const a = layout.anchor(place);
    reach = Math.max(
      reach,
      Math.hypot(a.x - center.x, a.y - center.y) + layout.slack(place),
    );
  }
  const radius = Math.ceil(reach / unit - 1e-9) * unit;
  return { center, radius, pitch: 2 * (radius + margin), unit };
}

/** The SVG offset of word `index`'s layout coordinates. */
export function wordOffset(frame: SigilFrame, index: number): Point {
  return { x: -index * frame.pitch, y: 0 };
}

/** A piece of ink: a straight segment (two points) or a flattened curve. */
export interface InkPiece {
  kind: "line" | "curve";
  points: Point[];
  /** A curve drawn closed by its element (a circle or ellipse). */
  closed: boolean;
}

/** An SVG's ink in its user coordinates, with anything the grammar does not allow. */
export interface ParsedFigure {
  pieces: InkPiece[];
  issues: string[];
}

type Matrix = readonly [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m: Matrix, p: Point): Point {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  };
}

const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

function numbers(text: string): number[] {
  return (text.match(NUMBER) ?? []).map(Number);
}

function parseTransform(text: string, issues: string[]): Matrix {
  let m = IDENTITY;
  for (const [, name, args] of text.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const v = numbers(args);
    let t: Matrix | null = null;
    if (name === "matrix" && v.length === 6)
      t = [v[0], v[1], v[2], v[3], v[4], v[5]];
    else if (name === "translate") t = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    else if (name === "scale") t = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
    else if (name === "rotate") {
      const a = ((v[0] ?? 0) * Math.PI) / 180;
      const [cx, cy] = [v[1] ?? 0, v[2] ?? 0];
      const r: Matrix = [
        Math.cos(a),
        Math.sin(a),
        -Math.sin(a),
        Math.cos(a),
        0,
        0,
      ];
      t = multiply(multiply([1, 0, 0, 1, cx, cy], r), [1, 0, 0, 1, -cx, -cy]);
    } else if (name === "skewX")
      t = [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    else if (name === "skewY")
      t = [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    if (t) m = multiply(m, t);
    else issues.push(`unreadable transform ${name}(${args})`);
  }
  return m;
}

/** An absolute path segment, in the path's own coordinates. */
export type PathSegment =
  | { type: "M"; to: Point }
  | { type: "L"; from: Point; to: Point }
  | { type: "C"; from: Point; c1: Point; c2: Point; to: Point }
  | { type: "Q"; from: Point; c: Point; to: Point }
  | {
      type: "A";
      from: Point;
      rx: number;
      ry: number;
      rotation: number;
      large: boolean;
      sweep: boolean;
      to: Point;
    };

/**
 * Path data as absolute segments: relative commands resolved, H/V as lines,
 * S/T with their reflected control points, Z as a line back to the
 * subpath's start. Throws on data it cannot read.
 */
export function parsePathData(d: string): PathSegment[] {
  const segments: PathSegment[] = [];
  let pos = 0;
  const skip = () => {
    while (pos < d.length && /[\s,]/.test(d[pos])) pos++;
  };
  const number = () => {
    skip();
    const re = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
    re.lastIndex = pos;
    const m = re.exec(d);
    if (!m) throw new Error(`path data: expected a number at ${pos} in ${d}`);
    pos = re.lastIndex;
    return Number(m[0]);
  };
  const flag = () => {
    skip();
    const c = d[pos];
    if (c !== "0" && c !== "1")
      throw new Error(`path data: expected an arc flag at ${pos} in ${d}`);
    pos++;
    return c === "1";
  };
  const hasNumber = () => {
    skip();
    return pos < d.length && /[+\-.\d]/.test(d[pos]);
  };

  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  let lastCubic: Point | null = null;
  let lastQuad: Point | null = null;
  let command = "";
  skip();
  while (pos < d.length) {
    if (/[a-zA-Z]/.test(d[pos])) command = d[pos++];
    else if (!command) throw new Error(`path data: no command at ${pos}`);
    const rel = command === command.toLowerCase();
    const at = (x: number, y: number): Point =>
      rel ? { x: current.x + x, y: current.y + y } : { x, y };
    const upper = command.toUpperCase();
    let cubic: Point | null = null;
    let quad: Point | null = null;
    if (upper === "M") {
      current = at(number(), number());
      start = current;
      segments.push({ type: "M", to: current });
      // Further pairs after a moveto are linetos.
      command = rel ? "l" : "L";
    } else if (upper === "L") {
      const to = at(number(), number());
      segments.push({ type: "L", from: current, to });
      current = to;
    } else if (upper === "H") {
      const x = number();
      const to = { x: rel ? current.x + x : x, y: current.y };
      segments.push({ type: "L", from: current, to });
      current = to;
    } else if (upper === "V") {
      const y = number();
      const to = { x: current.x, y: rel ? current.y + y : y };
      segments.push({ type: "L", from: current, to });
      current = to;
    } else if (upper === "C" || upper === "S") {
      const c1: Point =
        upper === "C"
          ? at(number(), number())
          : lastCubic
            ? { x: 2 * current.x - lastCubic.x, y: 2 * current.y - lastCubic.y }
            : current;
      const c2 = at(number(), number());
      const to = at(number(), number());
      segments.push({ type: "C", from: current, c1, c2, to });
      cubic = c2;
      current = to;
    } else if (upper === "Q" || upper === "T") {
      const c: Point =
        upper === "Q"
          ? at(number(), number())
          : lastQuad
            ? { x: 2 * current.x - lastQuad.x, y: 2 * current.y - lastQuad.y }
            : current;
      const to = at(number(), number());
      segments.push({ type: "Q", from: current, c, to });
      quad = c;
      current = to;
    } else if (upper === "A") {
      const rx = number();
      const ry = number();
      const rotation = number();
      const large = flag();
      const sweep = flag();
      const to = at(number(), number());
      segments.push({
        type: "A",
        from: current,
        rx,
        ry,
        rotation,
        large,
        sweep,
        to,
      });
      current = to;
    } else if (upper === "Z") {
      segments.push({ type: "L", from: current, to: start });
      current = start;
      command = "";
    } else throw new Error(`path data: unknown command ${command}`);
    lastCubic = cubic;
    lastQuad = quad;
    if (upper !== "Z" && !hasNumber()) command = "";
    skip();
  }
  return segments;
}

/** An elliptical arc's centre parameterisation (SVG 2, B.2.4). */
export interface ArcCentre {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  phi: number;
  theta: number;
  delta: number;
}

/**
 * The centre form of an arc segment, with radii scaled up as SVG does when
 * they cannot span the chord; `null` when the arc is drawn as a line
 * (a zero radius) or not at all (coincident ends).
 */
export function arcCentre(
  seg: Extract<PathSegment, { type: "A" }>,
): ArcCentre | null {
  const { from, to } = seg;
  if (from.x === to.x && from.y === to.y) return null;
  let rx = Math.abs(seg.rx);
  let ry = Math.abs(seg.ry);
  if (rx === 0 || ry === 0) return null;
  const phi = (seg.rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef =
    (seg.large !== seg.sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1) / ry;
  const cyp = (-coef * ry * x1) / rx;
  const cx = cos * cxp - sin * cyp + (from.x + to.x) / 2;
  const cy = sin * cxp + cos * cyp + (from.y + to.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta = angle(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let delta = angle(
    (x1 - cxp) / rx,
    (y1 - cyp) / ry,
    (-x1 - cxp) / rx,
    (-y1 - cyp) / ry,
  );
  if (!seg.sweep && delta > 0) delta -= 2 * Math.PI;
  if (seg.sweep && delta < 0) delta += 2 * Math.PI;
  return { cx, cy, rx, ry, phi, theta, delta };
}

/** The point at parameter `theta` of an arc's ellipse. */
export function arcPoint(arc: ArcCentre, theta: number): Point {
  const cos = Math.cos(arc.phi);
  const sin = Math.sin(arc.phi);
  const x = arc.rx * Math.cos(theta);
  const y = arc.ry * Math.sin(theta);
  return { x: arc.cx + cos * x - sin * y, y: arc.cy + sin * x + cos * y };
}

/** Largest angle between flattened samples of an arc or circle. */
const ARC_STEP = (2 * Math.PI) / 180;
/** Samples per Bézier segment. */
const BEZIER_STEPS = 32;
/** A curve whose samples all lie this close to its chord is a line. */
const DEGENERATE = 0.005;

function curvePiece(points: Point[], closed: boolean): InkPiece {
  const a = points[0];
  const b = points[points.length - 1];
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (!closed && length > 0) {
    let off = 0;
    for (const p of points)
      off = Math.max(
        off,
        Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) /
          length,
      );
    const along = points.every((p) => {
      const t =
        ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length ** 2;
      return t > -1e-6 && t < 1 + 1e-6;
    });
    if (off <= DEGENERATE && along)
      return { kind: "line", points: [a, b], closed: false };
  }
  return { kind: "curve", points, closed };
}

function flattenSegment(seg: PathSegment, m: Matrix): InkPiece | null {
  if (seg.type === "M") return null;
  if (seg.type === "L") {
    const a = apply(m, seg.from);
    const b = apply(m, seg.to);
    return { kind: "line", points: [a, b], closed: false };
  }
  if (seg.type === "C" || seg.type === "Q") {
    const points: Point[] = [];
    for (let i = 0; i <= BEZIER_STEPS; i++) {
      const t = i / BEZIER_STEPS;
      const u = 1 - t;
      const p =
        seg.type === "C"
          ? {
              x:
                u * u * u * seg.from.x +
                3 * u * u * t * seg.c1.x +
                3 * u * t * t * seg.c2.x +
                t * t * t * seg.to.x,
              y:
                u * u * u * seg.from.y +
                3 * u * u * t * seg.c1.y +
                3 * u * t * t * seg.c2.y +
                t * t * t * seg.to.y,
            }
          : {
              x: u * u * seg.from.x + 2 * u * t * seg.c.x + t * t * seg.to.x,
              y: u * u * seg.from.y + 2 * u * t * seg.c.y + t * t * seg.to.y,
            };
      points.push(apply(m, p));
    }
    return curvePiece(points, false);
  }
  const arc = arcCentre(seg);
  if (!arc) {
    if (seg.from.x === seg.to.x && seg.from.y === seg.to.y) return null;
    return {
      kind: "line",
      points: [apply(m, seg.from), apply(m, seg.to)],
      closed: false,
    };
  }
  const steps = Math.max(4, Math.ceil(Math.abs(arc.delta) / ARC_STEP));
  const points: Point[] = [apply(m, seg.from)];
  for (let i = 1; i < steps; i++)
    points.push(apply(m, arcPoint(arc, arc.theta + (arc.delta * i) / steps)));
  points.push(apply(m, seg.to));
  return curvePiece(points, false);
}

function ellipsePiece(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  m: Matrix,
): InkPiece {
  const points: Point[] = [];
  const steps = Math.ceil((2 * Math.PI) / ARC_STEP);
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    points.push(
      apply(m, { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }),
    );
  }
  return { kind: "curve", points, closed: true };
}

const SKIPPED = new Set(["style", "title", "desc", "metadata", "defs"]);
const CONTAINERS = new Set(["svg", "g"]);
const SHAPES = new Set([
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
]);

interface Paint {
  matrix: Matrix;
  stroke: boolean;
  fill: boolean;
  hidden: boolean;
}

function attributes(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [, name, dq, sq] of text.matchAll(
    /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
  ))
    map.set(name, dq ?? sq ?? "");
  const style = map.get("style");
  if (style)
    for (const declaration of style.split(";")) {
      const [name, value] = declaration.split(":").map((s) => s.trim());
      if (name && value !== undefined) map.set(name, value);
    }
  return map;
}

/**
 * The ink of an SVG of the sigil alone, in the SVG's user (viewBox)
 * coordinates. Stroked `path`, `circle`, `ellipse`, `line`, `polyline` and
 * `polygon` elements are ink, under any `transform`; anything filled, any
 * other drawing element (text, images, `use`) and nested viewports are
 * reported as issues, since the grammar has no place for them.
 */
export function parseFigureSvg(svg: string): ParsedFigure {
  const pieces: InkPiece[] = [];
  const issues: string[] = [];
  const stack: Paint[] = [
    { matrix: IDENTITY, stroke: false, fill: true, hidden: false },
  ];
  let skipDepth = 0;
  let svgDepth = 0;
  const tag =
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>/g;
  for (const match of svg.matchAll(tag)) {
    const [, closing, rawName, attrText, selfClosing] = match;
    if (!rawName) continue;
    const name = rawName.toLowerCase();
    if (skipDepth > 0) {
      if (SKIPPED.has(name)) skipDepth += closing ? -1 : selfClosing ? 0 : 1;
      continue;
    }
    if (closing) {
      if (CONTAINERS.has(name) || SHAPES.has(name)) stack.pop();
      if (name === "svg") svgDepth--;
      continue;
    }
    if (SKIPPED.has(name)) {
      if (!selfClosing) skipDepth = 1;
      continue;
    }
    if (!CONTAINERS.has(name) && !SHAPES.has(name)) {
      issues.push(`<${name}> is not ink the figure grammar allows`);
      continue;
    }
    if (name === "svg" && ++svgDepth > 1)
      issues.push("a nested <svg> viewport is not read");
    const attrs = attributes(attrText);
    const parent = stack[stack.length - 1];
    const paint: Paint = {
      matrix: attrs.has("transform")
        ? multiply(
            parent.matrix,
            parseTransform(attrs.get("transform") ?? "", issues),
          )
        : parent.matrix,
      stroke: attrs.has("stroke")
        ? attrs.get("stroke") !== "none"
        : parent.stroke,
      fill: attrs.has("fill") ? attrs.get("fill") !== "none" : parent.fill,
      hidden:
        parent.hidden ||
        attrs.get("display") === "none" ||
        attrs.get("visibility") === "hidden",
    };
    if (!selfClosing) stack.push(paint);
    if (!SHAPES.has(name) || paint.hidden || (!paint.stroke && !paint.fill))
      continue;
    if (paint.fill)
      issues.push(`a filled <${name}>; sigil ink is stroked only`);
    const num = (key: string) => Number(attrs.get(key) ?? 0);
    const m = paint.matrix;
    try {
      if (name === "path") {
        for (const seg of parsePathData(attrs.get("d") ?? "")) {
          const piece = flattenSegment(seg, m);
          if (piece) pieces.push(piece);
        }
      } else if (name === "circle") {
        if (num("r") > 0)
          pieces.push(
            ellipsePiece(num("cx"), num("cy"), num("r"), num("r"), m),
          );
      } else if (name === "ellipse") {
        if (num("rx") > 0 && num("ry") > 0)
          pieces.push(
            ellipsePiece(num("cx"), num("cy"), num("rx"), num("ry"), m),
          );
      } else if (name === "line") {
        pieces.push({
          kind: "line",
          points: [
            apply(m, { x: num("x1"), y: num("y1") }),
            apply(m, { x: num("x2"), y: num("y2") }),
          ],
          closed: false,
        });
      } else {
        const v = numbers(attrs.get("points") ?? "");
        const points: Point[] = [];
        for (let i = 0; i + 1 < v.length; i += 2)
          points.push(apply(m, { x: v[i], y: v[i + 1] }));
        if (name === "polygon" && points.length > 2) points.push(points[0]);
        for (let i = 1; i < points.length; i++)
          pieces.push({
            kind: "line",
            points: [points[i - 1], points[i]],
            closed: false,
          });
      }
    } catch (error) {
      issues.push(String((error as Error).message));
    }
  }
  return {
    pieces: pieces.filter(
      (piece) =>
        piece.kind === "curve" ||
        Math.hypot(
          piece.points[1].x - piece.points[0].x,
          piece.points[1].y - piece.points[0].y,
        ) > 1e-6,
    ),
    issues,
  };
}

/** A figure's ink split into its words, each in layout coordinates. */
export interface FigureWords {
  frame: SigilFrame;
  /** Index `i` is the ink of word `i` (reading order); trailing empties are dropped. */
  words: InkPiece[][];
  issues: string[];
}

/**
 * The ink of `svg` by word region (`SigilFrame`), translated back into the
 * layout's coordinates. Ink in no region, or crossing from one region into
 * another, is an issue; such a piece is kept with the region of its first
 * point so the rest of the oracle still sees it.
 */
export function figureWords(
  svg: string,
  layout: SigilGeometry,
  frame: SigilFrame = sigilFrame(layout),
): FigureWords {
  const parsed = parseFigureSvg(svg);
  const issues = [...parsed.issues];
  const words: InkPiece[][] = [];
  const regionOf = (p: Point): number | null => {
    const index = Math.round((frame.center.x - p.x) / frame.pitch);
    const offset = wordOffset(frame, index);
    const dx = p.x - offset.x - frame.center.x;
    const dy = p.y - offset.y - frame.center.y;
    if (
      index < 0 ||
      Math.abs(dx) > frame.pitch / 2 ||
      Math.abs(dy) > frame.pitch / 2
    )
      return null;
    return index;
  };
  for (const piece of parsed.pieces) {
    const regions = new Set(piece.points.map(regionOf));
    const first = regionOf(piece.points[0]);
    if (regions.has(null))
      issues.push(
        `ink at (${fmt(piece.points[0])}) lies outside every word's region`,
      );
    else if (regions.size > 1)
      issues.push(
        `ink crosses between word regions ${[...regions].sort().join(" and ")}`,
      );
    const index = first ?? [...regions].find((r) => r !== null) ?? null;
    if (index === null) continue;
    const offset = wordOffset(frame, index);
    while (words.length <= index) words.push([]);
    words[index].push({
      ...piece,
      points: piece.points.map((p) => ({
        x: p.x - offset.x,
        y: p.y - offset.y,
      })),
    });
  }
  return { frame, words, issues };
}

/** A point as `x,y` to three places, for messages. */
export function fmt(p: Point): string {
  return `${Math.round(p.x * 1000) / 1000},${Math.round(p.y * 1000) / 1000}`;
}
