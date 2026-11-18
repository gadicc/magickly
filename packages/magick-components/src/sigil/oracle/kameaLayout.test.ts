import { describe, expect, it } from "vitest";
import { kameaGeometry } from "../../astrology/Kamea.tsx";
import { kameaLayout, planetKameaLayout } from "./kameaLayout.ts";

describe("kamea stub layout", () => {
  const saturn = planetKameaLayout("saturn");
  const mercury = planetKameaLayout("mercury");

  it("places a number at the cell that holds it, row then column", () => {
    // Saturn's square, vol. 4 p. 81: 4 9 2 / 3 5 7 / 8 1 6.
    expect([7, 1, 3, 5].map((n) => saturn.place(n))).toEqual([
      "1,2",
      "2,1",
      "1,0",
      "1,1",
    ]);
    // Mercury's, p. 85: 8 at the top left, 40 starts the fifth row, 20
    // is fourth in the sixth.
    expect([8, 40, 20].map((n) => mercury.place(n))).toEqual([
      "0,0",
      "4,0",
      "5,3",
    ]);
  });

  it("leaves out what no cell holds", () => {
    expect(saturn.place(0)).toBeNull();
    expect(saturn.place(10)).toBeNull();
    expect(saturn.place(2.5)).toBeNull();
  });

  it("anchors each cell at KameaFigure's centre for it", () => {
    const { center } = kameaGeometry(3);
    expect(saturn.anchor("1,2")).toEqual({
      x: center(1, 2)[0],
      y: center(1, 2)[1],
    });
    expect(saturn.anchor("0,0")).toEqual({ x: -32, y: -32 });
    expect(() => saturn.anchor("3,0")).toThrow(/no cell/);
  });

  it("scales the unit and the slack with the cell", () => {
    expect(saturn.unit).toBe(3.2);
    expect(mercury.unit).toBe(1.2);
    expect(saturn.slack("1,1")).toBeCloseTo(14.72, 10);
    expect(mercury.slack("0,0")).toBeCloseTo(5.52, 10);
    // The slack's disc stays inside its cell.
    for (const layout of [saturn, mercury])
      expect(layout.slack(layout.places[0])).toBeLessThan(
        (layout.unit * 10) / 2,
      );
  });

  it("reads a point as the cell under it", () => {
    expect(saturn.placeAt({ x: 0, y: 0 })).toBe("1,1");
    expect(saturn.placeAt({ x: 47.9, y: -47.9 })).toBe("0,2");
    expect(saturn.placeAt({ x: -15.9, y: 15.9 })).toBe("1,1");
    expect(saturn.placeAt({ x: 48.1, y: 0 })).toBeNull();
    for (const place of mercury.places)
      expect(mercury.placeAt(mercury.anchor(place))).toBe(place);
  });

  it("lists every cell once", () => {
    expect(saturn.places).toHaveLength(9);
    expect(new Set(mercury.places).size).toBe(64);
  });

  it("takes any square", () => {
    const layout = kameaLayout([
      [1, 2],
      [3, 4],
    ]);
    expect(layout.place(4)).toBe("1,1");
    expect(layout.unit).toBe(4.8);
  });
});
