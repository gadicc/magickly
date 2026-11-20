/**
 * The anchors before rounding (plan 088, O2's 1-ulp check). Layouts round
 * their anchors to the SVG's 0.001 so every engine places from the same
 * numbers, which also erases a one-ulp nudge of the rounded value. The
 * real risk is upstream: an anchor whose unrounded value (trig on the
 * rose, a division on a kamea) lies so near a rounding boundary that
 * engines' last-bit differences round it two ways. This module recomputes
 * the unrounded anchors and measures how far each lies from a boundary.
 */

import { kameaGeometry } from "../../astrology/kameaGeometry.ts";
import { letterPoint } from "../../gd/roseSigilInternals.ts";
import { SVG_COORDINATE_DECIMALS } from "../../svgCoordinate.ts";
import type { PlaceId, Point } from "../types.ts";

/** A layout's anchor of `place` before rounding. */
export type UnroundedAnchor = (place: PlaceId) => Point;

/**
 * How near an unrounded anchor may lie to a rounding boundary. Engines'
 * trig differs in the last bit, about 1e-14 at the rose's 35 units; a
 * millionth leaves eight orders of magnitude for that and for any honest
 * change in how an anchor is computed.
 */
export const ROUNDING_MARGIN = 1e-6;

/** The rose's anchors before rounding, recomputed from `letterPoint`. */
export function roseUnroundedAnchor(version?: string): UnroundedAnchor {
  return (place) => letterPoint(place, version);
}

/**
 * A kamea's anchors before rounding: cell centres as `kameaGeometry`
 * computes them, for places `"row,column"`.
 */
export function kameaUnroundedAnchor(order: number): UnroundedAnchor {
  const { center } = kameaGeometry(order);
  return (place) => {
    const [row, column] = place.split(",").map(Number);
    const [x, y] = center(row, column);
    return { x, y };
  };
}

/** How far `value` lies from the nearest boundary between two rounded values. */
export function roundingMargin(
  value: number,
  decimals = SVG_COORDINATE_DECIMALS,
): number {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.floor(scaled) - 0.5) / 10 ** decimals;
}

/** The anchor coordinate nearest a rounding boundary. */
export interface NearestBoundary {
  place: PlaceId;
  axis: "x" | "y";
  value: number;
  margin: number;
}

/** Of `places`' unrounded anchors, the coordinate nearest a rounding boundary. */
export function nearestRoundingBoundary(
  places: readonly PlaceId[],
  unrounded: UnroundedAnchor,
): NearestBoundary {
  let nearest: NearestBoundary = {
    place: places[0],
    axis: "x",
    value: Number.NaN,
    margin: Number.POSITIVE_INFINITY,
  };
  for (const place of places) {
    const p = unrounded(place);
    for (const axis of ["x", "y"] as const) {
      const margin = roundingMargin(p[axis]);
      if (margin < nearest.margin)
        nearest = { place, axis, value: p[axis], margin };
    }
  }
  return nearest;
}
