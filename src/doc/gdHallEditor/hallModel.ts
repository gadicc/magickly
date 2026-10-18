import { readBoolean, readNumber } from "@magick-components/gd/hall/attributes";
import { hallTagSpec } from "@magick-components/gd/hall/spec";
import type {
  HallArtRegistry,
  HallNode,
} from "@magick-components/gd/hall/types";
import { gdHallRow } from "../gdHallRows";
import type { JsonValue, RitualSemanticNode } from "../semantic";

/**
 * The visual hall editor's model (plan 061, decision 11): a hall is the
 * semantic `gdHall` element with its subtree, as ritual source holds it
 * (IDs on every element, source annotations kept). Every edit returns a
 * new element and leaves the old one untouched, so a host can hand it
 * straight to its history.
 */

/** A semantic element: the hall and every node in it. */
export type HallElement = Extract<RitualSemanticNode, { kind: "element" }>;

/** Where an element stands in a hall. */
export interface HallEntry {
  node: HallElement;
  /** Child indices from the hall through the semantic children. */
  path: readonly number[];
  /**
   * Child indices through the compiled row's children, which leave out
   * source annotations: the paths `resolveHall` and `validateHall` use.
   */
  rowPath: readonly number[];
  /** The parent element's ID; undefined for the hall itself. */
  parentId?: string;
}

/** The hall's elements by ID and by compiled row path. */
export interface HallIndex {
  byId: ReadonlyMap<string, HallEntry>;
  /** Row path key (`rowPathKey`) to element ID. */
  byRowPath: ReadonlyMap<string, string>;
}

/** A row path as a map key. */
export const rowPathKey = (path: readonly number[]): string => path.join(".");

/** Indexes a hall's elements; the hall itself is at `[]`. */
export function indexHall(hall: HallElement): HallIndex {
  const byId = new Map<string, HallEntry>();
  const byRowPath = new Map<string, string>();
  const visit = (
    node: HallElement,
    path: readonly number[],
    rowPath: readonly number[],
    parentId?: string,
  ) => {
    byId.set(node.id, { node, path, rowPath, parentId });
    byRowPath.set(rowPathKey(rowPath), node.id);
    let row = 0;
    node.children?.forEach((child, index) => {
      if (child.kind === "annotation") return;
      if (child.kind === "element")
        visit(child, [...path, index], [...rowPath, row], node.id);
      row++;
    });
  };
  visit(hall, [], []);
  return { byId, byRowPath };
}

/**
 * The row the reader draws for a hall (`gdHallRow`), or null while the
 * subtree is not valid source.
 */
export function hallRowOf(hall: HallElement): HallNode | null {
  return gdHallRow({
    id: hall.id,
    attrs: hall.attrs,
    children: hall.children ?? null,
  });
}

/** The hall with the element at `path` replaced by `update`'s result. */
function replaceAt(
  node: HallElement,
  path: readonly number[],
  update: (node: HallElement) => HallElement,
): HallElement {
  if (path.length === 0) return update(node);
  const [index, ...rest] = path;
  const children = [...(node.children ?? [])];
  const child = children[index];
  if (child?.kind !== "element") return node;
  children[index] = replaceAt(child, rest, update);
  return { ...node, children };
}

/** A value an attribute patch may set; `undefined` removes the attribute. */
export type HallAttrPatch = Readonly<Record<string, JsonValue | undefined>>;

/**
 * Sets or removes attributes of the element with `id`. The hall comes
 * back unchanged (the same object) when there is no such element or the
 * patch changes nothing.
 */
export function updateHallAttrs(
  hall: HallElement,
  id: string,
  patch: HallAttrPatch,
): HallElement {
  const entry = indexHall(hall).byId.get(id);
  if (!entry) return hall;
  const attrs = { ...entry.node.attrs };
  let changed = false;
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) {
      if (Object.hasOwn(attrs, name)) {
        delete attrs[name];
        changed = true;
      }
    } else if (!Object.hasOwn(attrs, name) || attrs[name] !== value) {
      attrs[name] = value;
      changed = true;
    }
  }
  if (!changed) return hall;
  return replaceAt(hall, entry.path, (node) => ({ ...node, attrs }));
}

