import type { HallNode } from "@magick-components/gd/hall/types";
import { type RitualSemanticNode, semanticToJrt } from "./semantic";

type Element = Extract<RitualSemanticNode, { kind: "element" }>;

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
