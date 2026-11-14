/**
 * The arithmetic of the hall viewer's pan and zoom (plan 069, decision 6),
 * kept apart from the pointer handling so it can be tested alone.
 *
 * The content fills a surface of `size` at 1× and is shown with
 * `translate(x, y) scale(scale)` about its top-left corner, so a point `p`
 * of it appears at `p * scale + (x, y)` on the surface. The drawing is a
 * rectangle within it (`Size.drawing`), centred with a margin.
 */

/** A point or a vector, in CSS pixels on the surface. */
export interface Point {
  x: number;
  y: number;
}

/** A rectangle, in CSS pixels. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The surface's size, in CSS pixels, and where the drawing sits at 1×. */
export interface Size {
  width: number;
  height: number;
  /** The drawing at 1×; the whole surface when absent. */
  drawing?: Rect;
}

/** The margin around the drawing at 1×, in CSS pixels. */
export const FIT_MARGIN = 16;

/**
 * The surface's size with its drawing fitted: as large as fits within the
 * margin at its `aspect` (width over height), centred.
 */
export function fitDrawing(
  size: { width: number; height: number },
  aspect: number,
): Size & { drawing: Rect } {
  const { width, height } = size;
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const drawingWidth = Math.max(
    0,
    Math.min(width - 2 * FIT_MARGIN, (height - 2 * FIT_MARGIN) * ratio),
  );
  const drawingHeight = drawingWidth / ratio;
  return {
    width,
    height,
    drawing: {
      left: (width - drawingWidth) / 2,
      top: (height - drawingHeight) / 2,
      width: drawingWidth,
      height: drawingHeight,
    },
  };
}

