import {
  type ResolvedDoor,
  type ResolvedHall,
  type ResolvedObject,
  resolveHall,
} from "@magick-components/gd/hall/layout";
import type {
  HallArtRegistry,
  HallNode,
} from "@magick-components/gd/hall/types";
import { roleName } from "@magick-components/gd/hall/vocabulary";
import type { JsonValue } from "../semantic";
import {
  compareRowPaths,
  doorAlongAttr,
  doorStep,
  dragScale,
  moveAttrs,
  moveDoor,
  nudgeAttrs,
  type Point,
  round2,
  scaleValue,
  stepScale,
} from "./hallGeometry";
import {
  duplicateHallNode,
  type HallAttrPatch,
  type HallElement,
  type HallIndex,
  hallRowOf,
  indexHall,
  removeHallNode,
  rowPathKey,
  updateHallAttrs,
} from "./hallModel";
import { itemKindLabel } from "./hallPalette";

/**
 * The visual hall editor's edits (plan 061, decision 11): one function per
 * gesture, from the hall the editor shows to the next one. Each returns
 * the same hall object when the gesture changes nothing, so the editor
 * commits nothing (and the host's history gets no empty step).
 */

/** Something the editor can select: a drawn object or a door. */
export interface HallSelectable {
  id: string;
  rowPath: readonly number[];
  node: HallElement;
  object?: ResolvedObject;
  door?: ResolvedDoor;
}

/** A hall with its compiled row, its layout and what can be selected. */
export interface HallView {
  hall: HallElement;
  /** Null while the subtree is not valid source. */
  row: HallNode | null;
  resolved: ResolvedHall | null;
  index: HallIndex;
  /** Objects and doors in document order (Tab's order). */
  selectables: readonly HallSelectable[];
  byId: ReadonlyMap<string, HallSelectable>;
}

/** Lays a hall out for editing. */
export function hallView(hall: HallElement, art: HallArtRegistry): HallView {
  const row = hallRowOf(hall);
  const resolved = row ? resolveHall(row, { art }) : null;
  const index = indexHall(hall);
  const selectables: HallSelectable[] = [];
  const add = (
    rowPath: readonly number[],
    found: { object?: ResolvedObject; door?: ResolvedDoor },
  ) => {
    const id = index.byRowPath.get(rowPathKey(rowPath));
    const node = id === undefined ? undefined : index.byId.get(id)?.node;
    if (id !== undefined && node)
      selectables.push({ id, rowPath, node, ...found });
  };
  for (const object of resolved?.objects ?? []) add(object.path, { object });
  for (const door of resolved?.doors ?? []) add(door.path, { door });
  selectables.sort((a, b) => compareRowPaths(a.rowPath, b.rowPath));
  return {
    hall,
    row,
    resolved,
    index,
    selectables,
    byId: new Map(selectables.map((entry) => [entry.id, entry])),
  };
}

const text = (node: HallElement, name: string): string | undefined => {
  const value = node.attrs[name];
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : typeof value === "number"
      ? String(value)
      : undefined;
};

/** Clips a name taken from content for messages and headings. */
const clip = (name: string) =>
  name.length > 40 ? `${name.slice(0, 40)}…` : name;

/**
 * What the editor calls a node: an officer by its role, an item by its
 * kind, a label or marker by its text, a pillar or banner by its kind.
 */
export function hallNodeName(node: HallElement): string {
  const tag = node.tag;
  const role = text(node, "role");
  const kind = text(node, "kind");
  if (tag === "officer" || tag === "lamen")
    return role
      ? clip(roleName(role))
      : tag === "officer"
        ? "Officer"
        : "Lamen";
  if (tag === "item") return kind ? clip(itemKindLabel(kind)) : "Item";
  if (tag === "label" || tag === "marker")
    return clip(text(node, "text") ?? (tag === "label" ? "Label" : "Marker"));
  if (tag === "pillar")
    return kind ? `${clip(itemKindLabel(kind))} pillar` : "Pillar";
  if (tag === "banner")
    return kind ? `Banner of the ${clip(itemKindLabel(kind))}` : "Banner";
  if (tag === "hebrewLetter")
    return `Hebrew letter ${clip(text(node, "letter") ?? "")}`.trim();
  if (tag === "tarotKey") return `Tarot key ${text(node, "n") ?? ""}`.trim();
  if (tag === "tablet") {
    const element = text(node, "element");
    return element ? `${clip(itemKindLabel(element))} tablet` : "Tablet";
  }
  if (tag === "door") return `Door (${text(node, "side") ?? "west"})`;
  return clip(itemKindLabel(tag));
}

