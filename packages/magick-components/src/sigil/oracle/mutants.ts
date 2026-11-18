/**
 * The oracle's own test (plan 088, "The oracle is tested too"): known-good
 * figures, which must pass O2 and O3, and mutants of them, each of which
 * one or both must catch; a scrambler that rewrites a figure's commands
 * without changing its ink, which neither may notice; and a mirrored rose.
 * The figures come from `figureDrawer.ts`, a deliberately simple test-only
 * drawer, since no engine draws correct figures yet.
 */

import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "../../gd/roseSigilLayout.ts";
import { svgCoordinate } from "../../svgCoordinate.ts";
import type { Point, SigilLayout, SigilPlan } from "../types.ts";
import {
  arcCentre,
  arcPoint,
  type PathSegment,
  parsePathData,
} from "./figure.ts";
import {
  type DrawChoices,
  type DrawFaults,
  drawPlaced,
  pair,
  placeSimply,
  round,
} from "./figureDrawer.ts";
import { norm, sub } from "./figureShapes.ts";
import type { InvariantCheck } from "./invariants.ts";
import { KAMEA_STUB_PROFILE, planetKameaLayout } from "./kameaLayout.ts";
import { referencePlan, referenceWords } from "./referencePlan.ts";

function segmentText(seg: PathSegment): string {
  if (seg.type === "M") return "";
  if (seg.type === "L") return `M ${pair(seg.from)} L ${pair(seg.to)}`;
  if (seg.type === "C")
    return `M ${pair(seg.from)} C ${pair(seg.c1)} ${pair(seg.c2)} ${pair(seg.to)}`;
  if (seg.type === "Q")
    return `M ${pair(seg.from)} Q ${pair(seg.c)} ${pair(seg.to)}`;
  return `M ${pair(seg.from)} A ${seg.rx},${seg.ry} ${seg.rotation} ${seg.large ? 1 : 0},${seg.sweep ? 1 : 0} ${pair(seg.to)}`;
}

function reverse(seg: PathSegment): PathSegment {
  if (seg.type === "M") return seg;
  if (seg.type === "L") return { ...seg, from: seg.to, to: seg.from };
  if (seg.type === "C")
    return { ...seg, from: seg.to, c1: seg.c2, c2: seg.c1, to: seg.from };
  if (seg.type === "Q") return { ...seg, from: seg.to, to: seg.from };
  return { ...seg, from: seg.to, to: seg.from, sweep: !seg.sweep };
}

function split(seg: PathSegment): PathSegment[] {
  if (seg.type === "L") {
    const mid = round({
      x: (seg.from.x + seg.to.x) / 2,
      y: (seg.from.y + seg.to.y) / 2,
    });
    return [
      { ...seg, to: mid },
      { ...seg, from: mid },
    ];
  }
  if (seg.type === "A") {
    const arc = arcCentre(seg);
    if (!arc) return [seg];
    const mid = round(arcPoint(arc, arc.theta + arc.delta / 2));
    const large = Math.abs(arc.delta / 2) > Math.PI;
    // The scaled radii, so rounding the midpoint cannot make SVG rescale differently.
    const rx = svgCoordinate(arc.rx);
    const ry = svgCoordinate(arc.ry);
    return [
      { ...seg, rx, ry, large, to: mid },
      { ...seg, rx, ry, large, from: mid },
    ];
  }
  return [seg];
}

/** A small seeded generator, so a scramble is the same every run. */
function random(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 2 ** 32;
  };
}

/**
 * The same ink with its commands reordered, split and reversed: every
 * segment its own subpath, lines and arcs split in two, some reversed, all
 * shuffled. O2 and O3 must judge it as they judge the original.
 */
export function scrambleSvg(svg: string, seed = 1): string {
  const next = random(seed);
  const segments: PathSegment[] = [];
  for (const [, d] of svg.matchAll(/<path[^>]*\sd="([^"]*)"/g))
    for (const seg of parsePathData(d))
      if (seg.type !== "M") segments.push(seg);
  const pieces = segments
    .flatMap((seg) => (next() < 0.7 ? split(seg) : [seg]))
    .map((seg) => (next() < 0.5 ? reverse(seg) : seg))
    .map((seg) => ({ seg, key: next() }))
    .sort((a, b) => a.key - b.key)
    .map(({ seg }) => segmentText(seg));
  const open = svg.match(/^<svg[^>]*>/)?.[0] ?? "<svg>";
  // Two paths, so grouping by element is not preserved either.
  const half = Math.ceil(pieces.length / 2);
  return `${open}<path d="${pieces.slice(0, half).join(" ")}"/><path d="${pieces.slice(half).join(" ")}"/></svg>`;
}

