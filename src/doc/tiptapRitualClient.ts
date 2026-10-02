"use client";

import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  RitualAtomForEditing,
  RitualBlockForEditing,
  RitualInlineForEditing,
} from "./ritualBlocks/renderForEditing";
import { ritualTiptapExtensions } from "./tiptapRitual";

/** Client presentation only; schema, clipboard HTML and saved JSON remain unchanged. */
export const ritualTiptapClientExtensions = ritualTiptapExtensions.map(
  (extension) => {
    if (!(extension instanceof Node)) return extension;
    if (extension.name === "ritualBlock" || extension.name === "ritualTask")
      return extension.extend({
        addNodeView() {
          return ReactNodeViewRenderer(RitualBlockForEditing);
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
          return ReactNodeViewRenderer(RitualAtomForEditing);
        },
      });
    return extension;
  },
);
