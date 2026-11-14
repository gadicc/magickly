import { describe, expect, it } from "vitest";
import {
  ARROW_PAN,
  arrowPan,
  clampScale,
  clampView,
  FOCUS_MARGIN,
  FOCUS_MIN_SCALE,
  fitDrawing,
  focusView,
  IDENTITY,
  isDoubleTap,
  MAX_SCALE,
  panBy,
  pinch,
  swipeDirection,
  wheelFactor,
  zoomAt,
  zoomBy,
  zoomKey,
} from "./hallPanZoom";

const size = { width: 400, height: 300 };
/** Where the drawing's point `p` appears under `view`. */
const shown = (
  view: { scale: number; x: number; y: number },
  p: { x: number; y: number },
) => ({ x: p.x * view.scale + view.x, y: p.y * view.scale + view.y });

describe("clampScale", () => {
  it("keeps the scale between 1× and 6×", () => {
    expect(clampScale(0.2)).toBe(1);
    expect(clampScale(3)).toBe(3);
    expect(clampScale(60)).toBe(MAX_SCALE);
    expect(clampScale(Number.NaN)).toBe(1);
  });
});

describe("clampView", () => {
  it("keeps the drawing at its place at 1×", () => {
    expect(clampView({ scale: 1, x: 50, y: -20 }, size)).toEqual(IDENTITY);
  });
  it("lets a zoomed drawing move only until its edge meets the surface's", () => {
    expect(clampView({ scale: 2, x: 10, y: 10 }, size)).toEqual({
      scale: 2,
      x: 0,
      y: 0,
    });
    expect(clampView({ scale: 2, x: -1000, y: -1000 }, size)).toEqual({
      scale: 2,
      x: -400,
      y: -300,
    });
    expect(clampView({ scale: 2, x: -100, y: -50 }, size)).toEqual({
      scale: 2,
      x: -100,
      y: -50,
    });
  });
  it("mends a non-finite offset", () => {
    expect(
      clampView({ scale: 2, x: Number.NaN, y: Number.POSITIVE_INFINITY }, size),
    ).toEqual({ scale: 2, x: 0, y: 0 });
  });
});

describe("zoomAt and zoomBy", () => {
  it("keeps the point under the focus where it is", () => {
    const focal = { x: 100, y: 150 };
    const view = zoomAt(IDENTITY, 2, focal, size);
    expect(view.scale).toBe(2);
    expect(shown(view, { x: 100, y: 150 })).toEqual(focal);
    const further = zoomAt(view, 3, { x: 300, y: 100 }, size);
    const point = { x: (300 - view.x) / 2, y: (100 - view.y) / 2 };
    const at = shown(further, point);
    expect(at.x).toBeCloseTo(300);
    expect(at.y).toBeCloseTo(100);
  });
  it("clamps the scale and the offset", () => {
    expect(zoomAt(IDENTITY, 100, { x: 0, y: 0 }, size).scale).toBe(MAX_SCALE);
    expect(
      zoomAt({ scale: 2, x: -400, y: -300 }, 0.5, { x: 0, y: 0 }, size),
    ).toEqual(IDENTITY);
  });
  it("zooms by a factor about the centre", () => {
    const view = zoomBy(IDENTITY, 2, size);
    expect(view).toEqual({ scale: 2, x: -200, y: -150 });
    expect(zoomBy(view, 0.5, size)).toEqual(IDENTITY);
  });
});

describe("panBy", () => {
  it("moves a zoomed drawing from where the drag began, within bounds", () => {
    const start = { scale: 2, x: -200, y: -150 };
    expect(panBy(start, { x: 50, y: -30 }, size)).toEqual({
      scale: 2,
      x: -150,
      y: -180,
    });
    expect(panBy(start, { x: 500, y: 0 }, size).x).toBe(0);
  });
  it("does not move the drawing at 1×", () => {
    expect(panBy(IDENTITY, { x: 80, y: 40 }, size)).toEqual(IDENTITY);
  });
});

