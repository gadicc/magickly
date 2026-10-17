import { describe, expect, it } from "vitest";
import type { HallNode } from "../types";
import { validateHall } from "../validate";
import { RESERVED_ATTRIBUTES, RESERVED_TAGS } from "../vocabulary";
import { dais, HALL_PRESETS, hallPreset } from ".";

const nodes = (node: HallNode): HallNode[] => [
  node,
  ...(node.children ?? []).flatMap(nodes),
];

describe("the hall presets", () => {
  it("are found by id, and nothing else is", () => {
    for (const preset of HALL_PRESETS)
      expect(hallPreset(preset.id)).toBe(preset);
    for (const id of ["", "constructor", "practicus1"])
      expect(hallPreset(id)).toBeUndefined();
  });

  it("each cite at least one source", () => {
    for (const preset of HALL_PRESETS)
      expect(preset.sources.length, preset.id).toBeGreaterThan(0);
  });

  it("cite the book page of their own hall, or say what they take", () => {
    // Plan 061, Sources: the 1938 diagram of each part. The Zelator second
    // part's is not yet located; p.44 draws the first part, so the second
    // cites it only for what it takes from it (the North wall), and says so.
    const pages = Object.fromEntries(
      HALL_PRESETS.map((preset) => [
        preset.id,
        preset.sources.flatMap(
          (source) =>
            source.match(/, p\.(\d+), leaf n\d+( \(.+\))?$/)?.slice(1) ?? [],
        ),
      ]),
    );
    expect(pages).toEqual({
      neophyte: ["11", undefined],
      zelator1: ["44", undefined],
      zelator2: ["44", " (the Earth tablet, lamp and salt only)"],
      theoricus1: ["69", undefined],
      theoricus2: ["82", undefined],
    });
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

  it("spread the dais evenly unless a drawing puts it lower", () => {
    expect(dais().children?.map((child) => child.y)).toEqual(
      Array(5).fill(undefined),
    );
    expect(dais(-2.7).children?.every((child) => child.y === -2.7)).toBe(true);
  });
});
