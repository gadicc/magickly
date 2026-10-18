import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { describe, expect, it } from "vitest";
import { gdHallPug } from "./gdHallPug";
import { gdHallSource } from "./gdHallRows";
import { parseRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import {
  type RitualSemanticNode,
  semanticToJrt,
  validateRitualSemantic,
} from "./semantic";

const compiled = (nodes: RitualSemanticNode[]) =>
  semanticToJrt({ format: "magickli-ritual", version: 1, nodes });
const ids = (node: RitualSemanticNode): string[] =>
  node.kind === "element"
    ? [node.id, ...(node.children ?? []).flatMap(ids)]
    : [];

describe.each(HALL_PRESETS.map((preset) => [preset.id, preset] as const))(
  "the %s preset as Pug to paste",
  (_id, preset) => {
    const text = gdHallPug(preset.hall);

    it("parses back to the preset, with no IDs in the text", () => {
      expect(text).toMatch(/^gdHall[(\n]/);
      expect(text).not.toContain("#");
      const doc = parseRitualPug(`${RITUAL_PUG_HEADER}\n${text}`);
      expect(compiled(doc.nodes)).toEqual(
        compiled([gdHallSource(preset.hall)]),
      );
    });

    it("can be pasted twice, each copy with its own IDs", () => {
      const doc = parseRitualPug(`${RITUAL_PUG_HEADER}\n${text}${text}`);
      expect(validateRitualSemantic(doc)).toEqual([]);
      const [a, b] = doc.nodes;
      const seen = new Set(ids(a));
      expect(ids(b).some((id) => seen.has(id))).toBe(false);
    });

    it("can be indented into a note", () => {
      const indented = text
        .split("\n")
        .map((line) => (line ? `  ${line}` : line))
        .join("\n");
      const doc = parseRitualPug(`${RITUAL_PUG_HEADER}\nnote\n${indented}`);
      expect(doc.nodes[0]).toMatchObject({
        tag: "note",
        children: [{ tag: "gdHall" }],
      });
    });
  },
);
