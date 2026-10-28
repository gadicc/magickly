import {
  type ResolvedObject,
  resolveHall,
} from "@magick-components/gd/hall/layout";
import { describe, expect, it } from "vitest";
import { gdHallArt } from "@/app/gd/halls/art";
import {
  compareRowPaths,
  coordinateValue,
  DOOR_HIT_DEPTH,
  doorAlongAttr,
  doorRect,
  dragScale,
  hitRects,
  hitTest,
  MIN_HIT_SIZE,
  moveAttrs,
  moveDoor,
  nudgeAttrs,
  round2,
  scaleValue,
  snapHalf,
  stepScale,
} from "./hallGeometry";
import { hallRowOf } from "./hallModel";
import { hallFromPug, neophyteHall } from "./hallTestFixtures";

const resolved = (hall = neophyteHall()) =>
  resolveHall(hallRowOf(hall) ?? { type: "gdHall" }, { art: gdHallArt });
const object = (
  objects: readonly ResolvedObject[],
  path: number[],
): ResolvedObject =>
  objects.find(
    (candidate) => candidate.path.join() === path.join(),
  ) as ResolvedObject;
const isNegativeZero = (value: number | undefined) => Object.is(value, -0);

describe("rounding and snapping", () => {
  it("rounds to two decimals and never gives -0", () => {
    expect(round2(1.23456)).toBe(1.23);
    expect(round2(-0.004)).toBe(0);
    expect(isNegativeZero(round2(-0.004))).toBe(false);
    expect(snapHalf(1.26)).toBe(1.5);
    expect(snapHalf(-0.2)).toBe(0);
    expect(isNegativeZero(snapHalf(-0.2))).toBe(false);
    expect(coordinateValue(1e6)).toBe(64);
    expect(coordinateValue(-1e6)).toBe(-48);
    expect(scaleValue(0)).toBe(0.05);
    expect(scaleValue(99)).toBe(10);
  });
});

describe("moveAttrs", () => {
  const floorObject = {
    frame: { ox: 0, oy: 0, unit: 1 },
    position: { x: 8, y: 3 },
  };

  it("snaps a floor object's move to half squares", () => {
    expect(moveAttrs(floorObject, { x: 1.3, y: 0.6 }, true)).toEqual({
      x: 9.5,
      y: 3.5,
    });
    // Without snapping (Alt), two decimals.
    expect(moveAttrs(floorObject, { x: 1.3333, y: -0.111 }, false)).toEqual({
      x: 9.33,
      y: 2.89,
    });
  });

  it("leaves an axis the drag hardly moved along", () => {
    expect(moveAttrs(floorObject, { x: 2, y: 0.2 }, true)).toEqual({ x: 10 });
    expect(moveAttrs(floorObject, { x: 0.001, y: 0 }, false)).toEqual({});
    // Clamped back where it was: nothing to write.
    expect(
      moveAttrs(
        { ...floorObject, position: { x: 64, y: 3 } },
        { x: 5, y: 0 },
        true,
      ),
    ).toEqual({});
  });

  it("works in a host's unscaled squares, scaled hosts included", () => {
    const onScaledAltar = {
      frame: { ox: 8, oy: 8, unit: 2 },
      position: { x: 0, y: -0.4 },
    };
    // Two floor squares are one square of a host drawn at scale 2.
    expect(moveAttrs(onScaledAltar, { x: 2, y: 0.8 }, false)).toEqual({
      x: 1,
      y: 0,
    });
    expect(
      isNegativeZero(moveAttrs(onScaledAltar, { x: 0, y: 0.8 }, false).y),
    ).toBe(false);
  });

  it("writes offsets from `at`, which it keeps", () => {
    const hall = neophyteHall();
    const { objects } = resolved(hall);
    // The salt: at="north", y=-0.3 on the altar at the floor's centre.
    const salt = object(objects, [1, 4, 3]);
    expect(salt.position).toEqual({ x: 0, y: -0.3 });
    expect(moveAttrs(salt, { x: 0.5, y: 0.5 }, true)).toEqual({
      x: 0.5,
      y: 0,
    });
  });

  it("gives a row child a position of its own", () => {
    const { objects } = resolved();
    const hierophant = object(objects, [0, 2]);
    expect(hierophant.position.x).toBe(8);
    expect(moveAttrs(hierophant, { x: 1, y: 0 }, true)).toEqual({ x: 9 });
  });

  it("clamps to the coordinate range", () => {
    expect(moveAttrs(floorObject, { x: 1000, y: -1000 }, true)).toEqual({
      x: 64,
      y: -48,
    });
  });
});

