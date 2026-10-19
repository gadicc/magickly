import { clamp } from "@magick-components/gd/hall/attributes";
import {
  DEFAULT_SCALES,
  type ResolvedHall,
  type ResolvedObject,
} from "@magick-components/gd/hall/layout";
import {
  COORDINATE_RANGE,
  HALL_POINT_OFFSETS,
  hallPoint,
  SCALE_RANGE,
} from "@magick-components/gd/hall/vocabulary";
import { type HallSelectable, type HallView, hallNodeName } from "./hallEdits";
import { objectRect, type Point, round2 } from "./hallGeometry";
import { HOST_TAKES, hostAccepts, isHost } from "./hallHostRules";
import {
  ensureFloor,
  type HallAttrPatch,
  type HallElement,
  moveHallNode,
  noNegativeZero,
} from "./hallModel";

/**
 * Objects standing on hosts in the visual hall editor (plan 061, Stage E
 * notes; Gadi's decision of 19 October 2026). An object dragged onto a
 * host it may stand on joins it; dragged off its host it goes to the
 * floor; the panel's "Stands on" does the same from the keyboard or a
 * touch screen. Either way it stays where it is drawn: its position is
 * converted into the new frame, its scale by the frames' units, and an
 * `at` (a point of the old parent) gives way to `x` and `y`.
 */

/** Where a node stands, for reparenting: on the floor, a host or a row. */
type Standing =
  | { kind: "floor" }
  | { kind: "host"; host: HallSelectable }
  | { kind: "other" };

function standing(view: HallView, id: string): Standing {
  const parentId = view.index.byId.get(id)?.parentId;
  const parent = parentId ? view.index.byId.get(parentId)?.node : undefined;
  if (!parent) return { kind: "other" };
  // The floor element, or the hall itself (a placeable there is drawn on
  // the floor).
  if (parent.tag === "floor" || parent.id === view.hall.id)
    return { kind: "floor" };
  const host = view.byId.get(parent.id);
  if (host?.object?.childFrame && isHost(parent.tag))
    return { kind: "host", host };
  return { kind: "other" };
}

/**
 * Whether a drag or the panel may move `id` between hosts and the floor:
 * a drawn object some host takes, standing on the floor or a host (never
 * in a row, nor anything else).
 */
export function reparentable(view: HallView, id: string): boolean {
  const entry = view.byId.get(id);
  if (!entry?.object) return false;
  if (!HOST_TAKES.has(entry.node.tag)) return false;
  return standing(view, id).kind !== "other";
}

/** Whether the row path `path` lies inside (or is) `ancestor`. */
const within = (path: readonly number[], ancestor: readonly number[]) =>
  path.length >= ancestor.length &&
  ancestor.every((step, index) => path[index] === step);

const contains = (entry: HallSelectable, point: Point) => {
  if (!entry.object) return false;
  const rect = objectRect(entry.object);
  return (
    point.x >= rect.x0 &&
    point.x <= rect.x1 &&
    point.y >= rect.y0 &&
    point.y <= rect.y1
  );
};

/**
 * The hosts `id` may stand on, topmost first (later objects are drawn
 * over earlier ones): every host that takes it, outside its own subtree.
 */
export function compatibleHosts(view: HallView, id: string): HallSelectable[] {
  const entry = view.byId.get(id);
  if (!entry) return [];
  return view.selectables
    .filter(
      (candidate) =>
        candidate.object?.childFrame &&
        hostAccepts(candidate.node.tag, entry.node.tag) &&
        !within(candidate.rowPath, entry.rowPath),
    )
    .sort((a, b) => objectOrder(view, b) - objectOrder(view, a));
}

/**
 * Where a host is drawn among the resolved objects (a host always has its
 * object, and a hall with objects is laid out).
 */
const objectOrder = (view: HallView, entry: HallSelectable) =>
  (view.resolved as ResolvedHall).objects.indexOf(
    entry.object as ResolvedObject,
  );

/** Where a drop lands: a host (by ID), or the floor. */
export type HallDropTarget = { kind: "floor" } | { kind: "host"; id: string };

/**
 * Where `id` lands when released with its centre at `centre`: the topmost
 * host that takes it and whose box holds the centre; else its own host,
 * if the centre is still on it; else the floor. Undefined for objects
 * that never change parent (rows, doors, labels, furniture).
 */
export function dropTarget(
  view: HallView,
  id: string,
  centre: Point,
): HallDropTarget | undefined {
  if (!reparentable(view, id)) return undefined;
  const host = compatibleHosts(view, id).find((candidate) =>
    contains(candidate, centre),
  );
  if (host) return { kind: "host", id: host.id };
  const now = standing(view, id);
  if (now.kind === "host" && contains(now.host, centre))
    return { kind: "host", id: now.host.id };
  return { kind: "floor" };
}

/** Whether `target` is where `id` already stands. */
export function standsOn(
  view: HallView,
  id: string,
  target: HallDropTarget,
): boolean {
  const now = standing(view, id);
  return target.kind === "floor"
    ? now.kind === "floor"
    : now.kind === "host" && now.host.id === target.id;
}

/**
 * The default scale of an object's kind, as the resolver gives it. Every
 * kind a host takes has one under its art key, but an item of a kind the
 * art does not know, which takes items' default.
 */
