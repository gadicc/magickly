import { HALL_PRESETS } from "@magick-components/gd/hall/presets";
import { describe, expect, it } from "vitest";
import { gdHallPug, parseHallSource, printHallSource } from "./gdHallPug";
import { gdHallSource } from "./gdHallRows";
import { parseRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import { RitualSourceError } from "./ritualSourceDiagnostics";
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

describe("a hall's own source, as /gd/hall shows it", () => {
  const hall = gdHallSource(HALL_PRESETS[0].hall);

  it("prints without the header, with or without IDs, and parses back", () => {
    const withIds = printHallSource(hall, { ids: true });
    expect(withIds.startsWith(`gdHall#${hall.id}`)).toBe(true);
    expect(withIds).not.toContain(RITUAL_PUG_HEADER);
    expect(parseHallSource(withIds)).toEqual(hall);
    const without = printHallSource(hall, { ids: false });
    expect(without).toBe(gdHallPug(HALL_PRESETS[0].hall));
    expect(compiled([parseHallSource(without)])).toEqual(compiled([hall]));
  });

  it("keeps comments inside the hall and ignores blank lines around it", () => {
    const parsed = parseHallSource(
      "\ngdHall\n  //- the floor\n  floor\n    altar\n\n\n",
    );
    expect(parsed.children?.[0]).toMatchObject({
      kind: "annotation",
      style: "comment",
    });
  });

  it("reports the author's lines, not the wrapped source's", () => {
    expect(() => parseHallSource("gdHall\n  floor\n    altar(x=.5)\n")).toThrow(
      /^Line 3:/,
    );
    try {
      parseHallSource("gdHall\n  floor\n  each x in y\n");
    } catch (error) {
      expect(error).toBeInstanceOf(RitualSourceError);
      expect((error as RitualSourceError).line).toBe(3);
    }
  });

  it("holds one hall and nothing beside it", () => {
    expect(() => parseHallSource("")).toThrow(
      "Line 1: the source holds no hall; start it with gdHall",
    );
    expect(() => parseHallSource("  \n\n")).toThrow(/holds no hall/);
    expect(() => parseHallSource("//- mine\ngdHall\n")).toThrow(
      "Line 1: only the hall goes here; put comments inside it",
    );
    expect(() => parseHallSource("gdHall\n  floor\ngdHall\n")).toThrow(
      "Line 3: only the hall goes here; put comments inside it",
    );
    expect(() => parseHallSource("note\n  | Some text\n")).toThrow(
      "Line 1: the source must be one temple hall, starting gdHall",
    );
    expect(() => parseHallSource("| text\n")).toThrow(/Line 1:/);
  });
});
