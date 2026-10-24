import {
  type Rect,
  type ResolvedDoor,
  type ResolvedHall,
  type ResolvedObject,
  resolveHall,
} from "@magick-components/gd/hall/layout";
import { PLANET_NAMES, type Planet } from "@magick-components/gd/hall/planets";
import type {
  HallArtRegistry,
  HallNode,
} from "@magick-components/gd/hall/types";
import {
  BOARD_NAMES,
  type BoardKind,
  CARD_TITLES,
  type CardKind,
  roleName,
} from "@magick-components/gd/hall/vocabulary";
import {
  hasGradeLamen,
  LAMEN_GRADE_NAMES,
  type LamenGrade,
} from "@magick-components/gd/lamenGrades";
import type { JsonValue } from "../semantic";
import {
  compareRowPaths,
  doorAlongAttr,
  doorStep,
  dragScale,
  moveAttrs,
  moveDoor,
  nudgeAttrs,
  objectRect,
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
import {
  patchFreezingRow,
  reorderable,
  reorderIndex,
  reorderRowChild,
  rowPlace,
} from "./hallRows";

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
  if (tag === "officer" || tag === "lamen") {
    if (!role) return tag === "officer" ? "Officer" : "Lamen";
    // The Portal's Hiereus and Hegemon, who wear lamens of their own.
    const grade = text(node, "grade");
    return grade && hasGradeLamen(role, grade)
      ? `${clip(roleName(role))} (${LAMEN_GRADE_NAMES.get(grade as LamenGrade)})`
      : clip(roleName(role));
  }
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
    if (element === "union") return "Tablet of Union";
    return element ? `${clip(itemKindLabel(element))} tablet` : "Tablet";
  }
  if (tag === "altar") return kind === "white" ? "White altar" : "Altar";
  if (tag === "board") {
    const diagram = BOARD_NAMES.get(kind as BoardKind);
    return diagram ? `Board: ${diagram}` : "Board";
  }
  if (tag === "card") {
    const title = CARD_TITLES.get(kind as CardKind);
    return title ? `Card: ${title}` : "Card";
  }
  if (tag === "kamea" || tag === "seal") {
    const planet = PLANET_NAMES.get(text(node, "planet") as Planet);
    const name = tag === "kamea" ? "Kamea" : "Seals";
    return planet ? `${name} of ${planet}` : name;
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

/**
 * Moves a node by `delta` floor squares (a drag). A row child the row
 * spreads is reordered among the spread children instead (nothing
 * written but the order), unless `snap` is off (Alt): then it takes the
 * position, and its spread siblings theirs (`patchFreezingRow`).
 */
export function moveNode(
  view: HallView,
  id: string,
  delta: Point,
  snap: boolean,
): HallElement {
  const selectable = view.byId.get(id);
  if (!selectable) return view.hall;
  const place = snap && selectable.object && rowPlace(view, id);
  if (place && selectable.object && reorderable(view, id)) {
    const along = place.along;
    return reorderRowChild(
      view,
      id,
      reorderIndex(view, id, selectable.object.position[along] + delta[along]),
    );
  }
  return patchFreezingRow(view, id, movePatch(selectable, delta, snap));
}

/** What a reordering drag shows before it is released. */
export interface RowDragPreview {
  /** The hall the release writes: the row in its new order. */
  hall: HallElement;
  /**
   * The hall drawn meanwhile: the dragged child under the pointer along
   * the row, the others where the new order spreads them.
   */
  preview: HallElement;
  /** Where the dragged child lands: the insertion mark. */
  slot: Rect;
}

/**
 * A drag of `delta` floor squares on a row child the row spreads, as it
 * reorders it (`moveNode` with snapping); undefined for anything else.
 */
export function rowDragPreview(
  view: HallView,
  id: string,
  delta: Point,
  art: HallArtRegistry,
): RowDragPreview | undefined {
  const object = view.byId.get(id)?.object;
  const place = rowPlace(view, id);
  if (!object || !place || !reorderable(view, id)) return undefined;
  const hall = moveNode(view, id, delta, true);
  const reordered = hall === view.hall ? view : hallView(hall, art);
  const landed = reordered.byId.get(id)?.object;
  if (!landed) return undefined;
  const along = place.along;
  let preview = hall;
  for (const entry of rowPlace(reordered, id)?.spread ?? [])
    if (entry.object)
      preview = updateHallAttrs(preview, entry.id, {
        [along]:
          entry.id === id
            ? object.position[along] + delta[along]
            : entry.object.position[along],
      });
  return { hall, preview, slot: objectRect(landed) };
}

/**
 * Moves a spread row child one place earlier (`-1`, towards the row's
 * North or East end) or later (`1`) among the spread children: Alt and an
 * arrow key, or the panel's buttons.
 */
export function stepInRow(
  view: HallView,
  id: string,
  step: -1 | 1,
): HallElement {
  const place = rowPlace(view, id);
  const index = place?.spread.findIndex((entry) => entry.id === id) ?? -1;
  if (!place || index < 0) return view.hall;
  const to = index + step;
  if (to < 0 || to >= place.spread.length) return view.hall;
  return reorderRowChild(view, id, to);
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
  return patchFreezingRow(view, id, nudgeAttrs(selectable.object, step));
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

/**
 * Sets or removes one attribute (the properties panel); a position along
 * its row given to a spread row child freezes its siblings
 * (`patchFreezingRow`).
 */
export function setNodeAttr(
  view: HallView,
  id: string,
  name: string,
  value: JsonValue | undefined,
): HallElement {
  return patchFreezingRow(view, id, { [name]: value });
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
