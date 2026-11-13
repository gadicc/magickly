import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Chakras from "./Chakras.tsx";

const WIDTH = 91.414;
const HEIGHT = 83.244;
const MID = WIDTH / 2;
const ORDER = [
  "crown",
  "third-eye",
  "throat",
  "heart",
  "solar-plexus",
  "sacral",
  "root",
];

type Point = [number, number];

/** The figure's paths' `d`s and the chakras' circles, from markup. */
function parse(markup: string) {
  const paths = [
    ...markup.matchAll(/<path fill="#000"( fill-rule="evenodd")? d="([^"]+)"/g),
  ].map(([, evenOdd, d]) => ({ evenOdd: !!evenOdd, d }));
  const circles = [
    ...markup.matchAll(
      /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="([^"]+)" opacity="([\d.]+)"/g,
    ),
  ].map(([, cx, cy, r, fill, opacity]) => ({
    cx: Number(cx),
    cy: Number(cy),
    r: Number(r),
    fill,
    opacity: Number(opacity),
  }));
  return { paths, circles };
}

/**
 * A path's closed outlines as polygons, its cubic Béziers sampled. The
 * figure's paths use only absolute M, C and Z.
 */
function outlines(d: string) {
  const polygons: Point[][] = [];
  let polygon: Point[] = [];
  for (const [, command, args] of d.matchAll(/([MCZ])([^MCZ]*)/g)) {
    const n = args.trim()
      ? args
          .trim()
          .split(/[\s,]+/)
          .map(Number)
      : [];
    if (command === "M") polygon = [[n[0], n[1]]];
    else if (command === "C") {
      const [x0, y0] = polygon[polygon.length - 1];
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        const u = 1 - t;
        const bez = (a: number, b: number, c: number, e: number) =>
          u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * e;
        polygon.push([bez(x0, n[0], n[2], n[4]), bez(y0, n[1], n[3], n[5])]);
      }
    } else polygons.push(polygon);
  }
  return polygons;
}

/** Whether a point is inside a polygon (even-odd crossings). */
function inside([x, y]: Point, polygon: Point[]) {
  let within = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      within = !within;
  }
  return within;
}

describe("Chakras", () => {
  const markup = renderToStaticMarkup(<Chakras height="80px" />);
  const { paths, circles } = parse(markup);
  const shapes = paths.map(({ d }) => outlines(d));
  const figure = shapes.flat();
  /**
   * Whether a point is filled: inside an odd number of a path's outlines,
   * which is what both rules give for these paths (the body is one
   * outline; the arms' rings are holes under evenodd).
   */
  const onBody = (point: Point) =>
    shapes.some(
      (polygons) =>
        polygons.filter((polygon) => inside(point, polygon)).length % 2 === 1,
    );

  it("draws a figure and the seven chakras, crown to root, on its midline", () => {
    expect(markup).toContain(`viewBox="0 0 ${WIDTH} ${HEIGHT}"`);
    expect(markup).toContain('height="80px"');
    expect(paths.map((path) => path.evenOdd)).toEqual([false, true]);
    // The body; each arm and the ring its thumb and index finger make.
    expect(shapes.map((polygons) => polygons.length)).toEqual([1, 4]);
    expect(circles).toHaveLength(ORDER.length);
    for (const circle of circles) {
      expect(circle.cx).toBeCloseTo(MID, 3);
      expect(circle.opacity).toBe(1);
    }
    const heights = circles.map((circle) => circle.cy);
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
  });

  it("keeps the figure inside the view box and symmetric about its midline", () => {
    for (const polygon of figure)
      for (const [x, y] of polygon) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(WIDTH);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(HEIGHT);
      }
    const points = figure.flat();
    const unmatched = points.filter(
      ([x, y]) =>
        !points.some(
          ([u, v]) =>
            Math.abs(u - (2 * MID - x)) < 1e-6 && Math.abs(v - y) < 1e-6,
        ),
    );
    expect(unmatched).toEqual([]);
  });

  it("puts every chakra on the body, the crown's on top of the head", () => {
    const [crown, ...rest] = circles;
    for (const { cx, cy } of rest) expect(onBody([cx, cy])).toBe(true);
    // The crown's centre is above the head, and its circle reaches it.
    expect(onBody([crown.cx, crown.cy])).toBe(false);
    expect(onBody([crown.cx, crown.cy + crown.r])).toBe(true);
    expect(crown.cy - crown.r).toBeGreaterThanOrEqual(0);
  });

  it("leaves each hand's ring open", () => {
    const [, rings] = shapes;
    for (const ring of [rings[1], rings[3]]) {
      const xs = ring.map(([x]) => x);
      const ys = ring.map(([, y]) => y);
      const centre: Point = [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
      ];
      expect(onBody(centre)).toBe(false);
      // Just outside the hole is the hand.
      expect(onBody([centre[0], Math.max(...ys) + 0.2])).toBe(true);
    }
  });

  it("dims every chakra but the active one", () => {
    for (const [index, id] of ORDER.entries()) {
      const lit = parse(renderToStaticMarkup(<Chakras active={id} />)).circles;
      expect(lit.map((circle) => circle.opacity)).toEqual(
        ORDER.map((_, i) => (i === index ? 1 : 0.2)),
      );
    }
  });
});
