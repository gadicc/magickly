/**
 * The Golden Dawn rose as a sigil layout (plan 088): each of its 22
 * letters is a place, at its centre on the version's rose. Places are the
 * letters themselves; a final form takes its base letter's place (F5) and
 * anything else has none.
 */

import type { Point, SigilLayout, SigilProfile } from "../sigil/types.ts";
import { svgCoordinate } from "../svgCoordinate.ts";
import {
  letterPoint,
  roseLetters,
  roseRings,
  roseVersion,
} from "./roseSigilInternals.ts";

/**
 * How far a visit may move from a letter's centre and still read as that
 * letter: a 4.6-unit disc stays inside its ring's 10-unit band and clear
 * of every neighbour's.
 */
export const ROSE_SLACK = 4.6;

/**
 * The Golden Dawn's rules for the rose (plan 088, R1–R5). The noose
 * tolerance is provisional (decision 2): 1 unit puts nooses on Metatron's
 * Resh (0.23 units off its chord) and on the seven of the 72 names
 * ending האל, and on no corner.
 */
export const ROSE_SIGIL_PROFILE: SigilProfile = {
  id: "golden-dawn",
  nooseTolerance: 1,
};

const layouts = new Map<string, SigilLayout<string>>();

/**
 * The rose of `version` (the default's when not given or not a version)
 * as a layout. Anchors are rounded as SVG coordinates are, so every
 * engine plans and places from the same numbers.
 */
export function roseSigilLayout(version?: string): SigilLayout<string> {
  const id = roseVersion(version);
  const cached = layouts.get(id);
  if (cached) return cached;

  const places = roseRings(id).flat();
  const anchors = new Map<string, Point>(
    places.map((letter) => {
      const point = letterPoint(letter, id);
      return [letter, { x: svgCoordinate(point.x), y: svgCoordinate(point.y) }];
    }),
  );

  const layout: SigilLayout<string> = {
    place(token) {
      return roseLetters(token)[0] ?? null;
    },
    anchor(place) {
      const point = anchors.get(place);
      if (!point) throw new Error(`roseSigilLayout: no place ${place}`);
      return point;
    },
    slack() {
      return ROSE_SLACK;
    },
    placeAt(point) {
      for (const [letter, anchor] of anchors) {
        if (Math.hypot(point.x - anchor.x, point.y - anchor.y) <= ROSE_SLACK)
          return letter;
      }
      return null;
    },
    unit: 1,
    places,
  };
  layouts.set(id, layout);
  return layout;
}
