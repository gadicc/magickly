"use client";

import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import styles from "./ritualBlocks/editing.module.css";
import { planRitualFootnotes } from "./ritualFootnotes";

/** A position remains editor-local; saved footnote identity stays on the original node. */
export interface EditorFootnote {
  node: ProseMirrorNode;
  /** Absolute position before this node in the parent document. */
  pos: number;
  children: EditorFootnote[];
}
/** Editor-local membership and paragraph decorations for one immutable document. */
export interface EditorFootnotePlan {
  references: Map<number, { host: number | null; number: number }>;
  collections: Map<number, EditorFootnote[]>;
  decorations: DecorationSet;
}
export const ritualFootnotesKey = new PluginKey<EditorFootnotePlan>(
  "ritualFootnotes",
);

function plan(doc: ProseMirrorNode): EditorFootnotePlan {
  const build = (node: ProseMirrorNode, pos: number): EditorFootnote => {
    const entry: EditorFootnote = { node, pos, children: [] };
    node.forEach((child, offset) =>
      entry.children.push(build(child, pos + 1 + offset)),
    );
    return entry;
  };
  const root = build(doc, -1);
  const planned = planRitualFootnotes(
    root,
    (entry) => String(entry.node.attrs.tag ?? ""),
    (entry) => entry.children,
    (entry) =>
      !["declareVar", "img", "br", "grade", "var", "hr", "legacy"].includes(
        String(entry.node.attrs.tag),
      ),
  );
  const references = new Map<number, { host: number | null; number: number }>();
  const collections = new Map<number, EditorFootnote[]>();
  for (const [entry, ref] of planned.references)
    references.set(entry.pos, {
      host: ref.host?.pos ?? null,
      number: ref.number,
    });
  for (const [host, notes] of planned.collections)
    collections.set(host.pos, notes);
  const decorations: Decoration[] = [];
  const inlineParagraphs = (entry: EditorFootnote) => {
    entry.children.forEach((child, index, siblings) => {
      if (
        child.node.type.name === "paragraph" &&
        [siblings[index - 1], siblings[index + 1]].some(
          (adjacent) => adjacent && references.get(adjacent.pos)?.host != null,
        )
      ) {
        decorations.push(
          Decoration.node(child.pos, child.pos + child.node.nodeSize, {
            class: styles.continuation,
          }),
        );
      }
      inlineParagraphs(child);
    });
  };
  inlineParagraphs(root);
  return {
    references,
    collections,
    decorations: DecorationSet.create(doc, decorations),
  };
}

/** Compute membership once per document change, shared by all node views. */
export const RitualFootnotesPresentation = Extension.create({
  name: "ritualFootnotesPresentation",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: ritualFootnotesKey,
        state: {
          init: (_, state) => plan(state.doc),
          apply: (tr, previous) => (tr.docChanged ? plan(tr.doc) : previous),
        },
        props: {
          decorations: (state) =>
            ritualFootnotesKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});
