/**
 * The oracle's own test (plan 088, "The oracle is tested too"): a
 * scrambler that rewrites a figure's commands without changing its ink,
 * which neither O2 nor O3 may notice, and a mirrored rose for checking a
 * figure against the wrong layout. Known-good figures come from
 * `figureDrawer.ts`.
 */

import { svgCoordinate } from "../../svgCoordinate.ts";
import type { SigilLayout } from "../types.ts";
import {
  arcCentre,
  arcPoint,
  type PathSegment,
  parsePathData,
} from "./figure.ts";
import { pair, round } from "./figureDrawer.ts";

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
