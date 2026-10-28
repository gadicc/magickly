import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { describe, expect, it } from "vitest";
import { parseHallSource } from "@/doc/gdHallPug";
import { gdHallSource } from "@/doc/gdHallRows";
import { hallNodeCount, MAX_KEPT_HALL_NODES, tooManyNodes } from "./hallLimits";

const markers = (count: number) =>
  parseHallSource(
    `gdHall\n  floor\n${'    marker(text="a", x=1, y=1)\n'.repeat(count)}`,
  );

describe("the limits of a kept or shared hall", () => {
  it("counts every node of a hall, itself included", () => {
    // The hall, its floor and the markers.
    expect(hallNodeCount(markers(3))).toBe(5);
    expect(
      hallNodeCount(parseHallSource('gdHall\n  caption(text="T")\n  //- a\n')),
    ).toBe(3);
  });

  it("keeps every preset, and refuses a hall of more nodes", () => {
    for (const preset of HALL_PRESETS)
      expect(tooManyNodes(gdHallSource(preset.hall)), preset.id).toBe(false);
    expect(tooManyNodes(markers(MAX_KEPT_HALL_NODES - 2))).toBe(false);
    expect(tooManyNodes(markers(MAX_KEPT_HALL_NODES - 1))).toBe(true);
  });
});
