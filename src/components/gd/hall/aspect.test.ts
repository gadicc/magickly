import { describe, expect, it } from "vitest";
import {
  ASPECT_RANGE,
  CAPTION_LINE,
  COMPASS_LETTER_DEPTH,
  estimateHallAspect,
  HEBREW_LETTER_SCALE,
  LABEL_LINE,
} from "./aspect";
import { COORDINATE_RANGE } from "./dimensions";
import { compassFont, LABEL_SIZE, LINE_HEIGHT } from "./labels";
import {
  CAPTION_SIZE,
  COMPASS_SIZE,
  DEFAULT_SCALES,
  resolveHall,
} from "./layout";
import type { HallNode } from "./types";

const drawn = (hall: HallNode) => {
  const { viewBox } = resolveHall(hall);
  return (viewBox.x1 - viewBox.x0) / (viewBox.y1 - viewBox.y0);
};

describe("estimateHallAspect", () => {
  it("uses the layout's own figures", () => {
    expect(COMPASS_LETTER_DEPTH).toBeCloseTo(
      (compassFont.top + compassFont.bottom) * COMPASS_SIZE,
      3,
    );
    expect(LABEL_LINE).toBe(LABEL_SIZE);
    expect(CAPTION_LINE).toBe(CAPTION_SIZE * LINE_HEIGHT);
    expect(HEBREW_LETTER_SCALE).toBe(DEFAULT_SCALES.get("hebrewLetter"));
  });

  it.each([
    ["an empty hall", { type: "gdHall" }],
    ["no dais", { type: "gdHall", dais: 0 }],
    ["no compass", { type: "gdHall", compass: false }],
    ["margins", { type: "gdHall", margin: 1, marginWest: 3 }],
    ["padding", { type: "gdHall", padding: 2 }],
    [
      "a caption",
      { type: "gdHall", children: [{ type: "caption", text: "A hall" }] },
    ],
    [
      "an officer beyond the West wall",
      {
        type: "gdHall",
        children: [
          {
            type: "floor",
            children: [{ type: "officer", role: "sentinel", x: 14, y: 17.2 }],
          },
        ],
      },
    ],
  ] as [string, HallNode][])("comes within 2 %% for %s", (_name, hall) => {
    expect(Math.abs(estimateHallAspect(hall) / drawn(hall) - 1)).toBeLessThan(
      0.02,
    );
  });

  const officerAt = (x: number, y: number): HallNode => ({
    type: "gdHall",
    children: [
      {
        type: "floor",
        children: [{ type: "officer", role: "sentinel", x, y }],
      },
    ],
  });

  it.each([
    ["y = 1e4", 8, 1e4],
    ["y = 1e6", 8, 1e6],
    ["y = -1e6", 8, -1e6],
    ["x = 1e5", 1e5, 8],
    ["x = -1e5", -1e5, 8],
  ])("clamps far coordinates as the layout does: %s", (_name, x, y) => {
    const hall = officerAt(x, y);
    const aspect = estimateHallAspect(hall);
    expect(aspect).toBeGreaterThanOrEqual(ASPECT_RANGE[0]);
    expect(aspect).toBeLessThanOrEqual(ASPECT_RANGE[1]);
    // The layout clamps the officer to COORDINATE_RANGE too, so the
    // estimate still follows the drawing, within the aspect range.
    const expected = Math.min(
      Math.max(drawn(hall), ASPECT_RANGE[0]),
      ASPECT_RANGE[1],
    );
    expect(Math.abs(aspect / expected - 1)).toBeLessThan(0.02);
  });

  it("keeps the shape within its range at the coordinate range's ends", () => {
    const [low, high] = COORDINATE_RANGE;
    const row = (xs: number[], y: number) =>
      xs.map((x) => ({ type: "item", kind: "cup", x, y, scale: 10 }));
    for (const children of [
      row([low, high], 8),
      [...row([8], low), ...row([8], high)],
    ]) {
      const aspect = estimateHallAspect({
        type: "gdHall",
        children: [{ type: "floor", children }],
      });
      expect(aspect).toBeGreaterThanOrEqual(ASPECT_RANGE[0]);
      expect(aspect).toBeLessThanOrEqual(ASPECT_RANGE[1]);
    }
  });

  it("never throws on hostile content", () => {
    for (const hall of [
      { type: "gdHall", children: "x" },
      { type: "gdHall", children: [null, 1, "x", [], { type: "floor" }] },
      { type: "gdHall", dais: "abc", padding: "1e999", margin: Number.NaN },
      {
        type: "gdHall",
        children: [
          { type: "floor", children: [{ type: "officer", x: 1e300, y: 1 }] },
          { type: "banners", children: [{ type: "banner", scale: "x" }] },
        ],
      },
    ] as unknown as HallNode[]) {
      const aspect = estimateHallAspect(hall);
      expect(Number.isFinite(aspect) && aspect > 0, JSON.stringify(hall)).toBe(
        true,
      );
      expect(aspect).toBeGreaterThanOrEqual(ASPECT_RANGE[0]);
      expect(aspect).toBeLessThanOrEqual(ASPECT_RANGE[1]);
    }
  });
});