/** The rose seen in a mirror: anchors and read-back flipped left to right. */
export function mirroredLayout(
  layout: SigilLayout<string>,
): SigilLayout<string> {
  return {
    ...layout,
    place: (token) => layout.place(token),
    anchor(place) {
      const a = layout.anchor(place);
      return { x: -a.x + 0, y: a.y };
    },
    slack: (place) => layout.slack(place),
    placeAt: (point) => layout.placeAt({ x: -point.x, y: point.y }),
  };
}

/** A figure with the plan and layout it is judged against. */
export interface JudgedFigure {
  svg: string;
  plan: SigilPlan;
  layout: SigilLayout<string> | SigilLayout<number>;
}

const rose = roseSigilLayout();
const planOf = (text: string) =>
  referencePlan(referenceWords(text), rose, ROSE_SIGIL_PROFILE);

function simple(
  text: string,
  options: {
    faults?: DrawFaults;
    choices?: DrawChoices;
    overrides?: (Point | undefined)[][];
    drawn?: string;
  } = {},
): JudgedFigure {
  const drawnPlan = planOf(options.drawn ?? text);
  return {
    svg: drawPlaced(
      placeSimply(drawnPlan, rose, options.overrides),
      rose,
      options.faults,
      options.choices,
    ),
    plan: planOf(text),
    layout: rose,
  };
}

/**
 * ללהאל placed by hand: the worst case, two strokes and a noose within the
 * slack at Aleph, with He and both Lameds at the edge of their slack.
 */
function lamedLamed(): JudgedFigure {
  const he = { x: 0, y: -30.45 };
  const lamed = { x: 4.488, y: 34.7 };
  const lamed2 = { x: -4.488, y: 34.7 };
  const t = (-15 - he.y) / (lamed2.y - he.y);
  const aleph = { x: he.x + (lamed2.x - he.x) * t, y: -15 };
  return simple("ללהאל", {
    overrides: [[lamed, he, aleph, lamed2]],
    choices: { nooseRight: [{ word: 0, vertex: 2 }] },
  });
}

/** מאאפש with Pe moved `dy` units down from its anchor. */
function crookedFigure(dy: number): JudgedFigure {
  const pe = rose.anchor("פ");
  return simple("מאאפש", {
    overrides: [[undefined, undefined, { x: pe.x, y: pe.y + dy }]],
  });
}

/**
 * אבהאל, whose second Aleph is a noose on the vertical between He and
 * Lamed, with its start circle at `start` and the noose to the right.
 */
function repassFigure(start: Point): JudgedFigure {
  return simple("אבהאל", {
    overrides: [[start]],
    choices: { nooseRight: [{ word: 0, vertex: 3 }] },
  });
}

/** Figures that follow the grammar and must pass O2 and O3. */
export const KNOWN_GOOD: readonly { id: string; figure: () => JudgedFigure }[] =
  [
    // Crook at Teth, noose at Resh (p. 58).
    { id: "metatron", figure: () => simple("מטטרון") },
    { id: "binah", figure: () => simple("בינה") },
    // F1: the return to He beside its first visit.
    { id: "yhvh", figure: () => simple("יהוה") },
    { id: "agiel", figure: () => simple("אגיאל") },
    { id: "yod-he-vau-he", figure: () => simple("יוד הא ואו הא") },
    // Two crooks at the first letter, a noose at Aleph.
    { id: "yod-yod-yod", figure: () => simple("יייאל") },
    { id: "he-he-he", figure: () => simple("הההאל") },
    { id: "lamed-lamed", figure: lamedLamed },
    { id: "aleph", figure: () => simple("א") },
    // A word ending beside its start, its bar clear of the start circle.
    { id: "vau-aleph-vau", figure: () => simple("ואו") },
    // Pe moved down within its slack, so Pe→Shin clears Aleph's cups.
    { id: "mem-aleph-aleph-pe-shin", figure: () => crookedFigure(4) },
    // The start circle moved 4 units right, clear of the return's noose.
    {
      id: "aleph-beth-he-aleph-lamed",
      figure: () => repassFigure({ x: 4, y: -15 }),
    },
    {
      id: "zazel-kamea",
      figure: () => {
        const layout = planetKameaLayout("saturn");
        const plan = referencePlan([[7, 1, 7, 3]], layout, KAMEA_STUB_PROFILE);
        return {
          svg: drawPlaced(placeSimply(plan, layout), layout),
          plan,
          layout,
        };
      },
    },
  ];

