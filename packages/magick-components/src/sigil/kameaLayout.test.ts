import { traceHebrew } from "magick-data/astrology/aiqBekar";
import kameas, { KAMEA_PLANETS } from "magick-data/astrology/kameas";
import { describe, expect, it } from "vitest";
import {
  KAMEA_FRAME_WIDTH,
  KAMEA_RULE_WIDTH,
  KAMEA_SIDE,
  kameaGeometry,
} from "../astrology/kameaGeometry.ts";
import { sigilFrame, sigilViewBox } from "./ink.ts";
import {
  KAMEA_CELL_UNITS,
  KAMEA_LINE_RUN,
  KAMEA_SIGIL_PITCH,
  KAMEA_SIGIL_PROFILE,
  KAMEA_SIGIL_SIZE_FLOOR,
  KAMEA_SIGIL_STROKE_WIDTH,
  kameaLayout,
  kameaSigilMinSize,
} from "./kameaLayout.ts";
import { placeSigilWords, wordFailures } from "./placeSigil.ts";
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
    // The grid's rule (Gadi, 21 November 2026).
    expect(KAMEA_SIGIL_STROKE_WIDTH).toBe(KAMEA_RULE_WIDTH);
    expect(String(KAMEA_SIGIL_STROKE_WIDTH)).toBe("0.6");
  });

  it("gives placement the rules and the frame KameaFigure draws, and a cell's run along one", () => {
    for (const planet of KAMEA_PLANETS) {
      const layout = kameaLayout(planet);
      const order = Math.sqrt(layout.places.length);
      const { rules } = kameaGeometry(order);
      const lines = layout.lines ?? [];
      expect(lines).toHaveLength(2 * (order - 1) + 4);
      for (const line of lines) {
        // Down or across the whole square, at a rule or the frame.
        const down = line.a.x === line.b.x;
        const at = down ? line.a.x : line.a.y;
        const frame = Math.abs(at) === KAMEA_SIDE / 2;
        expect(line.width).toBe(frame ? KAMEA_FRAME_WIDTH : KAMEA_RULE_WIDTH);
        if (!frame)
          expect(rules.some((r) => Math.abs(r - at) < 0.001)).toBe(true);
        expect(down ? [line.a.y, line.b.y] : [line.a.x, line.b.x]).toEqual([
          -48, 48,
        ]);
      }
      expect(lines.filter((l) => l.width === KAMEA_FRAME_WIDTH)).toHaveLength(
        4,
      );
    }
    expect(KAMEA_LINE_RUN).toBe(KAMEA_CELL_UNITS);
    expect(KAMEA_SIGIL_PROFILE.placement?.lineRun).toBe(KAMEA_LINE_RUN);
  });

  it("fails a stroke that runs along a rule for more than a cell", () => {
    // Yod 10 and Lamed 30, five rows apart in the Moon's fourth column,
    // drawn a share of a cell towards the rule on its right.
    const luna = kameaLayout("luna");
    const [word] = planSigil(sigilWords("יל"), luna, KAMEA_SIGIL_PROFILE);
    const cell = KAMEA_SIDE / 9;
    const at = (share: number) =>
      word.map((v) => {
        const a = luna.anchor(v.place);
        return { ...v, point: { x: a.x + share * cell, y: a.y } };
      });
    const runs = (share: number) =>
      wordFailures(at(share), luna, KAMEA_SIGIL_PROFILE).filter(
        (f) => f.check === "line-run",
      );
    // 0.53 of the square's units from the rule: inside the 0.6 where the
    // inks touch, for five cells.
    expect(runs(0.45)).toHaveLength(1);
    // Five cells less the one allowed, less the start circle's radius
    // where the stroke leaves its rim.
    expect(runs(0.45)[0].excess).toBeGreaterThan(4 * KAMEA_CELL_UNITS - 2.5);
    expect(runs(0.45)[0].excess).toBeLessThanOrEqual(4 * KAMEA_CELL_UNITS);
    // 0.57 from it: clear.
    expect(runs(0.44)).toEqual([]);
    // Without the setting, nothing is checked.
    const plain = {
      ...KAMEA_SIGIL_PROFILE,
      placement: { ...KAMEA_SIGIL_PROFILE.placement, lineRun: undefined },
    } as typeof KAMEA_SIGIL_PROFILE;
    expect(
      wordFailures(at(0.45), luna, plain).filter((f) => f.check === "line-run"),
    ).toEqual([]);
  });

  it("places 1651's Malcha off the rules it ran along before", () => {
    const luna = kameaLayout("luna");
    const plan = planSigil(sigilWords("בתרשיסים"), luna, KAMEA_SIGIL_PROFILE);
    const [placed] = placeSigilWords(plan, luna, KAMEA_SIGIL_PROFILE);
    expect(placed.failures).toEqual([]);
  });

  it("draws a word's figure at 1.25 pixels a unit or more, and never under 240", () => {
    const sizes = Object.fromEntries(
      KAMEA_PLANETS.map((planet) => [planet, kameaSigilMinSize(planet)]),
    );
    expect(sizes).toEqual({
      saturn: 240,
      jupiter: 240,
      mars: 240,
      sol: 240,
      venus: 256,
      mercury: 292,
      luna: 329,
    });
    for (const planet of KAMEA_PLANETS) {
      const unit = kameaLayout(planet).unit;
      const pixelsPerUnit = (size: number) => (size / KAMEA_SIGIL_PITCH) * unit;
      expect(pixelsPerUnit(sizes[planet])).toBeGreaterThanOrEqual(1.25);
      if (sizes[planet] > KAMEA_SIGIL_SIZE_FLOOR)
        expect(pixelsPerUnit(sizes[planet] - 1)).toBeLessThan(1.25);
    }
    expect(() => kameaSigilMinSize("earth" as "saturn")).toThrow(RangeError);
  });
});
