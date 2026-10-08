"use client";

import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

// Nodes that print as their own source header line; inline spans do not.
const blocks = new Set(["ritualTask", "ritualBlock", "ritualAtom"]);

/** The innermost block-level ritual node at the visual selection. */
export function ritualNodeIdAtSelection(editor: Editor): string | null {
  const { selection } = editor.state;
  if (
    selection instanceof NodeSelection &&
    blocks.has(selection.node.type.name)
  )
    return selection.node.attrs.id ?? null;
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (blocks.has(node.type.name) && node.attrs.id) return node.attrs.id;
  }
  return null;
}

/**
 * Scroll the visual editor's own scroller to a node without touching its
 * selection or focus: nothing when it is already in view, otherwise centred.
 */
export function revealRitualNode(editor: Editor, id: string): boolean {
  let pos = -1;
  editor.state.doc.descendants((node, at) => {
    if (pos >= 0) return false;
    if (blocks.has(node.type.name) && node.attrs.id === id) {
      pos = at;
      return false;
    }
  });
  if (pos < 0) return false;
  const dom = editor.view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return false;
  let scroller = editor.view.dom.parentElement;
  while (
    scroller &&
    !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
  )
    scroller = scroller.parentElement;
  const node = dom.getBoundingClientRect();
  // Collected footnote bodies stay hidden at their canonical position.
  if (!scroller || !node.height) return false;
  const view = scroller.getBoundingClientRect();
  if (node.top >= view.top && node.bottom <= view.bottom) return true;
  scroller.scrollTop +=
    node.top - view.top - Math.max(0, (view.height - node.height) / 2);
  return true;
}