describe("nudgeAttrs", () => {
  it("adds the step without snapping", () => {
    expect(
      nudgeAttrs({ position: { x: 9.4, y: 0 } }, { x: 0.5, y: 0 }),
    ).toEqual({ x: 9.9 });
    expect(
      nudgeAttrs({ position: { x: 0.5, y: 3 } }, { x: -0.5, y: -1 }),
    ).toEqual({ x: 0, y: 2 });
    expect(nudgeAttrs({ position: { x: 64, y: 0 } }, { x: 1, y: 0 })).toEqual(
      {},
    );
  });
});

describe("scaling", () => {
  const pillar = { cx: 4, cy: 3, scale: 1 };

  it("scales with the pointer's distance from the centre", () => {
    expect(dragScale(pillar, { x: 5, y: 4 }, { x: 5.5, y: 4.5 })).toBe(1.5);
    expect(dragScale(pillar, { x: 5, y: 4 }, { x: 4, y: 3 })).toBe(0.05);
    expect(dragScale(pillar, { x: 4, y: 3 }, { x: 9, y: 9 })).toBe(1);
    expect(
      dragScale({ ...pillar, scale: 8 }, { x: 5, y: 3 }, { x: 9, y: 3 }),
    ).toBe(10);
  });

  it("steps by a tenth, at least a hundredth, within the range", () => {
    expect(stepScale(1, true)).toBe(1.1);
    expect(stepScale(1, false)).toBe(0.91);
    expect(stepScale(0.05, true)).toBe(0.06);
    expect(stepScale(0.05, false)).toBe(0.05);
    expect(stepScale(10, true)).toBe(10);
    expect(stepScale(0.08, false)).toBe(0.07);
  });
});

describe("doors", () => {
  it("move along their wall, on the floor's 0–16", () => {
    expect(doorAlongAttr("west")).toBe("x");
    expect(doorAlongAttr("north")).toBe("y");
    const west = { side: "west", from: 13, to: 15 };
    expect(moveDoor(west, { x: -1.2, y: 5 }, true)).toBe(13);
    expect(moveDoor(west, { x: 0.1, y: 5 }, true)).toBeUndefined();
    expect(moveDoor(west, { x: 0.004, y: 0 }, false)).toBeUndefined();
    expect(moveDoor(west, { x: 10, y: 0 }, false)).toBe(16);
    expect(
      moveDoor({ side: "south", from: 3, to: 5 }, { x: 0, y: 1.26 }, false),
    ).toBe(5.26);
  });

  it("are hit in a band across their wall line", () => {
    const outer = { x0: -0.31, y0: -4, x1: 16.31, y1: 16.31 };
    const door = (side: "east" | "west" | "north" | "south") =>
      doorRect({ path: [], side, from: 7, to: 9 }, outer);
    expect(door("west")).toEqual({
      x0: 7,
      x1: 9,
      y0: 16.31 - DOOR_HIT_DEPTH,
      y1: 16.31 + DOOR_HIT_DEPTH,
    });
    expect(door("east").y0).toBe(-4 - DOOR_HIT_DEPTH);
    expect(door("north")).toMatchObject({ y0: 7, y1: 9 });
    expect(door("north").x0).toBeCloseTo(-0.31 - DOOR_HIT_DEPTH, 10);
    expect(door("south").x1).toBeCloseTo(16.31 + DOOR_HIT_DEPTH, 10);
  });
});

