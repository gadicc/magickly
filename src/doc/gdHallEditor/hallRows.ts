import { enumAttr, numberAttr } from "@magick-components/gd/hall/attributes";
import type { HallNode } from "@magick-components/gd/hall/types";
import {
  BANNER_SIDES,
  HALL_POINTS,
} from "@magick-components/gd/hall/vocabulary";
import type { HallSelectable, HallView } from "./hallEdits";
import { round2 } from "./hallGeometry";
import {
  type HallAttrPatch,
  type HallElement,
  indexHall,
  updateHallAttrs,
} from "./hallModel";

/**
 * Rows in the visual hall editor (plan 061, Stage E notes; Gadi's
 * decision of 19 October 2026). A `dais` or `banners` row spreads the
 * children that have no position along it; dragging such a child along
 * the row reorders it among them, and the row keeps its spread. An
 * explicit position stays possible (the panel's field, an Alt-drag, the
 * arrow keys): writing one freezes the other spread children where they
 * stand, by writing theirs, so nothing jumps; "Spread evenly again" takes
 * every explicit position along the row away.
 */

/** A row child's place: its row and how the row runs. */
export interface HallRowPlace {
  /** The `dais` or `banners` element. */
  row: HallElement;
  /** The attribute that places a child along the row. */
  along: "x" | "y";
  /** The row's drawn children, in document order. */
  children: readonly HallSelectable[];
  /** Those the row spreads: no position along it, no `at`. */
  spread: readonly HallSelectable[];
}

const rowNode = (node: HallElement): HallNode =>
  ({ type: node.tag, ...node.attrs }) as HallNode;

/** Whether a row places `node` with `at` (its `x` and `y` are offsets). */
const anchoredAt = (node: HallElement) =>
  enumAttr(rowNode(node), "at", [...HALL_POINTS, "center"]) !== undefined;

/**
 * Whether the row spreads `node`, as the resolver decides: no valid `at`
 * and no number along the row.
 */
export const spreadByRow = (node: HallElement, along: "x" | "y") =>
  !anchoredAt(node) && numberAttr(rowNode(node), along) === undefined;

/** The row a selectable stands in, or undefined when it stands elsewhere. */
export function rowPlace(view: HallView, id: string): HallRowPlace | undefined {
  const parentId = view.index.byId.get(id)?.parentId;
  const row = parentId ? view.index.byId.get(parentId)?.node : undefined;
  if (!row || (row.tag !== "dais" && row.tag !== "banners")) return undefined;
  const side =
    row.tag === "banners"
      ? (enumAttr(rowNode(row), "side", BANNER_SIDES) ?? "east")
      : "east";
  const along = side === "north" || side === "south" ? "y" : "x";
  const children = view.selectables.filter(
    (entry) =>
      entry.object && view.index.byId.get(entry.id)?.parentId === row.id,
  );
  return {
    row,
    along,
    children,
    spread: children.filter((entry) => spreadByRow(entry.node, along)),
  };
}

/** Whether `id` is a row child the row spreads: one a drag reorders. */
export function reorderable(view: HallView, id: string): boolean {
  const place = rowPlace(view, id);
  return !!place?.spread.some((entry) => entry.id === id);
}

/**
 * The hall with the spread row child `id` moved to `index` among the
 * row's spread children (0 first), its node and ID kept, nothing else
 * written: the row spreads it there. In the row's children it goes just
 * before the spread child it now precedes, or just after the last.
 */
export function reorderRowChild(
  view: HallView,
  id: string,
  index: number,
): HallElement {
  const place = rowPlace(view, id);
  if (!place || !reorderable(view, id)) return view.hall;
  const others = place.spread.filter((entry) => entry.id !== id);
  const at = Math.max(0, Math.min(others.length, Math.round(index)));
  const children = [...(place.row.children ?? [])];
  const from = children.findIndex(
    (child) => child.kind === "element" && child.id === id,
  );
  if (from < 0) return view.hall;
  const [moved] = children.splice(from, 1);
  const anchor = others[at] ?? others.at(-1);
  let to = children.length;
  if (anchor) {
    const anchorIndex = children.findIndex(
      (child) => child.kind === "element" && child.id === anchor.id,
    );
    to = others[at] ? anchorIndex : anchorIndex + 1;
  }
  children.splice(to, 0, moved);
  // Unchanged order: the same hall, so nothing is committed.
  if (
    children.every(
      (child, position) => child === place.row.children?.[position],
    )
  )
    return view.hall;
  return replaceChildren(view.hall, place.row.id, children);
}

/** The hall with the element `id`'s children replaced. */
function replaceChildren(
  hall: HallElement,
  id: string,
  children: HallElement["children"],
): HallElement {
  const entry = indexHall(hall).byId.get(id);
  if (!entry) return hall;
  const replace = (node: HallElement, path: readonly number[]): HallElement => {
    if (path.length === 0) return { ...node, children };
    const [index, ...rest] = path;
    const next = [...(node.children ?? [])];
    const child = next[index];
    if (child?.kind !== "element") return node;
    next[index] = replace(child, rest);
    return { ...node, children: next };
  };
  return replace(hall, entry.path);
}

/**
 * Where among the spread children a row child dragged to `position` along
 * the row lands: after every other spread child that stands before it.
 */
export function reorderIndex(
  view: HallView,
  id: string,
  position: number,
): number {
  const place = rowPlace(view, id);
  if (!place) return 0;
  return place.spread.filter(
    (entry) =>
      entry.id !== id &&
      entry.object &&
      entry.object.position[place.along] < position,
  ).length;
}

/**
 * Applies `patch` to the row child `id` and, when it gives a spread child
 * a position along its row, writes every other spread child's current
 * position too, so the row does not spread again around it and nothing
 * else moves. Elsewhere it is `patch` alone.
 */
export function patchFreezingRow(
  view: HallView,
  id: string,
  patch: HallAttrPatch,
): HallElement {
  const next = updateHallAttrs(view.hall, id, patch);
  if (next === view.hall) return next;
  const place = rowPlace(view, id);
  const value = place && patch[place.along];
  if (
    !place ||
    value === undefined ||
    !place.spread.some((entry) => entry.id === id)
  )
    return next;
  let hall = next;
  for (const entry of place.spread) {
    if (entry.id === id || !entry.object) continue;
    hall = updateHallAttrs(hall, entry.id, {
      [place.along]: round2(entry.object.position[place.along]),
    });
  }
  return hall;
}

/**
 * Whether "Spread evenly again" has anything to do for the row holding
 * `id`: some child without `at` has a position along the row.
 */
export function rowHasPositions(view: HallView, id: string): boolean {
  const place = rowPlace(view, id);
  return !!place?.children.some(
    (entry) =>
      !anchoredAt(entry.node) && Object.hasOwn(entry.node.attrs, place.along),
  );
}

/**
 * "Spread evenly again": the row holding `id` without any position along
 * it (children placed with `at` keep theirs, which are offsets), so the
 * row spreads them all in their order.
 */
export function spreadRowEvenly(view: HallView, id: string): HallElement {
  const place = rowPlace(view, id);
  if (!place) return view.hall;
  let hall = view.hall;
  for (const child of place.row.children ?? []) {
    if (child.kind !== "element" || anchoredAt(child)) continue;
    hall = updateHallAttrs(hall, child.id, { [place.along]: undefined });
  }
  return hall;
}
