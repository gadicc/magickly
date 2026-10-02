import type { RitualSemanticNode } from "./semantic";

/** A pilot visual-editor limit; the semantic format itself retains nested tasks. */
export function hasDirectNestedTask(nodes: RitualSemanticNode[]): boolean {
  for (const node of nodes) {
    if (node.kind !== "element" || !node.children) continue;
    if (
      node.tag === "task" &&
      node.children.some(
        (child) => child.kind === "element" && child.tag === "task",
      )
    )
      return true;
    if (hasDirectNestedTask(node.children)) return true;
  }
  return false;
}
