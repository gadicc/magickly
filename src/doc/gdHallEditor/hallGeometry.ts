import { clamp } from "@magick-components/gd/hall/attributes";
import {
  FLOOR_SIZE,
  type Rect,
  type ResolvedHall,
  type ResolvedObject,
} from "@magick-components/gd/hall/layout";
import {
  COORDINATE_RANGE,
  SCALE_RANGE,
} from "@magick-components/gd/hall/vocabulary";
import { noNegativeZero } from "./hallModel";

/**
 * The visual hall editor's geometry (plan 061, decisions 4 and 11): from
 * pointer movements in floor squares to the attribute values a node
 * needs, and from a point to the object under it. Pure functions over
 * `resolveHall`'s output; the editor converts SVG user units (100 per
 * square) to floor squares before calling them.
 */

/** A point or a movement, in floor squares. */
export interface Point {
  x: number;
  y: number;
}

/** Positions are written to two decimals (decision 4). */
export const round2 = (value: number): number =>
  noNegativeZero(Math.round(value * 100) / 100);

/** Snaps to half units: half squares on the floor. */
export const snapHalf = (value: number): number =>
  noNegativeZero(Math.round(value * 2) / 2);

/**
 * In snapping mode, a drag must move a node this far along an axis, in its
 * own frame's units, before that axis is written: a horizontal drag does
 * not rewrite (and snap) a value the author never meant to move.
 */
export const SNAP_DEAD_ZONE = 0.25;

/** A position attribute, rounded, without `-0`, clamped to the range. */
export const coordinateValue = (value: number): number =>
  round2(clamp(value, ...COORDINATE_RANGE));

/** The `x` and `y` attributes a move gives a node; absent axes stay. */
export type MoveAttrs = { x?: number; y?: number };

/**
 * The attributes that move `object` by `delta` floor squares. The movement
 * is converted into the node's own frame: floor squares for the floor and
 * rows, the host's unscaled squares for a host's children (scaled hosts
 * included). With `at` the values are offsets from that point, so `at` is
 * kept. A row child without `x` (or `y`) gets one when moved, which takes
 * it out of the row's spread: the row's other children spread again
 * without it. Values are snapped to half units unless `snap` is false,
 * then rounded to two decimals and clamped to the coordinate range.
 */
export function moveAttrs(
  object: Pick<ResolvedObject, "frame" | "position">,
  delta: Point,
  snap: boolean,
): MoveAttrs {
  const result: MoveAttrs = {};
  for (const axis of ["x", "y"] as const) {
    const moved = delta[axis] / object.frame.unit;
    if (snap ? Math.abs(moved) < SNAP_DEAD_ZONE : round2(moved) === 0) continue;
    const raw = object.position[axis] + moved;
    const value = coordinateValue(snap ? snapHalf(raw) : raw);
    if (value !== round2(object.position[axis])) result[axis] = value;
  }
  return result;
}

/**
 * The attributes that nudge `object` by `step` units of its own frame
 * along each axis (half a square, or a whole one with Shift): no snapping,
 * so 9.4 nudges to 9.9.
 */
export function nudgeAttrs(
  object: Pick<ResolvedObject, "position">,
  step: Point,
): MoveAttrs {
  const result: MoveAttrs = {};
  for (const axis of ["x", "y"] as const) {
    if (step[axis] === 0) continue;
    const value = coordinateValue(object.position[axis] + step[axis]);
    if (value !== round2(object.position[axis])) result[axis] = value;
  }
  return result;
}

/** A scale attribute, rounded, clamped to the vocabulary's range. */
export const scaleValue = (value: number): number =>
  round2(clamp(value, ...SCALE_RANGE));

/**
 * The scale a corner handle gives `object` when dragged from `start` to
 * `point`: proportional to the pointer's distance from the object's
 * centre.
 */
export function dragScale(
  object: Pick<ResolvedObject, "cx" | "cy" | "scale">,
  start: Point,
  point: Point,
): number {
  const from = Math.hypot(start.x - object.cx, start.y - object.cy);
  const to = Math.hypot(point.x - object.cx, point.y - object.cy);
  if (from < 1e-6) return scaleValue(object.scale);
  return scaleValue((object.scale * to) / from);
}

/** How much one `+` or `-` press scales by. */
export const SCALE_STEP = 1.1;

/**
 * The scale after one `+` (up) or `-` press: a tenth larger or smaller,
 * and at least a hundredth, so small items still change.
 */
export function stepScale(scale: number, up: boolean): number {
  const next = scaleValue(up ? scale * SCALE_STEP : scale / SCALE_STEP);
  if (next !== round2(scale)) return next;
  return scaleValue(scale + (up ? 0.01 : -0.01));
}

/** A door's attributes: along its wall, on the floor's 0–16. */
export function doorAlongAttr(side: string): "x" | "y" {
  return side === "north" || side === "south" ? "y" : "x";
}

/**
 * A door's position along its wall `step` squares from where it stands,
 * rounded and kept on the floor's 0–16 (arrow keys, a copy's offset).
 */