/** A broken figure, and which checks must catch it. */
export interface Mutant {
  id: string;
  caughtBy: readonly ("O2" | "O3")[];
  /** The O2 check that names the fault, where one was written for it. */
  check?: InvariantCheck;
  figure: () => JudgedFigure;
}

/**
 * Plan 088's mutants, each a known-good figure broken one way, and three
 * the reviews of the engine asked for: a bar through the start circle, a
 * stroke through a crook and a noose through the start circle.
 */
export const MUTANTS: readonly Mutant[] = [
  {
    id: "no bar",
    caughtBy: ["O2", "O3"],
    figure: () => simple("מטטרון", { faults: { noBar: true } }),
  },
  {
    id: "one cup of a crook missing",
    caughtBy: ["O2", "O3"],
    figure: () =>
      simple("מטטרון", { faults: { dropCup: { word: 0, vertex: 1 } } }),
  },
  {
    id: "a missing noose",
    caughtBy: ["O2", "O3"],
    figure: () =>
      simple("מטטרון", { faults: { dropNoose: { word: 0, vertex: 2 } } }),
  },
  {
    id: "a noose where none belongs",
    caughtBy: ["O2", "O3"],
    figure: () =>
      simple("בינה", { faults: { extraNoose: { word: 0, vertex: 1 } } }),
  },
  {
    id: "two strokes laid on each other",
    caughtBy: ["O2", "O3"],
    // The return to He drawn on its first visit, so Vau→He lies on He→Vau.
    figure: () =>
      simple("יהוה", {
        overrides: [[undefined, undefined, undefined, rose.anchor("ה")]],
      }),
  },
  {
    id: "the rose mirrored",
    caughtBy: ["O2", "O3"],
    figure: () => ({ ...simple("מטטרון"), layout: mirroredLayout(rose) }),
  },
  {
    id: "two letters swapped",
    // O2 finds no noose at Resh, which no longer lies on its chord; O3
    // reads the other order.
    caughtBy: ["O2", "O3"],
    figure: () => simple("מטטרון", { drawn: "מטטורן" }),
  },
  {
    id: "words joined",
    caughtBy: ["O2", "O3"],
    figure: () => simple("יוד הא ואו הא", { drawn: "יודהאואוהא" }),
  },
  {
    id: "a start circle at the wrong end",
    caughtBy: ["O2", "O3"],
    figure: () => simple("מטטרון", { faults: { startAtEnd: true } }),
  },
  {
    id: "the end bar through the start circle",
    caughtBy: ["O2", "O3"],
    check: "bar-clearance",
    // The return to Vau two units from its first visit, not four: the bar
    // at the end crosses the start circle.
    figure: () => {
      const vau = rose.anchor("ו");
      const aleph = rose.anchor("א");
      const across = norm(sub(aleph, vau));
      const back = { x: vau.x - across.y * 2, y: vau.y + across.x * 2 };
      return simple("ואו", { overrides: [[undefined, undefined, back]] });
    },
  },
  {
    id: "a stroke through a crook",
    caughtBy: ["O2", "O3"],
    check: "crook-clearance",
    // Pe moved up instead of down: Pe→Shin runs through Aleph's cups.
    figure: () => crookedFigure(-4),
  },
  {
    id: "a noose through the start circle",
    caughtBy: ["O2", "O3"],
    check: "loop-clearance",
    // The start circle left on Aleph's anchor, where the return's noose is.
    figure: () => repassFigure(rose.anchor("א")),
  },
];
