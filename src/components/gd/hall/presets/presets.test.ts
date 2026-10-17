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
