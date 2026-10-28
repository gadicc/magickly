import { describe, expect, it } from "vitest";
import type { HallNode } from "../types";
import { validateHall } from "../validate";
import { RESERVED_ATTRIBUTES, RESERVED_TAGS } from "../vocabulary";
import {
  dais,
  HALL_PRESETS,
  hallPreset,
  hallSourceText,
  hallSourceUrl,
} from ".";

const nodes = (node: HallNode): HallNode[] => [
  node,
  ...(node.children ?? []).flatMap(nodes),
];

describe("the hall presets", () => {
  it("are found by id, and nothing else is", () => {
    for (const preset of HALL_PRESETS)
      expect(hallPreset(preset.id)).toBe(preset);
    for (const id of ["", "constructor", "practicus4", "portal"])
      expect(hallPreset(id)).toBeUndefined();
  });

  it("each cite at least one source", () => {
    for (const preset of HALL_PRESETS)
      expect(preset.sources.length, preset.id).toBeGreaterThan(0);
  });

  it("cite each page by its own leaf, as the plan's leaf table lists them", () => {
    // Plan 061, Sources: printed page and archive.org leaf of each diagram
    // and rubric cited.
    const leaves = new Map([
      [11, 3],
      [44, 38],
      [69, 63],
      [82, 76],
      [92, 86],
      [106, 100],
      [112, 106],
      [121, 115],
      [122, 116],
      [131, 125],
      [137, 131],
      [144, 138],
      [145, 139],
      [155, 148],
      [156, 149],
      [175, 168],
    ]);
    for (const preset of HALL_PRESETS)
      for (const source of preset.sources)
        expect(source.leaf, `${preset.id} p.${source.page}`).toBe(
          leaves.get(source.page),
        );
  });

  it("cite the book page of their own hall, or say what they take", () => {
    // Plan 061, Sources: the 1938 diagram of each part. The Zelator second
    // part's is not yet located; p.44 draws the first part, so the second
    // cites it only for what it takes from it (the North wall), and says so.
    const pages = Object.fromEntries(
      HALL_PRESETS.map((preset) => [
        preset.id,
        preset.sources.flatMap((source) => [source.page, source.note]),
      ]),
    );
    expect(pages).toEqual({
      neophyte: [11, undefined],
      zelator1: [44, undefined],
      zelator2: [44, "the Earth tablet, lamp and salt only"],
      theoricus1: [69, undefined],
      theoricus2: [82, undefined],
      practicus1: [92, undefined],
      practicus2: [106, undefined],
      practicus3: [112, undefined],
      philosophus1: [121, undefined, 122, "the rubric"],
      philosophus2: [131, undefined],
      philosophus3: [137, undefined],
      philosophus4: [144, undefined, 145, "the rubric, continued"],
      // Conflict 1: each part takes the diagram its own rubric describes,
      // which the book prints at the head of the other part.
      portal1: [
        175,
        "its diagram, which the book heads part 2",
        156,
        "the rubric of part 1, pp.156–157",
      ],
      portal2: [
        155,
        "its diagram, which the book heads part 1",
        175,
        "the rubric of part 2",
      ],
    });
  });

  it("write each source one way, with a stable link", () => {
    // Only the primary sources (Gadi, 28 October 2026).
    expect(HALL_PRESETS[1].sources.map(hallSourceText)).toEqual([
      "Regardie 1938, vol. 2, p.44 (archive.org leaf n38)",
    ]);
    expect(HALL_PRESETS[2].sources.map(hallSourceText)).toEqual([
      "Regardie 1938, vol. 2, p.44 (archive.org leaf n38) (the Earth tablet, lamp and salt only)",
    ]);
    expect(HALL_PRESETS[1].sources.map(hallSourceUrl)).toEqual([
      "https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol2-1938/page/n38",
    ]);
  });

  it("use no reserved tag or attribute", () => {
    for (const preset of HALL_PRESETS)
      for (const node of nodes(preset.hall)) {
        expect(RESERVED_TAGS.has(node.type), node.type).toBe(false);
        for (const name of Object.keys(node))
          if (name !== "type" && name !== "children")
            expect(RESERVED_ATTRIBUTES.has(name), name).toBe(false);
      }
  });

  it("validate with no errors even without the app's art", () => {
    for (const preset of HALL_PRESETS)
      expect(
        validateHall(preset.hall).filter((d) => d.severity === "error"),
        preset.id,
      ).toEqual([]);
  });

  it("spread the dais evenly, centred in the dais", () => {
    expect(dais().children?.map((child) => child.y)).toEqual(
      Array(5).fill(undefined),
    );
  });
});