const defaultScale = (object: ResolvedObject): number =>
  DEFAULT_SCALES.get(object.artKey) ?? (DEFAULT_SCALES.get("item") as number);

/**
 * Moves `id` onto `target` where it is drawn now: its anchor point
 * converted into the new frame (rounded to two decimals) as `x` and `y`,
 * `at` dropped, its scale multiplied by the old frame's unit over the new
 * (written only when it changes, and taken away when it comes back to its
 * kind's default), at the end of the new parent's children, so it is
 * drawn on top. The same hall when it already stands there.
 */
export function reparentNode(
  view: HallView,
  id: string,
  target: HallDropTarget,
  createId: () => string,
): HallElement {
  if (!reparentable(view, id) || standsOn(view, id, target)) return view.hall;
  // A reparentable node is a drawn object.
  const entry = view.byId.get(id) as HallSelectable;
  const object = entry.object as ResolvedObject;
  let hall = view.hall;
  let parentId: string;
  let frame: { ox: number; oy: number; unit: number };
  if (target.kind === "host") {
    const host = view.byId.get(target.id);
    const childFrame = host?.object?.childFrame;
    if (
      !host ||
      !childFrame ||
      !compatibleHosts(view, id).some((candidate) => candidate.id === host.id)
    )
      return view.hall;
    parentId = host.id;
    frame = childFrame;
  } else {
    const made = ensureFloor(hall, createId);
    hall = made.hall;
    parentId = made.floor.id;
    frame = { ox: 0, oy: 0, unit: 1 };
  }
  // The anchor point, in floor squares: the centre, or the box's named
  // point when an `anchor` says so.
  const anchor =
    hallPoint(
      typeof entry.node.attrs.anchor === "string"
        ? entry.node.attrs.anchor
        : undefined,
    ) ?? "centre";
  const [ax, ay] = HALL_POINT_OFFSETS.get(anchor) as readonly [number, number];
  const point = {
    x: object.cx + (ax * object.width) / 2,
    y: object.cy + (ay * object.height) / 2,
  };
  const ratio = object.frame.unit / frame.unit;
  const patch: Record<string, HallAttrPatch[string]> = {
    at: undefined,
    x: framedValue((point.x - frame.ox) / frame.unit, frame.unit),
    y: framedValue((point.y - frame.oy) / frame.unit, frame.unit),
  };
  const hasScale = Object.hasOwn(entry.node.attrs, "scale");
  if (hasScale || Math.abs(ratio - 1) > 1e-9) {
    const scale = framedScale(object.scale * ratio, object);
    patch.scale = scale === round2(defaultScale(object)) ? undefined : scale;
  }
  return moveHallNode(hall, id, parentId, patch);
}

/**
 * A converted position in a frame of `unit` floor squares: two decimals
 * (decision 4), or as many more as keep it within half a hundredth of a
 * square where a scaled host's unit is larger, so a conversion never
 * visibly moves an object.
 */
function framedValue(value: number, unit: number): number {
  const digits = 2 + Math.max(0, Math.ceil(Math.log10(unit)));
  const factor = 10 ** Math.min(digits, 6);
  return noNegativeZero(
    Math.round(clamp(value, ...COORDINATE_RANGE) * factor) / factor,
  );
}

/**
 * A converted scale: two decimals, or as many more (up to six) as keep
 * the drawn size within 0.004 of a square, since a small item on a
 * scaled host takes a small scale.
 */
function framedScale(
  value: number,
  object: { width: number; height: number },
): number {
  const exact = clamp(value, ...SCALE_RANGE);
  const size = Math.max(object.width, object.height);
  for (let digits = 2; ; digits++) {
    const factor = 10 ** digits;
    const rounded = Math.round(exact * factor) / factor;
    if (digits === 6 || (size * Math.abs(rounded - exact)) / exact <= 0.004)
      return rounded;
  }
}

/** A choice of the panel's "Stands on". */
export interface HallStandOption {
  /** `floor`, or the host's ID. */
  value: string;
  label: string;
}

/**
 * The panel's "Stands on" choices for `id`: the floor, then every host
 * that takes it, in document order, named with its position where two
 * share a name. The host it stands on now is always among them, even one
 * that does not take it (source may put an officer on an altar), so the
 * choice shown is one of the list.
 */
export function standOptions(view: HallView, id: string): HallStandOption[] {
  if (!reparentable(view, id)) return [];
  const now = standing(view, id);
  const offered = new Set(compatibleHosts(view, id));
  if (now.kind === "host") offered.add(now.host);
  const hosts = view.selectables.filter((entry) => offered.has(entry));
  const names = hosts.map((host) => hallNodeName(host.node));
  return [
    { value: "floor", label: "Floor" },
    ...hosts.map((host, index) => {
      const name = names[index];
      const shared = names.filter((other) => other === name).length > 1;
      const object = host.object as ResolvedObject;
      return {
        value: host.id,
        label: shared
          ? `${name} (x ${round2(object.cx)}, y ${round2(object.cy)})`
          : name,
      };
    }),
  ];
}

/** The "Stands on" value of where `id` stands now. */
export function standValue(view: HallView, id: string): string | undefined {
  const now = standing(view, id);
  return now.kind === "floor"
    ? "floor"
    : now.kind === "host"
      ? now.host.id
      : undefined;
}