/** The move or the door position a drag of `delta` writes, as a patch. */
export function movePatch(
  selectable: HallSelectable,
  delta: Point,
  snap: boolean,
): HallAttrPatch {
  if (selectable.door) {
    const value = moveDoor(selectable.door, delta, snap);
    return value === undefined
      ? {}
      : { [doorAlongAttr(selectable.door.side)]: value };
  }
  if (!selectable.object) return {};
  return moveAttrs(selectable.object, delta, snap);
}

/** Moves a node by `delta` floor squares (a drag). */
export function moveNode(
  view: HallView,
  id: string,
  delta: Point,
  snap: boolean,
): HallElement {
  const selectable = view.byId.get(id);
  if (!selectable) return view.hall;
  return updateHallAttrs(view.hall, id, movePatch(selectable, delta, snap));
}

/**
 * Nudges a node by `step` units of its own frame (arrow keys); a door
 * moves along its wall only.
 */
export function nudgeNode(
  view: HallView,
  id: string,
  step: Point,
): HallElement {
  const selectable = view.byId.get(id);
  if (!selectable) return view.hall;
  if (selectable.door) {
    const axis = doorAlongAttr(selectable.door.side);
    if (step[axis] === 0) return view.hall;
    return updateHallAttrs(view.hall, id, {
      [axis]: doorStep(selectable.door, step[axis]),
    });
  }
  if (!selectable.object) return view.hall;
  return updateHallAttrs(view.hall, id, nudgeAttrs(selectable.object, step));
}

/** Whether a node has a `scale`: every drawn object except free text. */
export function scalable(selectable: HallSelectable | undefined): boolean {
  return !!selectable?.object && selectable.node.tag !== "label";
}

/** Sets a node's scale (rounded and clamped). */
export function scaleNode(
  view: HallView,
  id: string,
  scale: number,
): HallElement {
  const selectable = view.byId.get(id);
  if (!scalable(selectable)) return view.hall;
  const value = scaleValue(scale);
  if (value === round2(selectable?.object?.scale ?? Number.NaN))
    return view.hall;
  return updateHallAttrs(view.hall, id, { scale: value });
}

/** The scale a corner handle's drag from `start` to `point` gives. */
export function dragScaleNode(
  view: HallView,
  id: string,
  start: Point,
  point: Point,
): HallElement {
  const object = view.byId.get(id)?.object;
  if (!object) return view.hall;
  return scaleNode(view, id, dragScale(object, start, point));
}

/** One `+` or `-` press. */
export function stepScaleNode(
  view: HallView,
  id: string,
  up: boolean,
): HallElement {
  const object = view.byId.get(id)?.object;
  if (!object) return view.hall;
  return scaleNode(view, id, stepScale(object.scale, up));
}

/** Removes a node (Delete, Backspace, the panel's Delete). */
export function deleteNode(view: HallView, id: string): HallElement {
  return removeHallNode(view.hall, id);
}

/** How far a copy stands from its original, in its own frame's units. */
export const DUPLICATE_OFFSET = 0.5;

/**
 * Copies a node with fresh IDs throughout, half a unit South and West of
 * it (along its wall for a door), right after it in its parent; a row
 * child's copy gets an explicit position, so the row does not spread
 * again.
 */
export function duplicateNode(
  view: HallView,
  id: string,
  createId: () => string,
): { hall: HallElement; id: string } | null {
  const selectable = view.byId.get(id);
  if (!selectable) return null;
  let patch: HallAttrPatch = {};
  if (selectable.door) {
    const axis = doorAlongAttr(selectable.door.side);
    patch = { [axis]: doorStep(selectable.door, DUPLICATE_OFFSET) };
  } else if (selectable.object) {
    patch = nudgeAttrs(selectable.object, {
      x: DUPLICATE_OFFSET,
      y: DUPLICATE_OFFSET,
    });
  }
  return duplicateHallNode(view.hall, id, createId, patch);
}

/** Sets or removes one attribute (the properties panel). */
export function setNodeAttr(
  view: HallView,
  id: string,
  name: string,
  value: JsonValue | undefined,
): HallElement {
  return updateHallAttrs(view.hall, id, { [name]: value });
}

/**
 * The selectable a diagnostic at `path` belongs to: the node itself or
 * its nearest drawn ancestor (an attached label belongs to its object);
 * undefined for the hall and its structure.
 */
export function selectableForPath(
  view: HallView,
  path: readonly number[],
): HallSelectable | undefined {
  for (let length = path.length; length > 0; length--) {
    const id = view.index.byRowPath.get(rowPathKey(path.slice(0, length)));
    const found = id === undefined ? undefined : view.byId.get(id);
    if (found) return found;
  }
  return undefined;
}
