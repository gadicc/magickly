import { describe, expect, it } from "vitest";
import { roseSigilLayout } from "../../gd/roseSigilLayout.ts";
import { svgCoordinate } from "../../svgCoordinate.ts";
import { kameaLayout } from "../kameaLayout.ts";
import type { SigilLayout } from "../types.ts";
import {
  kameaUnroundedAnchor,
  nearestRoundingBoundary,
  ROUNDING_MARGIN,
  roseUnroundedAnchor,
  roundingMargin,
} from "./anchors.ts";
import { CORPUS_ROSE_VERSIONS } from "./corpus.ts";
import { checkStability } from "./invariants.ts";
import { CORPUS_KAMEA_PLANETS } from "./kameaCorpus.ts";

const roundsTo = (
  layout: SigilLayout<never> | SigilLayout<string> | SigilLayout<number>,
  unrounded: (p: string) => { x: number; y: number },
) =>
  layout.places.every((place) => {
    const u = unrounded(place);
    const a = layout.anchor(place);
    return svgCoordinate(u.x) === a.x && svgCoordinate(u.y) === a.y;
  });

describe("anchors before rounding", () => {
  it("measures the distance to a rounding boundary", () => {
    expect(roundingMargin(0.0125)).toBe(0);
    expect(roundingMargin(0.012)).toBeCloseTo(0.0005, 12);
    expect(roundingMargin(-12.99038)).toBeCloseTo(0.00012, 12);
  });

  for (const version of CORPUS_ROSE_VERSIONS)
    it(`keeps every anchor of the ${version} rose clear of a boundary`, () => {
      const layout = roseSigilLayout(version);
      const unrounded = roseUnroundedAnchor(version);
      expect(roundsTo(layout, unrounded)).toBe(true);
      const nearest = nearestRoundingBoundary(layout.places, unrounded);
      // Mem's x, −12.990381…, 1.2e-4 from −12.9905.
      expect(nearest.margin).toBeGreaterThan(ROUNDING_MARGIN);
    });

  for (const planet of CORPUS_KAMEA_PLANETS)
    it(`keeps every cell of ${planet}'s square clear of a boundary`, () => {
      const layout = kameaLayout(planet);
      const unrounded = kameaUnroundedAnchor(Math.sqrt(layout.places.length));
      expect(roundsTo(layout, unrounded)).toBe(true);
      expect(
        nearestRoundingBoundary(layout.places, unrounded).margin,
      ).toBeGreaterThan(ROUNDING_MARGIN);
    });

  it("lets the 1-ulp check see an anchor at a boundary, which a nudge of the rounded value hides", async () => {
    // An anchor whose unrounded x is exactly halfway between two rounded values.
    const unrounded = () => ({ x: 0.0125, y: 1 });
    const layout: SigilLayout<string> = {
      place: (token) => token,
      anchor: () => ({ x: svgCoordinate(0.0125), y: 1 }),
      slack: () => 1,
      placeAt: () => "a",
      unit: 1,
      places: ["a"],
    };
    // A drawing that rounds what it is given, as an engine's SVG does.
    const draw = (_: string, l: SigilLayout<string>) =>
      `${svgCoordinate(l.anchor("a").x)}`;
    expect(await checkStability(draw, "a", layout)).toEqual({
      stable: true,
      changed: [],
    });
    expect(
      await checkStability(draw, "a", layout, {
        unrounded,
        quantise: svgCoordinate,
      }),
    ).toEqual({ stable: false, changed: ["down"] });
  });

  it("refuses unrounded anchors that do not round to the layout's", async () => {
    const layout = roseSigilLayout();
    await expect(
      checkStability(() => "", "א", layout, {
        unrounded: roseUnroundedAnchor("regardie1939"),
        quantise: svgCoordinate,
      }),
    ).rejects.toThrow("does not round to the layout's");
  });
});