describe("pinch", () => {
  it("scales by the fingers' spread about their midpoint", () => {
    const view = pinch(
      IDENTITY,
      [
        { x: 150, y: 150 },
        { x: 250, y: 150 },
      ],
      [
        { x: 100, y: 150 },
        { x: 300, y: 150 },
      ],
      size,
    );
    expect(view.scale).toBe(2);
    expect(shown(view, { x: 200, y: 150 })).toEqual({ x: 200, y: 150 });
  });
  it("drags with the fingers' midpoint", () => {
    const start = { scale: 2, x: -200, y: -150 };
    const view = pinch(
      start,
      [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
      [
        { x: 120, y: 110 },
        { x: 220, y: 110 },
      ],
      size,
    );
    expect(view).toEqual({ scale: 2, x: -180, y: -140 });
  });
  it("keeps its scale when the fingers start together, and clamps", () => {
    const together = { x: 10, y: 10 };
    expect(
      pinch(
        IDENTITY,
        [together, together],
        [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        size,
      ).scale,
    ).toBe(1);
    expect(
      pinch(
        IDENTITY,
        [
          { x: 199, y: 150 },
          { x: 201, y: 150 },
        ],
        [
          { x: 0, y: 150 },
          { x: 400, y: 150 },
        ],
        size,
      ).scale,
    ).toBe(MAX_SCALE);
  });
});

describe("swipeDirection", () => {
  it("reads a long sideways move as a swipe", () => {
    expect(swipeDirection({ x: -80, y: 10 })).toBe("next");
    expect(swipeDirection({ x: 80, y: -10 })).toBe("previous");
  });
  it("ignores short or mostly upright moves", () => {
    expect(swipeDirection({ x: -30, y: 0 })).toBeNull();
    expect(swipeDirection({ x: -80, y: 60 })).toBeNull();
  });
});

describe("isDoubleTap", () => {
  const tap = { x: 100, y: 100, time: 1000 };
  it("needs a previous tap near in time and place", () => {
    expect(isDoubleTap(null, tap)).toBe(false);
    expect(isDoubleTap(tap, { x: 110, y: 105, time: 1250 })).toBe(true);
    expect(isDoubleTap(tap, { x: 110, y: 105, time: 1400 })).toBe(false);
    expect(isDoubleTap(tap, { x: 200, y: 100, time: 1100 })).toBe(false);
  });
});

describe("zoomKey", () => {
  it("maps +, − and 0, with their usual spellings", () => {
    expect(["+", "="].map(zoomKey)).toEqual(["in", "in"]);
    expect(["-", "−", "_"].map(zoomKey)).toEqual(["out", "out", "out"]);
    expect(zoomKey("0")).toBe("reset");
    expect(zoomKey("a")).toBeNull();
  });
});

describe("wheelFactor", () => {
  it("zooms in for an upward wheel and out for a downward one, gently", () => {
    expect(wheelFactor(-100)).toBeCloseTo(Math.exp(1 / 3));
    expect(wheelFactor(100)).toBeCloseTo(Math.exp(-1 / 3));
    expect(wheelFactor(0)).toBe(1);
  });
  it("never zooms more than a step per event, whatever the unit", () => {
    expect(wheelFactor(-10000)).toBe(1.5);
    expect(wheelFactor(10000)).toBe(1 / 1.5);
    // Lines of 16 px and pages of 800 px.
    expect(wheelFactor(-3, 1)).toBeCloseTo(wheelFactor(-48));
    expect(wheelFactor(-1, 2)).toBe(1.5);
  });
});

describe("arrowPan", () => {
  it("moves the drawing against the arrow", () => {
    expect(arrowPan("ArrowLeft")).toEqual({ x: ARROW_PAN, y: 0 });
    expect(arrowPan("ArrowRight")).toEqual({ x: -ARROW_PAN, y: 0 });
    expect(arrowPan("ArrowUp")).toEqual({ x: 0, y: ARROW_PAN });
    expect(arrowPan("ArrowDown")).toEqual({ x: 0, y: -ARROW_PAN });
    expect(arrowPan("Enter")).toBeNull();
  });
});

describe("fitDrawing", () => {
  it("fits the drawing within the margin and centres it", () => {
    expect(fitDrawing({ width: 400, height: 300 }, 2).drawing).toEqual({
      left: 16,
      top: 58,
      width: 368,
      height: 184,
    });
    expect(fitDrawing({ width: 400, height: 300 }, 0.5).drawing).toEqual({
      left: 133,
      top: 16,
      width: 134,
      height: 268,
    });
  });
  it("takes a bad aspect as square and an unmeasured surface as empty", () => {
    expect(fitDrawing({ width: 100, height: 100 }, Number.NaN).drawing).toEqual(
      { left: 16, top: 16, width: 68, height: 68 },
    );
    expect(fitDrawing({ width: 0, height: 0 }, 2).drawing.width).toBe(0);
  });
});

describe("clampView with a drawing narrower than the surface", () => {
  // A 1.5-aspect hall on a 390×600 phone: 358×238.67 at (16, 180.67).
  const phone = fitDrawing({ width: 390, height: 600 }, 1.5);
  const { drawing } = phone;
  /** The drawing's rectangle on the surface under `view`. */
  const onSurface = (view: { scale: number; x: number; y: number }) => ({
    left: view.x + drawing.left * view.scale,
    top: view.y + drawing.top * view.scale,
    right: view.x + (drawing.left + drawing.width) * view.scale,
    bottom: view.y + (drawing.top + drawing.height) * view.scale,
  });

  it("keeps the drawing covering the surface at 6× wherever it is dragged", () => {
    for (const offset of [-1e6, -3000, 0, 3000, 1e6]) {
      const shown = onSurface(
        clampView({ scale: 6, x: offset, y: offset }, phone),
      );
      expect(shown.left).toBeLessThanOrEqual(1e-9);
      expect(shown.right).toBeGreaterThanOrEqual(390 - 1e-9);
      expect(shown.top).toBeLessThanOrEqual(1e-9);
      expect(shown.bottom).toBeGreaterThanOrEqual(600 - 1e-9);
    }
  });

  it("centres it on an axis where it is smaller than the surface", () => {
    // At 2× the drawing is 716 wide (covers 390) but 477 tall (under 600).
    const view = clampView({ scale: 2, x: -100, y: 500 }, phone);
    const shown = onSurface(view);
    expect(view.x).toBe(-100);
    expect((shown.top + shown.bottom) / 2).toBeCloseTo(300);
  });

  it("is the identity at 1×", () => {
    expect(clampView({ scale: 1, x: 40, y: -40 }, phone)).toEqual(IDENTITY);
  });
});

describe("focusView", () => {
  // No drawing: the region is a fraction of the 400×300 surface.
  it("fits a region within the margin and centres it", () => {
    // 80×60: 352/80 = 4.4 wide, 252/60 = 4.2 high.
    const region = { x: 0.25, y: 0.25, width: 0.2, height: 0.2 };
    const view = focusView(region, size);
    expect(view.scale).toBeCloseTo(4.2);
    const centre = shown(view, { x: 140, y: 105 });
    expect(centre.x).toBeCloseTo(200);
    expect(centre.y).toBeCloseTo(150);
  });

  it("zooms no further than 6×", () => {
    const view = focusView({ x: 0.4, y: 0.4, width: 0.05, height: 0.05 }, size);
    expect(view.scale).toBe(MAX_SCALE);
    expect(shown(view, { x: 170, y: 127.5 })).toEqual({ x: 200, y: 150 });
  });

  it("zooms at least 3×, showing the start of a region that overflows", () => {
    // 200×150 fits at 1.68×; at 3× it is larger than the surface.
    const view = focusView({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, size);
    expect(view.scale).toBe(FOCUS_MIN_SCALE);
    expect(shown(view, { x: 40, y: 30 })).toEqual({
      x: FOCUS_MARGIN,
      y: FOCUS_MARGIN,
    });
    // With a lower floor, it fits the region.
    expect(
      focusView({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, size, 1).scale,
    ).toBeCloseTo(1.68);
  });

  it("opens a tall column at its head and a long line at its start", () => {
    // Heydon's p. 13 and its Rulers' column on a 390×700 phone.
    const phone = fitDrawing({ width: 390, height: 700 }, 1600 / 2729);
    const { drawing } = phone;
    const column = { x: 0.02, y: 0.05, width: 0.145, height: 0.89 };
    const view = focusView(column, phone);
    expect(view.scale).toBe(FOCUS_MIN_SCALE);
    const head = shown(view, {
      x: drawing.left + column.x * drawing.width,
      y: drawing.top + column.y * drawing.height,
    });
    expect(head.y).toBeCloseTo(FOCUS_MARGIN);
    // Centring it would bring the page's left edge inside the surface:
    // the edge stays at the surface's.
    expect(view.x + drawing.left * view.scale).toBeCloseTo(0);
    expect(head.x).toBeGreaterThan(0);

    // Agrippa's p. CXLIX and the Moon's line of 3321.
    const agrippa = fitDrawing({ width: 390, height: 700 }, 1600 / 2158);
    const line = { x: 0.11, y: 0.139, width: 0.635, height: 0.032 };
    const lineView = focusView(line, agrippa);
    expect(lineView.scale).toBe(FOCUS_MIN_SCALE);
    const start = shown(lineView, {
      x: agrippa.drawing.left + line.x * agrippa.drawing.width,
      y:
        agrippa.drawing.top +
        (line.y + line.height / 2) * agrippa.drawing.height,
    });
    expect(start.x).toBeCloseTo(FOCUS_MARGIN);
    // Near the head of the page: centring it would bring the page's top
    // edge inside the surface, so the edge stays at the surface's.
    expect(lineView.y + agrippa.drawing.top * lineView.scale).toBeCloseTo(0);
    expect(start.y).toBeGreaterThan(0);
    expect(start.y).toBeLessThan(350);
  });

  it("keeps the drawing covering the surface", () => {
    const view = focusView({ x: 0, y: 0, width: 0.5, height: 0.5 }, size);
    expect(view).toEqual(clampView(view, size));
    expect(view.x).toBe(0);
    expect(view.y).toBe(0);
  });

  it("shows the whole drawing for an empty region or surface", () => {
    expect(focusView({ x: 0.5, y: 0.5, width: 0, height: 0.1 }, size)).toEqual(
      IDENTITY,
    );
    expect(
      focusView(
        { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
        fitDrawing({ width: 0, height: 0 }, 1),
      ),
    ).toEqual(IDENTITY);
  });
});
