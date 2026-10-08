import type { RitualSemanticDocument, RitualSemanticNode } from "./semantic";

// Kept out of semantic.ts: those bytes are part of the reviewed semantic
// compiler identity (semanticCompile.ts), which this editor-side cleanup must
// not change.

/**
 * Drop empty text nodes, which render nothing. The legacy import keeps them at
 * interpolation boundaries; without them the source needs far fewer exact
 * text wrappers. Reader output is unchanged (see the corpus render test), so
 * the editor applies this to documents it loads; their next save omits them.
 */
export function withoutEmptyText(
  document: RitualSemanticDocument,
): RitualSemanticDocument {
  const strip = (nodes: RitualSemanticNode[]): RitualSemanticNode[] =>
    nodes
      .filter((node) => node.kind !== "text" || node.text !== "")
      .map((node) =>
        node.kind === "element" && node.children
          ? { ...node, children: strip(node.children) }
          : node,
      );
  return { ...document, nodes: strip(document.nodes) };
}