/** Removes the element with `id` and its subtree; never the hall itself. */
export function removeHallNode(hall: HallElement, id: string): HallElement {
  const entry = indexHall(hall).byId.get(id);
  if (!entry || entry.path.length === 0) return hall;
  const index = entry.path.at(-1) as number;
  return replaceAt(hall, entry.path.slice(0, -1), (parent) => ({
    ...parent,
    children: (parent.children ?? []).filter((_, at) => at !== index),
  }));
}

/**
 * Inserts `node` into the element `parentId` at `index` (the end when
 * omitted).
 */
export function insertHallNode(
  hall: HallElement,
  parentId: string,
  node: HallElement,
  index?: number,
): HallElement {
  const entry = indexHall(hall).byId.get(parentId);
  if (!entry) return hall;
  return replaceAt(hall, entry.path, (parent) => {
    const children = [...(parent.children ?? [])];
    children.splice(index ?? children.length, 0, node);
    return { ...parent, children };
  });
}

/** A copy of an element and its subtree with a fresh ID on every element. */
export function withFreshIds(
  node: HallElement,
  createId: () => string,
): HallElement {
  return {
    ...node,
    id: createId(),
    attrs: { ...node.attrs },
    ...(node.children === undefined
      ? {}
      : {
          children: node.children.map((child) =>
            child.kind === "element"
              ? withFreshIds(child, createId)
              : structuredClone(child),
          ),
        }),
  };
}

/**
 * Copies the element `id` with fresh IDs throughout and puts the copy
 * right after it, with `patch` applied to the copy's attributes.
 */
export function duplicateHallNode(
  hall: HallElement,
  id: string,
  createId: () => string,
  patch: HallAttrPatch = {},
): { hall: HallElement; id: string } | null {
  const entry = indexHall(hall).byId.get(id);
  if (!entry?.parentId) return null;
  const copy = withFreshIds(entry.node, createId);
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) delete copy.attrs[name];
    else copy.attrs[name] = value;
  }
  return {
    hall: insertHallNode(
      hall,
      entry.parentId,
      copy,
      (entry.path.at(-1) as number) + 1,
    ),
    id: copy.id,
  };
}

/** `-0` as `0`: rounding can give `-0`, which the compiler keeps as it is. */
export const noNegativeZero = (value: number): number =>
  Object.is(value, -0) ? 0 : value;

/**
 * The hall as the editor writes it back (plan 061, decision 12 and Stage
 * B notes): numeric and boolean strings the legacy path left become
 * numbers and booleans where the vocabulary expects them, `-0` becomes
 * `0`, and every element gets `children`, so leaves print in Pug's bare
 * form, as `gdHallSource` gives presets. Anything else is kept as it is,
 * unknown attributes and tags included.
 */
export function normalizeHall(
  hall: HallElement,
  art: HallArtRegistry,
): HallElement {
  const visit = (node: HallElement): HallElement => {
    const row = { type: node.tag, ...node.attrs } as HallNode;
    const spec = hallTagSpec(node.tag, art, row);
    const attrs: Record<string, JsonValue> = {};
    for (const [name, value] of Object.entries(node.attrs)) {
      const kind = spec?.attributes.get(name)?.kind;
      let next: JsonValue = value;
      if (kind === "number" && typeof value === "string") {
        const reading = readNumber(value);
        if (reading.status === "ok") next = reading.value;
      } else if (kind === "boolean" && typeof value === "string") {
        const reading = readBoolean(value);
        if (reading.status === "ok") next = reading.value;
      }
      attrs[name] = typeof next === "number" ? noNegativeZero(next) : next;
    }
    return {
      ...node,
      attrs,
      children: (node.children ?? []).map((child) =>
        child.kind === "element" ? visit(child) : child,
      ),
    };
  };
  return visit(hall);
}