describe("hitTest", () => {
  it("finds the topmost object: a host's child over the host", () => {
    const hall = resolved();
    expect(hitTest(hall, { x: 8, y: 3 })).toEqual({
      path: [1, 2],
      kind: "object",
    });
    // The cross on the altar lies over the altar.
    expect(hitTest(hall, { x: 8, y: 7.6 })).toEqual({
      path: [1, 4, 0],
      kind: "object",
    });
    expect(hitTest(hall, { x: 7.2, y: 7.2 })).toEqual({
      path: [1, 4],
      kind: "object",
    });
    expect(hitTest(hall, { x: 6, y: 11 })).toBeNull();
  });

  it("hits labels, small objects at a minimum size, and doors", () => {
    const hall = resolved();
    const hegemon = object(hall.objects, [1, 2]);
    const label = hegemon.labels[0].bounds;
    expect(
      hitTest(hall, { x: (label.x0 + label.x1) / 2, y: label.y0 + 0.01 }),
    ).toEqual({ path: [1, 2], kind: "object" });
    // The door in the West wall at x 13–15.
    expect(hitTest(hall, { x: 14.5, y: 16.31 })).toEqual({
      path: [1, 10],
      kind: "door",
    });
    const tiny = resolveHall(
      hallRowOf(
        hallFromPug(
          "gdHall",
          "  floor",
          '    item(kind="cup", x=3, y=3, scale=0.05)',
        ),
      ) ?? { type: "gdHall" },
      { art: gdHallArt },
    );
    const [box] = hitRects(tiny.objects[0]);
    expect(box.x1 - box.x0).toBeCloseTo(MIN_HIT_SIZE, 10);
    expect(hitTest(tiny, { x: 3.25, y: 3.25 })?.path).toEqual([0, 0]);
  });

  it("hits a label over a later object, as labels are drawn over it", () => {
    const hall = (cup = "") =>
      resolveHall(
        hallRowOf(
          hallFromPug(
            "gdHall",
            "  floor",
            '    pillar(kind="black", x=4, y=3, label="Boaz")',
            ...(cup ? [`    item(kind="cup", ${cup})`] : []),
          ),
        ) ?? { type: "gdHall" },
        { art: gdHallArt },
      );
    const label = hall().objects[0].labels[0].bounds;
    const centre = {
      x: round2((label.x0 + label.x1) / 2),
      y: round2((label.y0 + label.y1) / 2),
    };
    // A cup later in the floor, standing on the pillar's label.
    const both = hall(`x=${centre.x}, y=${centre.y}`);
    expect(both.objects[0].labels[0].bounds).toEqual(label);
    expect(hitRects(both.objects[1])[0].x0).toBeLessThan(centre.x);
    expect(hitTest(both, centre)?.path).toEqual([0, 0]);
    // Off the label, the cup's body is hit.
    const body = hitRects(both.objects[1])[0];
    expect(
      hitTest(both, {
        x: centre.x,
        y: Math.max(body.y1 - 0.01, label.y1 + 0.01),
      })?.path,
    ).toEqual([0, 1]);
  });

  it("hits free text by its box", () => {
    const hall = resolveHall(
      hallRowOf(
        hallFromPug("gdHall", "  floor", '    label(text="Here", x=3, y=3)'),
      ) ?? { type: "gdHall" },
      { art: gdHallArt },
    );
    expect(hitRects(hall.objects[0])).toHaveLength(2);
    expect(hitTest(hall, { x: 3, y: 3 })?.path).toEqual([0, 0]);
  });
});

describe("compareRowPaths", () => {
  it("orders paths as the document does", () => {
    const paths = [[1, 2], [0], [1], [1, 2, 0], [1, 10], [0, 3]];
    expect(paths.sort(compareRowPaths)).toEqual([
      [0],
      [0, 3],
      [1],
      [1, 2],
      [1, 2, 0],
      [1, 10],
    ]);
  });
});
