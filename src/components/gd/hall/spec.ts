import { stringAttr } from "./attributes";
import type { HallArtRegistry, HallNode } from "./types";
import {
  CORE_ITEM_KINDS,
  HALL_TAGS,
  type HallTagRole,
  type HallTagSpec,
  IDENTIFIER,
  MAX_HALL_DEPTH,
  MAX_HALL_NODES,
  PLACEABLE_ATTRIBUTES,
  RESERVED_TAGS,
} from "./vocabulary";

/**
 * What the validator and the layout resolver share (plan 061, decision
 * 12): each tag's spec, where each role may stand and which nodes lie
 * within the node and depth bounds. Both read these, so what the validator
 * calls drawn, moved or ignored is what the resolver does.
 */

/**
 * The art registry key a node is drawn with: `lamen` for an officer,
 * `item:<kind>` for an item, otherwise the tag.
 */
export function hallArtKey(node: HallNode): string {
  if (node.type === "officer") return "lamen";
  if (node.type === "item")
    return `item:${stringAttr(node, "kind", 200) ?? ""}`;
  return node.type;
}

/**
 * A tag's spec: the package's own, or a placeable the art registry adds.
 * Given the node, the attributes its art declares (`item:<kind>`, the
 * officer's `lamen`) are added to a package tag's own, which win on a
 * clash.
 */
export function hallTagSpec(
  type: string,
  art?: HallArtRegistry,
  node?: HallNode,
): HallTagSpec | undefined {
  const own = HALL_TAGS.get(type);
  if (own) {
    const extra = node && art?.get(hallArtKey(node))?.attributes;
    return extra
      ? { role: own.role, attributes: new Map([...extra, ...own.attributes]) }
      : own;
  }
  // A registry key such as `item:cup` is not a tag: only an identifier is.
  const drawn = IDENTIFIER.test(type) ? art?.get(type) : undefined;
  if (!drawn || RESERVED_TAGS.has(type)) return undefined;
  return {
    role: "placeable",
    attributes: new Map([
      ...PLACEABLE_ATTRIBUTES,
      ...(drawn.attributes ?? new Map()),
    ]),
  };
}

/** Whether an item kind has art: the package's own or the registry's. */
export function itemKindKnown(kind: string, art?: HallArtRegistry): boolean {
  return CORE_ITEM_KINDS.has(kind) || art?.has(`item:${kind}`) === true;
}

/**
 * Where a child stands, by its parent's role and its own:
 *
 * - `allowed`: drawn where it is. A `label` child of a placeable or a host
 *   is attached to it; in the floor or a row it is free text.
 * - `floor`: a placeable, host or label directly under `gdHall`, drawn on
 *   the floor (the validator warns).
 * - `ignored`: not drawn (the validator reports an error).
 *
 * Unknown and reserved tags stand where a placeable may: they draw as
 * placeholders there.
 */
export type HallPlacement = "allowed" | "floor" | "ignored";

const ALLOWED_CHILDREN: ReadonlyMap<
  HallTagRole,
  ReadonlySet<HallTagRole>
> = new Map([
  ["root", new Set<HallTagRole>(["row", "floor", "caption", "door"])],
  ["row", new Set<HallTagRole>(["placeable", "host", "label"])],
  ["floor", new Set<HallTagRole>(["placeable", "host", "label", "door"])],
  ["host", new Set<HallTagRole>(["placeable", "host", "label"])],
  ["placeable", new Set<HallTagRole>(["label"])],
  ["caption", new Set<HallTagRole>()],
  ["door", new Set<HallTagRole>()],
  ["label", new Set<HallTagRole>()],
]);

const DRAWN_ROLES: ReadonlySet<HallTagRole> = new Set([
  "placeable",
  "host",
  "label",
]);

/** Where a child of role `child` stands under a parent of role `parent`. */
export function hallPlacement(
  parent: HallTagRole,
  child: HallTagRole,
): HallPlacement {
  if (ALLOWED_CHILDREN.get(parent)?.has(child)) return "allowed";
  return parent === "root" && DRAWN_ROLES.has(child) ? "floor" : "ignored";
}

/** The role a node stands as: its tag's, or a placeholder's. */
export function hallRole(type: string, art?: HallArtRegistry): HallTagRole {
  return hallTagSpec(type, art)?.role ?? "placeable";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Why a walk stopped short of a node. */
export type HallLimit = "nodes" | "depth";

/**
 * Walks a hall in document order within `MAX_HALL_NODES` and
 * `MAX_HALL_DEPTH`, calling `visit` for every node inside the bounds and
 * `limit` for every one beyond them. Every value counts towards the node
 * bound, labels and malformed values included. Only nodes with a spec
 * (known tags) are descended into; the children of unknown and reserved
 * tags are neither checked nor drawn.
 */
export function walkHall(
  hall: unknown,
  art: HallArtRegistry | undefined,
  visit: (
    node: unknown,
    path: readonly number[],
    parent: HallTagRole,
    depth: number,
  ) => void,
  limit: (path: readonly number[], reason: HallLimit) => void = () => {},
): void {
  let visited = 0;
  const step = (
    node: unknown,
    path: readonly number[],
    parent: HallTagRole,
    depth: number,
  ) => {
    if (++visited > MAX_HALL_NODES) return limit(path, "nodes");
    if (depth > MAX_HALL_DEPTH) return limit(path, "depth");
    visit(node, path, parent, depth);
    if (!isRecord(node) || typeof node.type !== "string") return;
    const spec = hallTagSpec(node.type, art);
    if (!spec || !Array.isArray(node.children)) return;
    node.children.forEach((child, index) =>
      step(child, [...path, index], spec.role, depth + 1),
    );
  };
  step(hall, [], "root", 0);
}

/** A path as a `Set` key. */
export const pathKey = (path: readonly number[]): string => path.join(".");

/** The paths of the nodes `walkHall` visits: the ones the resolver may draw. */
export function hallNodesInBounds(
  hall: unknown,
  art?: HallArtRegistry,
): ReadonlySet<string> {
  const inside = new Set<string>();
  walkHall(hall, art, (_node, path) => inside.add(pathKey(path)));
  return inside;
}
