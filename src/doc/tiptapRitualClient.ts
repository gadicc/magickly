"use client";

import { Extension, Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  RitualAtomForEditing,
  RitualBlockForEditing,
  RitualInlineForEditing,
} from "./ritualBlocks/renderForEditing";
import { RitualFootnotesPresentation } from "./ritualFootnotesClient";
import { RitualSelectionInput } from "./ritualSelectionInput";
import { RitualSlashCommands } from "./ritualSlashCommands";
import { ritualTiptapExtensions } from "./tiptapRitual";

function softBreaks(doc: ProseMirrorNode) {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text?.includes("\n")) return;
    for (let index = node.text.indexOf("\n"); index >= 0; ) {
      decorations.push(
        Decoration.inline(pos + index, pos + index + 1, {
          class: "ritual-soft-break",
        }),
      );
      index = node.text.indexOf("\n", index + 1);
    }
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * Readers collapse a newline inside text to a space; ProseMirror's required
 * `pre-wrap` would show a line break. Decorate those characters so the editor
 * shows what readers see. Explicit `br` nodes still break.
 */
export const RitualSoftBreaks = Extension.create({
  name: "ritualSoftBreaks",
  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>("ritualSoftBreaks");
    return [
      new Plugin({
        key,
        state: {
          init: (_, state) => softBreaks(state.doc),
          apply: (tr, value) => (tr.docChanged ? softBreaks(tr.doc) : value),
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ];
  },
});

/** Whether an event comes from a hall atom's own controls or editor. */
export function insideHallControls(
  event: Event,
  dom: Element | undefined,
): boolean {
  const target = event.target;
  if (!(target instanceof Element) || !dom) return false;
  const controls = target.closest("[data-gd-hall-controls]");
  return !!controls && dom.contains(controls);
}

/** Client presentation only; schema, clipboard HTML and saved JSON remain unchanged. */
export const ritualTiptapClientExtensions = [
  ...ritualTiptapExtensions.map((extension) => {
    if (!(extension instanceof Node)) return extension;
    if (extension.name === "ritualBlock" || extension.name === "ritualTask")
      return extension.extend({
        addNodeView() {
          const owner = this.editor;
          return ReactNodeViewRenderer(RitualBlockForEditing, {
            className: "ritual-node-view",
            stopEvent: ({ event }) => {
              if (!(event.target instanceof Element)) return false;
              const control = event.target.closest(
                "[data-footnote-footer], button[data-footnote-reference], [data-task-settings]",
              );
              return !!control && owner.view.dom.contains(control);
            },
          });
        },
      });
    if (extension.name === "ritualInline")
      return extension.extend({
        addNodeView() {
          return ReactNodeViewRenderer(RitualInlineForEditing);
        },
      });
    if (extension.name === "ritualAtom")
      return extension.extend({
        addNodeView() {
          const render = ReactNodeViewRenderer(RitualAtomForEditing);
          return (props) => {
            const view = render(props);
            const stopEvent = view.stopEvent?.bind(view);
            // The hall editor's pointer, key and focus events are its own:
            // ProseMirror would select the atom, start a drag or take the
            // keys (plan 061, decision 11). Elsewhere the atom behaves as
            // before.
            view.stopEvent = (event: Event) =>
              insideHallControls(event, view.dom as Element | undefined) ||
              !!stopEvent?.(event);
            return view;
          };
        },
      });
    return extension;
  }),
  RitualFootnotesPresentation,
  RitualSelectionInput,
  RitualSlashCommands,
  RitualSoftBreaks,
];