/** What the surface shows: a scale and the drawing's offset. */
export interface View extends Point {
  scale: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;
/** One zoom step, for the buttons and the keys. */
export const ZOOM_STEP = 1.5;

export const IDENTITY: View = { scale: 1, x: 0, y: 0 };

/** A scale within 1× and 6×. */
export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * The view with its scale clamped and its offset kept so the drawing cannot
 * be lost. On each axis: where the drawing at this scale is larger than
 * the surface, it keeps covering the surface (an edge may reach the
 * surface's edge but never come inside it); where it is smaller, it is
 * centred.
 */
export function clampView(view: View, size: Size): View {
  const scale = clampScale(view.scale);
  const drawing = size.drawing ?? {
    left: 0,
    top: 0,
    width: size.width,
    height: size.height,
  };
  const axis = (
    offset: number,
    surface: number,
    start: number,
    length: number,
  ) => {
    const shown = length * scale;
    if (shown <= surface) return (surface - shown) / 2 - start * scale;
    const finite = Number.isFinite(offset) ? offset : 0;
    return Math.min(
      0 - start * scale,
      Math.max(surface - (start + length) * scale, finite),
    );
  };
  return {
    scale,
    x: axis(view.x, size.width, drawing.left, drawing.width),
    y: axis(view.y, size.height, drawing.top, drawing.height),
  };
}

/**
 * Zooms to `scale` keeping the drawing's point under `focal` (on the
 * surface) where it is.
 */
export function zoomAt(
  view: View,
  scale: number,
  focal: Point,
  size: Size,
): View {
  const next = clampScale(scale);
  const ratio = next / view.scale;
  return clampView(
    {
      scale: next,
      x: focal.x - (focal.x - view.x) * ratio,
      y: focal.y - (focal.y - view.y) * ratio,
    },
    size,
  );
}

/** A rectangle as fractions of the drawing's width and height, from its top left. */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The margin kept around a region the view opens on, in CSS pixels. */
export const FOCUS_MARGIN = 24;
/**
 * The least zoom a view opens on a region at. The mirrored pages' type is
 * small: at less than about 3× a phone shows it too small to read, however
 * well the region fits.
 */
export const FOCUS_MIN_SCALE = 3;

/**
 * The view that opens on `region` of the drawing: as large as fits within
 * the margin, but at least `minScale` (and at most 6×). On each axis the
 * region is centred where it fits; where it does not, its start (its top,
 * or its left) is shown, so a tall column opens at its head and a long line
 * at its beginning. The drawing still covers the surface, as `clampView`
 * keeps it.
 */
export function focusView(
  region: Region,
  size: Size,
  minScale = FOCUS_MIN_SCALE,
): View {
  const drawing = size.drawing ?? {
    left: 0,
    top: 0,
    width: size.width,
    height: size.height,
  };
  const left = drawing.left + region.x * drawing.width;
  const top = drawing.top + region.y * drawing.height;
  const width = region.width * drawing.width;
  const height = region.height * drawing.height;
  if (!(width > 0 && height > 0)) return clampView(IDENTITY, size);
  const fit = Math.min(
    (size.width - 2 * FOCUS_MARGIN) / width,
    (size.height - 2 * FOCUS_MARGIN) / height,
  );
  const scale = clampScale(Math.max(minScale, fit));
  const axis = (surface: number, start: number, length: number) => {
    const shown = length * scale;
    return shown <= surface - 2 * FOCUS_MARGIN
      ? (surface - shown) / 2 - start * scale
      : FOCUS_MARGIN - start * scale;
  };
  return clampView(
    {
      scale,
      x: axis(size.width, left, width),
      y: axis(size.height, top, height),
    },
    size,
  );
}

/** Zooms by `factor` about the surface's centre (the buttons and keys). */
export function zoomBy(view: View, factor: number, size: Size): View {
  return zoomAt(
    view,
    view.scale * factor,
    { x: size.width / 2, y: size.height / 2 },
    size,
  );
}

/** Moves the drawing from where it was at `start` by `delta`. */
export function panBy(start: View, delta: Point, size: Size): View {
  return clampView(
    { scale: start.scale, x: start.x + delta.x, y: start.y + delta.y },
    size,
  );
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/**
 * A two-finger pinch: from the view at its start, scaled by how far the
 * fingers have spread, with the drawing's point that was between them
 * following their midpoint (so the pinch also drags).
 */
export function pinch(
  start: View,
  from: readonly [Point, Point],
  to: readonly [Point, Point],
  size: Size,
): View {
  const before = distance(from[0], from[1]);
  const scale = clampScale(
    before > 0 ? (start.scale * distance(to[0], to[1])) / before : start.scale,
  );
  const was = midpoint(from[0], from[1]);
  const now = midpoint(to[0], to[1]);
  // The drawing's point that was under the fingers' midpoint.
  const px = (was.x - start.x) / start.scale;
  const py = (was.y - start.y) / start.scale;
  return clampView(
    { scale, x: now.x - px * scale, y: now.y - py * scale },
    size,
  );
}

/** How far, in pixels, a one-finger move must go to count as a swipe. */
export const SWIPE_DISTANCE = 50;

/**
 * A finished one-finger move's meaning at 1×: mostly sideways and far
 * enough, a swipe to the next hall (leftwards) or the previous one.
 */
export function swipeDirection(delta: Point): "next" | "previous" | null {
  if (Math.abs(delta.x) < SWIPE_DISTANCE) return null;
  if (Math.abs(delta.x) < 2 * Math.abs(delta.y)) return null;
  return delta.x < 0 ? "next" : "previous";
}

/** How far a finger may move and still tap. */
export const TAP_DISTANCE = 10;
/** The most time between the two taps of a double tap. */
export const DOUBLE_TAP_MS = 300;

/** A tap: where and when it ended. */
export interface Tap extends Point {
  time: number;
}

/** Whether `tap` follows `previous` closely enough to be a double tap. */
export function isDoubleTap(previous: Tap | null, tap: Tap): boolean {
  return (
    previous !== null &&
    tap.time - previous.time <= DOUBLE_TAP_MS &&
    distance(previous, tap) <= 3 * TAP_DISTANCE
  );
}

/** The keys the viewer zooms with: +, − and 0 (and their usual spellings). */
export function zoomKey(key: string): "in" | "out" | "reset" | null {
  switch (key) {
    case "+":
    case "=":
      return "in";
    case "-":
    case "−":
    case "_":
      return "out";
    case "0":
      return "reset";
    default:
      return null;
  }
}

/** Pixels per line and per page, for wheels that count in those. */
const LINE_PIXELS = 16;
const PAGE_PIXELS = 800;

/**
 * The scale factor for a Ctrl+wheel (or a trackpad pinch, which browsers
 * send as one): up zooms in, smoothly, a mouse's notch (100 px) by about
 * 1.4×, and never more than one zoom step per event. `deltaMode` is the
 * event's: 0 pixels, 1 lines, 2 pages.
 */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  const pixels =
    deltaY *
    (deltaMode === 1 ? LINE_PIXELS : deltaMode === 2 ? PAGE_PIXELS : 1);
  const factor = Math.exp(-pixels / 300);
  return Math.min(ZOOM_STEP, Math.max(1 / ZOOM_STEP, factor));
}

/** How far an arrow key pans, in pixels on the surface. */
export const ARROW_PAN = 48;

/**
 * An arrow key's move when zoomed: the drawing moves the other way, so
 * the arrow shows more of the drawing in its direction.
 */
export function arrowPan(key: string): Point | null {
  switch (key) {
    case "ArrowLeft":
      return { x: ARROW_PAN, y: 0 };
    case "ArrowRight":
      return { x: -ARROW_PAN, y: 0 };
    case "ArrowUp":
      return { x: 0, y: ARROW_PAN };
    case "ArrowDown":
      return { x: 0, y: -ARROW_PAN };
    default:
      return null;
  }
}
