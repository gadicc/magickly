import { describe, expect, it } from "vitest";
import { gdHallArt } from "@/app/gd/hall/art";
import { isRitualNodeId } from "../ritualNodeIds";
import {
  duplicateHallNode,
  type HallElement,
  hallRowOf,
  indexHall,
  insertHallNode,
  noNegativeZero,
  normalizeHall,
  removeHallNode,
  rowPathKey,
  updateHallAttrs,
  withFreshIds,
} from "./hallModel";
import {
  byAttr,
  hallFromPug,
  neophyteHall,
  sequentialIds,
} from "./hallTestFixtures";

const ids = (node: HallElement): string[] => [
  node.id,
  ...(node.children ?? []).flatMap((child) =>
    child.kind === "element" ? ids(child) : [],
  ),
];

describe("indexHall", () => {
  it("maps IDs to semantic and compiled paths, skipping comments", () => {
    const hall = neophyteHall();
    const index = indexHall(hall);
    expect(index.byId.get(hall.id)).toMatchObject({ path: [], rowPath: [] });
    // The floor's first child is a comment: the East banner is semantic
    // child 1 but compiled child 0.
    const banner = byAttr(hall, "kind", "east");
    expect(index.byId.get(banner.id)).toMatchObject({
      path: [1, 1],
      rowPath: [1, 0],
    });
    expect(index.byRowPath.get(rowPathKey([1, 0]))).toBe(banner.id);
    expect(index.byId.get(banner.id)?.parentId).toBe(
      (hall.children?.[1] as HallElement).id,
    );
    // The compiled row has the banner where the index says.
    const row = hallRowOf(hall);
    expect(row?.children?.[1]?.children?.[0]).toMatchObject({
      type: "banner",
      kind: "east",
    });
  });

  it("gives nothing for a hall that is not valid source", () => {
    expect(
      hallRowOf({
        kind: "element",
        id: "bad",
        tag: "gdHall",
        attrs: {},
      }),
    ).toBeNull();
  });
});

describe("edits", () => {
  it("sets and removes attributes, keeping the rest of the hall", () => {
    const hall = neophyteHall();
    const hegemon = byAttr(hall, "role", "hegemon");
    const next = updateHallAttrs(hall, hegemon.id, {
      x: 9,
      labelPos: undefined,
    });
    expect(byAttr(next, "role", "hegemon").attrs).toEqual({
      role: "hegemon",
      x: 9,
      y: 3,
    });
    // The old hall is untouched; untouched subtrees are shared.
    expect(hegemon.attrs.x).toBe(8);
    expect(next.children?.[0]).toBe(hall.children?.[0]);
    expect(next.children?.[2]).toBe(hall.children?.[2]);
  });

  it("returns the same hall when nothing changes", () => {
    const hall = neophyteHall();
    const hegemon = byAttr(hall, "role", "hegemon");
    expect(updateHallAttrs(hall, hegemon.id, { x: 8, nope: undefined })).toBe(
      hall,
    );
    expect(updateHallAttrs(hall, "missing", { x: 1 })).toBe(hall);
    expect(removeHallNode(hall, hall.id)).toBe(hall);
    expect(removeHallNode(hall, "missing")).toBe(hall);
    expect(insertHallNode(hall, "missing", hall)).toBe(hall);
    expect(duplicateHallNode(hall, hall.id, sequentialIds())).toBeNull();
  });

  it("removes a node with its subtree", () => {
    const hall = neophyteHall();
    const altar = findTag(hall, "altar");
    const next = removeHallNode(hall, altar.id);
    expect(ids(next)).toHaveLength(ids(hall).length - 8);
    expect(ids(next)).not.toContain(altar.id);
  });

  it("inserts a node at an index or at the end", () => {
    const hall = hallFromPug("gdHall", "  floor", "    altar");
    const floor = hall.children?.[0] as HallElement;
    const node = (id: string): HallElement => ({
      kind: "element",
      id,
      tag: "pillar",
      attrs: {},
      children: [],
    });
    const first = insertHallNode(hall, floor.id, node("Aaaaaaaaaaaaaaa1"), 0);
    const last = insertHallNode(first, floor.id, node("Aaaaaaaaaaaaaaa2"));
    expect(
      (last.children?.[0] as HallElement).children?.map(
        (child) => (child as HallElement).id,
      ),
    ).toEqual([
      "Aaaaaaaaaaaaaaa1",
      (floor.children?.[0] as HallElement).id,
      "Aaaaaaaaaaaaaaa2",
    ]);
  });

  it("copies a subtree with fresh IDs everywhere, after the original", () => {
    const hall = neophyteHall();
    const platform = findTag(hall, "platform");
    const copy = duplicateHallNode(hall, platform.id, sequentialIds(), {
      x: 8.5,
      w: undefined,
    });
    if (!copy) throw new Error("no copy");
    const floor = copy.hall.children?.[1] as HallElement;
    const at = floor.children?.findIndex(
      (child) => child.kind === "element" && child.id === platform.id,
    ) as number;
    const placed = floor.children?.[at + 1] as HallElement;
    expect(placed.id).toBe(copy.id);
    expect(placed.attrs).toEqual({ x: 8.5, y: 14.5, h: 3 });
    expect(ids(placed)).toEqual(["Test000000000001", "Test000000000002"]);
    expect(ids(placed).every(isRitualNodeId)).toBe(true);
    // The original keeps its own.
    expect(ids(platform).some((id) => ids(placed).includes(id))).toBe(false);
  });

  it("keeps comments when copying", () => {
    const hall = neophyteHall();
    const floor = hall.children?.[1] as HallElement;
    const copy = withFreshIds(floor, sequentialIds());
    expect(copy.children?.[0]).toEqual(floor.children?.[0]);
    expect(copy.children?.[0]).not.toBe(floor.children?.[0]);
    const leaf = withFreshIds(
      { kind: "element", id: "x", tag: "altar", attrs: {} },
      sequentialIds(),
    );
    expect(leaf).not.toHaveProperty("children");
  });
});

