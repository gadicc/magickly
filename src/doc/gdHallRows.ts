import type { HallNode } from "@magick-components/gd/hall/types";
import { createRitualNodeId } from "./ritualNodeIds";
import {
  type JsonValue,
  type RitualSemanticNode,
  semanticFromJrt,
  semanticToJrt,
} from "./semantic";

type Element = Extract<RitualSemanticNode, { kind: "element" }>;

/**
 * A hall as ritual source: a `gdHall` row tree (a preset, say) imported as
 * semantic elements with fresh IDs. Every node gets `children`, so leaves
 * print in Pug's bare form (`item#ID(kind="cup")`), the form authors type
 * and `prepare.js` produces; the printer writes `item#ID(…)/` only for a
 * node without `children` (plan 061, Stage B notes). Throws for rows that
 * break the compiler's shape rule.
 */
export function gdHallSource(
  hall: HallNode,
  createId: () => string = createRitualNodeId,
): Element {
  const [node] = semanticFromJrt(
    { children: [hall as unknown as JsonValue] },
    createId,
  ).nodes;
  if (node?.kind !== "element" || node.tag !== "gdHall")
    throw new Error("Not a valid hall");
  const leaves = (element: Element): Element => ({
    ...element,
    children: (element.children ?? []).map((child) =>
      child.kind === "element" ? leaves(child) : child,
    ),
  });
  return leaves(node);
}

/**
 * The compiled row the reader would draw for a hall element, as the editor
 * holds it (`id`, `attrs`, `children` of its atom): `semanticToJrt` on the
 * subtree, so the editor draws exactly what the reader will. Null while
 * the subtree is not valid source (a paste before its IDs are repaired).
 */
export function gdHallRow(
  atom: Readonly<Record<string, unknown>>,
): HallNode | null {
  try {
    const node = {
      kind: "element",
      id: atom.id,
      tag: "gdHall",
      attrs: atom.attrs,
      ...(atom.children == null ? {} : { children: atom.children }),
    } as Element;
    const compiled = semanticToJrt({
      format: "magickli-ritual",
      version: 1,
      nodes: [node],
    }) as { children: HallNode[] };
    return compiled.children[0] ?? null;
  } catch {
    return null;
  }
}
