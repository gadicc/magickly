import { traceHebrew } from "magick-data/astrology/aiqBekar";
import kameas, { KAMEA_PLANETS } from "magick-data/astrology/kameas";
import { describe, expect, it } from "vitest";
import { KAMEA_SIDE, kameaGeometry } from "../astrology/kameaGeometry.ts";
import { svgCoordinate } from "../svgCoordinate.ts";
import { sigilFrame, sigilViewBox } from "./ink.ts";
import {
  KAMEA_CELL_UNITS,
  KAMEA_SIGIL_PROFILE,
  KAMEA_SIGIL_STROKE_WIDTH,
  kameaLayout,
} from "./kameaLayout.ts";
import { planSigil, sigilWords } from "./planSigil.ts";

describe("kamea layout", () => {
  const saturn = kameaLayout("saturn");
  const mercury = kameaLayout("mercury");

  it("places a letter at the cell of its value reduced by Aiq Bekar, row then column", () => {
    // Saturn's square, vol. 4 p. 81: 4 9 2 / 3 5 7 / 8 1 6. Zazel: Zayin
    // 7, Aleph 1, Zayin 7, Lamed 30 as 3 (pp. 79–80).
    expect([..."זאזל"].map((c) => saturn.place(c))).toEqual([
      "1,2",
      "2,1",
      "1,2",
      "1,0",
    ]);
    // Mercury's: Taphthartharath's Tau 400 as 40 (the fifth row's first
    // cell), Peh 80 as 8 (top left), Resh 200 as 20 (fourth in the sixth).
    expect([..."תפר"].map((c) => mercury.place(c))).toEqual([
      "4,0",
      "0,0",
      "5,3",
    ]);
  });

  it("traces what magick-data's traceHebrew traces, on every square", () => {
    const text = "אבגדהוזחטיכלמנסעפצקרשתךםןףץ";
    for (const planet of KAMEA_PLANETS)
      for (const finals of [false, true]) {
        const layout = kameaLayout(planet, { finals });
        const cellOf = new Map<number, string>();
        kameas[planet].forEach((row, r) =>
          row.forEach((n, c) => cellOf.set(n, `${r},${c}`)),
        );
        const [numbers] = traceHebrew(text, planet, { finals });
        expect([...text].map((c) => layout.place(c))).toEqual(
          numbers.map((n) => cellOf.get(n)),
        );
      }
  });

  it("counts finals at their ordinary letters' values unless asked", () => {
    const luna = kameaLayout("luna");
    const finals = kameaLayout("luna", { finals: true });
    expect(luna.place("ם")).toBe(luna.place("מ"));
    // Mem final 600 is 60 on the Moon's 81 cells, Samekh's cell.
    expect(finals.place("ם")).toBe(luna.place("ס"));
    expect(finals).not.toBe(luna);
  });

  it("leaves out what is not a letter", () => {
    for (const token of [" ", "־", "ָ", "a", "1", ""])
      expect(saturn.place(token)).toBeNull();
    expect(planSigil(sigilWords("ז־א"), saturn, KAMEA_SIGIL_PROFILE)).toEqual(
      planSigil(sigilWords("זא"), saturn, KAMEA_SIGIL_PROFILE),
    );
  });

  it("refuses a planet without a square", () => {
    expect(() => kameaLayout("earth" as "saturn")).toThrow(RangeError);
    expect(() => kameaLayout("constructor" as "saturn")).toThrow(RangeError);
  });

  it("is the same object each time, so placement's cache serves every caller", () => {
    expect(kameaLayout("saturn")).toBe(saturn);
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
    expect(saturn.unit).toBeCloseTo(32 / KAMEA_CELL_UNITS, 12);
    expect(mercury.unit).toBeCloseTo(12 / KAMEA_CELL_UNITS, 12);
    // The slack's disc stays inside its cell.
    for (const planet of KAMEA_PLANETS) {
      const layout = kameaLayout(planet);
      const cell = KAMEA_SIDE / Math.sqrt(layout.places.length);
      for (const place of layout.places)
        expect(layout.slack(place)).toBeLessThan(cell / 2);
    }
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

  it("bounds a word by the square, in Kamea's own viewBox", () => {
    for (const planet of KAMEA_PLANETS) {
      const layout = kameaLayout(planet);
      const frame = sigilFrame(layout);
      expect(frame).toEqual({
        center: { x: 0, y: 0 },
        radius: KAMEA_SIDE / 2,
        pitch: 100,
        shape: "square",
      });
      expect(sigilViewBox(frame, 1)).toEqual([-50, -50, 100, 100]);
      // A word's region holds its whole bound, so words never share ink.
      expect(frame.pitch).toBeGreaterThanOrEqual(2 * frame.radius);
      // Every cell's slack inside the square.
      for (const place of layout.places) {
        const a = layout.anchor(place);
        expect(
          Math.max(Math.abs(a.x), Math.abs(a.y)) + layout.slack(place),
        ).toBeLessThan(frame.radius);
      }
    }
  });

  it("draws with R4 at a twentieth of a cell and a stroke fixed against the square", () => {
    expect(KAMEA_SIGIL_PROFILE.nooseTolerance * saturn.unit).toBeCloseTo(
      0.05 * 32,
      12,
    );
    expect(KAMEA_SIGIL_PROFILE.strokeWidth).toBe(KAMEA_SIGIL_STROKE_WIDTH);
    // One unit of the finest square, as the SVG writes it, so the figure
    // grammar's one-stroke gaps still show there.
    expect(KAMEA_SIGIL_STROKE_WIDTH).toBe(
      svgCoordinate(kameaLayout("luna").unit),
    );
    expect(String(KAMEA_SIGIL_STROKE_WIDTH)).toBe("0.381");
  });
});