describe("normalizeHall", () => {
  it("writes numbers and booleans the vocabulary expects, and leaves", () => {
    const hall: HallElement = {
      kind: "element",
      id: "Aaaaaaaaaaaaaaa0",
      tag: "gdHall",
      attrs: { dais: "4", compass: "false", wall: "plain" },
      children: [
        {
          kind: "element",
          id: "Aaaaaaaaaaaaaaa1",
          tag: "floor",
          attrs: {},
          children: [
            {
              kind: "element",
              id: "Aaaaaaaaaaaaaaa2",
              tag: "pillar",
              attrs: {
                x: "9.4",
                y: -0,
                glow: "true",
                scale: "null",
                kind: "black",
                label: "12",
                odd: "3",
                bad: "abc",
              },
            },
            {
              kind: "element",
              id: "Aaaaaaaaaaaaaaa3",
              tag: "item",
              // An art-declared attribute: the tablet's element is an enum.
              attrs: { kind: "cup", x: "1e999", fill: "red" },
            },
            { kind: "annotation", style: "comment", text: "kept" },
          ],
        },
      ],
    };
    const next = normalizeHall(hall, gdHallArt);
    expect(next.attrs).toEqual({ dais: 4, compass: false, wall: "plain" });
    const floor = next.children?.[0] as HallElement;
    expect(floor.children?.[0]).toEqual({
      kind: "element",
      id: "Aaaaaaaaaaaaaaa2",
      tag: "pillar",
      attrs: {
        x: 9.4,
        y: 0,
        glow: true,
        // Not a number: kept for the validator to report.
        scale: "null",
        kind: "black",
        label: "12",
        odd: "3",
        bad: "abc",
      },
      children: [],
    });
    expect(Object.is((floor.children?.[0] as HallElement).attrs.y, 0)).toBe(
      true,
    );
    expect((floor.children?.[1] as HallElement).attrs.x).toBe("1e999");
    expect(floor.children?.[2]).toEqual({
      kind: "annotation",
      style: "comment",
      text: "kept",
    });
  });

  it("changes nothing in a hall written by the editor", () => {
    const hall = normalizeHall(neophyteHall(), gdHallArt);
    expect(normalizeHall(hall, gdHallArt)).toEqual(hall);
  });

  it("turns -0 into 0 only", () => {
    expect(Object.is(noNegativeZero(-0), 0)).toBe(true);
    expect(noNegativeZero(-0.5)).toBe(-0.5);
  });
});

function findTag(hall: HallElement, tag: string): HallElement {
  const visit = (node: HallElement): HallElement | undefined => {
    if (node.tag === tag) return node;
    for (const child of node.children ?? [])
      if (child.kind === "element") {
        const found = visit(child);
        if (found) return found;
      }
    return undefined;
  };
  return visit(hall) as HallElement;
}
