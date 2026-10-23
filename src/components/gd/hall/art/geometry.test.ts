import { describe, expect, it } from "vitest";
import {
  flipped,
  mirrored,
  pathPoint,
  points,
  polar,
  smoothPath,
  triangle,
} from "./geometry";

describe("the art's geometry helpers", () => {
  it("writes points and triangles rounded", () => {
    expect(points([[1 / 3, -2]])).toBe("0.333,-2");
    expect(triangle(10, "up")).toBe("0,-10 -8.66,5 8.66,5");
    expect(pathPoint([1 / 3, -0.004])).toBe("0.33,0");
  });

  it("mirrors a lathe profile into a closed outline", () => {
    expect(
      mirrored(
        [0, -10],
        [
          { to: [10, -10] },
          { c1: [10, 0], c2: [5, 5], to: [2, 5] },
          { q: [2, 8], to: [6, 10] },
          { to: [0, 10] },
        ],
      ),
    ).toBe(
      "M0,-10L10,-10C10,0 5,5 2,5Q2,8 6,10L0,10" +
        "L-6,10Q-2,8 -2,5C-5,5 -10,0 -10,-10L0,-10Z",
    );
  });

  it("draws a smooth path through every point", () => {
    const d = smoothPath([
      [0, 0],
      [10, 0],
      [20, 10],
    ]);
    expect(d).toMatch(/^M0,0C[^C]+ 10,0C[^C]+ 20,10$/);
  });

  it("measures angles clockwise from East", () => {
    const [x, y] = polar(10, 90, [1, 1]);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(11);
  });

  it("flips a path left to right", () => {
    expect(flipped("M3,-37C9,-45 20,-50 33,-49Z")).toBe(
      "M-3,-37C-9,-45 -20,-50 -33,-49Z",
    );
  });
});