export function doorStep(
  door: { from: number; to: number },
  step: number,
): number {
  return round2(clamp((door.from + door.to) / 2 + step, 0, FLOOR_SIZE));
}

/**
 * The value a door's position along its wall takes when moved by `delta`
 * floor squares from `centre`; undefined when it does not change.
 */
export function moveDoor(
  door: { side: string; from: number; to: number },
  delta: Point,
  snap: boolean,
): number | undefined {
  const axis = doorAlongAttr(door.side);
  const centre = (door.from + door.to) / 2;
  const moved = delta[axis];
  if (snap ? Math.abs(moved) < SNAP_DEAD_ZONE : round2(moved) === 0)
    return undefined;
  const raw = centre + moved;
  const value = round2(clamp(snap ? snapHalf(raw) : raw, 0, FLOOR_SIZE));
  return value === round2(centre) ? undefined : value;
}

/** The smallest object a pointer can hit, in squares. */
export const MIN_HIT_SIZE = 0.6;

/** An object's drawn box. */
export function objectRect(object: ResolvedObject): Rect {
  return {
    x0: object.cx - object.width / 2,
    y0: object.cy - object.height / 2,
    x1: object.cx + object.width / 2,
    y1: object.cy + object.height / 2,
  };
}

/**
 * All an object draws: its box, its labels and its text, in one rect, so
 * that revealing it shows its name too (plan 063).
 */
export function drawnRect(object: ResolvedObject): Rect {
  return [
    ...object.labels.map((label) => label.bounds),
    ...(object.text ? [object.text.bounds] : []),
    ...(object.inner ? [object.inner.bounds] : []),
  ].reduce(
    (union, rect) => ({
      x0: Math.min(union.x0, rect.x0),
      y0: Math.min(union.y0, rect.y0),
      x1: Math.max(union.x1, rect.x1),
      y1: Math.max(union.y1, rect.y1),
    }),
    objectRect(object),
  );
}

/**
 * Where a pointer hits an object: its box, at least `MIN_HIT_SIZE` across,
 * and its labels and text.
 */
export function hitRects(object: ResolvedObject): Rect[] {
  const half = (size: number) => Math.max(size, MIN_HIT_SIZE) / 2;
  return [
    {
      x0: object.cx - half(object.width),
      y0: object.cy - half(object.height),
      x1: object.cx + half(object.width),
      y1: object.cy + half(object.height),
    },
    ...object.labels.map((label) => label.bounds),
    ...(object.text ? [object.text.bounds] : []),
  ];
}

const inside = (rect: Rect, point: Point) =>
  point.x >= rect.x0 &&
  point.x <= rect.x1 &&
  point.y >= rect.y0 &&
  point.y <= rect.y1;

/** How far a door's hit band reaches either side of its wall line. */
export const DOOR_HIT_DEPTH = 0.45;

/** Where a pointer hits a door: a band across its wall line. */
export function doorRect(
  door: ResolvedHall["doors"][number],
  outer: Rect,
): Rect {
  const line =
    door.side === "west"
      ? outer.y1
      : door.side === "east"
        ? outer.y0
        : door.side === "north"
          ? outer.x0
          : outer.x1;
  const across = [line - DOOR_HIT_DEPTH, line + DOOR_HIT_DEPTH];
  return door.side === "north" || door.side === "south"
    ? { x0: across[0], x1: across[1], y0: door.from, y1: door.to }
    : { x0: door.from, x1: door.to, y0: across[0], y1: across[1] };
}

/** What a pointer hit: an object or a door, by its row path. */
export interface HallHit {
  path: readonly number[];
  kind: "object" | "door";
}

/**
 * The object or door under `point`: the topmost, as drawn. Labels and
 * free text draw above every object (`GdHall` draws them last), so they
 * are tried first, in their own order; then the objects (later objects
 * draw over earlier ones, a host's children over the host); then doors.
 */
export function hitTest(hall: ResolvedHall, point: Point): HallHit | null {
  const at = (rects: readonly Rect[]) =>
    rects.some((rect) => inside(rect, point));
  for (let index = hall.objects.length - 1; index >= 0; index--) {
    const object = hall.objects[index];
    // Free text is all text; an object's labels only its text.
    const text = object.text
      ? hitRects(object)
      : object.labels.map((label) => label.bounds);
    if (at(text)) return { path: object.path, kind: "object" };
  }
  for (let index = hall.objects.length - 1; index >= 0; index--) {
    const object = hall.objects[index];
    if (!object.text && at(hitRects(object).slice(0, 1)))
      return { path: object.path, kind: "object" };
  }
  for (const door of hall.doors)
    if (inside(doorRect(door, hall.outer), point))
      return { path: door.path, kind: "door" };
  return null;
}

/** Compares row paths in document order. */
export function compareRowPaths(
  a: readonly number[],
  b: readonly number[],
): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++)
    if (a[index] !== b[index]) return a[index] - b[index];
  return a.length - b.length;
}
