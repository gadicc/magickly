import { describe, expect, it } from "vitest";
import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "../../gd/roseSigilLayout.ts";
import {
  FIGURE_GRAMMAR,
  figureWords,
  parseFigureSvg,
  parsePathData,
  sigilFrame,
} from "./figure.ts";
import { drawPlaced, placeSimply } from "./figureDrawer.ts";
import { inkShapes } from "./figureShapes.ts";
import { planetKameaLayout } from "./kameaLayout.ts";
import { referencePlan, referenceWords } from "./referencePlan.ts";

const rose = roseSigilLayout();
const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100" fill="none" stroke="red">${body}</svg>`;

describe("the figure frame", () => {
  it("bounds the rose at its outer ring, with today's viewBox as a word's region", () => {
    expect(sigilFrame(rose)).toEqual({
      center: { x: 0, y: 0 },
      radius: 40,
      pitch: 100,
      unit: 1,
    });
  });

  it("scales with a kamea's cells", () => {
    const saturn = planetKameaLayout("saturn");
    const frame = sigilFrame(saturn);
    expect(frame.unit).toBe(saturn.unit);
    expect(frame.pitch).toBeCloseTo(
      2 * frame.radius + 2 * FIGURE_GRAMMAR.wordMargin * saturn.unit,
    );
  });
});

describe("path data", () => {
  it("resolves relative commands, H/V, Z, packed arc flags and reflections", () => {
    const segments = parsePathData(
      "m1 1 h2 v2 l-1,1 z M0 0 a1 1 0 01 2 0 S 3 3 4 4 T 6 6",
    );
    expect(segments.map((s) => s.type)).toEqual([
      "M",
      "L",
      "L",
      "L",
      "L",
      "M",
      "A",
      "C",
      "Q",
    ]);
    expect(segments[4]).toEqual({
      type: "L",
      from: { x: 2, y: 4 },
      to: { x: 1, y: 1 },
    });
    expect(segments[6]).toMatchObject({
      large: false,
      sweep: true,
      to: { x: 2, y: 0 },
    });
  });

  it("reads numbers run together as SVG writes them", () => {
    const [, line] = parsePathData("M.5.5L-1-2");
    expect(line).toEqual({
      type: "L",
      from: { x: 0.5, y: 0.5 },
      to: { x: -1, y: -2 },
    });
  });
});

describe("parseFigureSvg", () => {
  it("reads stroked ink under transforms and reports what the grammar has no place for", () => {
    const parsed = parseFigureSvg(
      svg(
        `<g transform="translate(10 0) scale(2)"><path d="M0,0 L1,0"/></g><circle cx="0" cy="0" r="1"/><text>x</text><path fill="red" d="M0,0 L0,1"/><path stroke="none" d="M5,5 L6,6"/>`,
      ),
    );
    expect(parsed.pieces[0]).toEqual({
      kind: "line",
      points: [
        { x: 10, y: 0 },
        { x: 12, y: 0 },
      ],
      closed: false,
    });
    expect(parsed.pieces[1]).toMatchObject({ kind: "curve", closed: true });
    expect(parsed.pieces).toHaveLength(3);
    expect(parsed.issues).toEqual([
      "<text> is not ink the figure grammar allows",
      "a filled <path>; sigil ink is stroked only",
    ]);
  });

  it("treats a curve whose samples lie on its chord as a line", () => {
    const [piece] = parseFigureSvg(svg(`<path d="M0,0 C1,0 2,0 3,0"/>`)).pieces;
    expect(piece.kind).toBe("line");
  });
});

describe("figureWords", () => {
  it("splits words by region, right to left, into layout coordinates", () => {
    const { words, issues } = figureWords(
      svg(
        `<path d="M0,0 L1,0"/><path d="M-100,5 L-99,5"/><path d="M45,0 L55,0"/>`,
      ),
      rose,
    );
    expect(words[0][0].points[0]).toEqual({ x: 0, y: 0 });
    expect(words[1][0].points[0]).toEqual({ x: 0, y: 5 });
    expect(issues).toEqual(["ink at (45,0) lies outside every word's region"]);
  });
});

describe("inkShapes", () => {
  it("merges a line split or drawn twice, keeping the overlap apart only when asked", () => {
    const { pieces } = parseFigureSvg(
      svg(`<path d="M0,0 L2,0 M4,0 L2,0 M0,0 L4,0"/>`),
    );
    expect(inkShapes(pieces, 1, true).lines).toHaveLength(1);
    expect(inkShapes(pieces, 1, false).lines).toHaveLength(2);
  });

  it("joins an arc split in two but keeps cups meeting in a cusp apart", () => {
    const { pieces } = parseFigureSvg(
      svg(
        // A circle as two arcs, drawn in pieces and out of order; then a wave of two cups.
        `<path d="M2,0 A1,1 0 0,1 0,0 M0,0 A1,1 0 0,1 2,0 M10,0 A1,1 0 0,1 12,0 A1,1 0 0,1 14,0"/>`,
      ),
    );
    const shapes = inkShapes(pieces, 1, true);
    expect(shapes.loops).toHaveLength(1);
    expect(shapes.loops[0].center.x).toBeCloseTo(1, 2);
    expect(shapes.loops[0].radius).toBeCloseTo(1, 2);
    expect(shapes.waves).toHaveLength(1);
    expect(shapes.waves[0].cups).toHaveLength(2);
    expect(shapes.waves[0].sidesAgree).toBe(true);
    expect(shapes.unknown).toEqual([]);
  });

  it("finds Metatron's start circle, noose and crook in the simple drawer's figure", () => {
    const plan = referencePlan(
      referenceWords("מטטרון"),
      rose,
      ROSE_SIGIL_PROFILE,
    );
    const { words } = figureWords(
      drawPlaced(placeSimply(plan, rose), rose),
      rose,
    );
    const shapes = inkShapes(words[0], 1, true);
    const radii = shapes.loops.map((l) => l.radius).sort();
    expect(radii[0]).toBeCloseTo(1.25, 1);
    expect(radii[1]).toBeCloseTo(1.5, 1);
    expect(shapes.waves.map((w) => w.cups.length)).toEqual([2]);
    expect(shapes.unknown).toEqual([]);
  });
});
